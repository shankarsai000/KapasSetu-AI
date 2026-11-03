"""Geo-Clustered Village Lot Marketplace & Gin Mill Direct Bidding Router."""

from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import CottonAssay, MillBid, VillagePool
from app.schemas import (
    JoinPoolRequest,
    MillBidCreateRequest,
    MillBidResponse,
    VillagePoolResponse,
)
from app.services.hal_controller import ws_manager
from app.services.lot_aggregator import assign_assay_to_village_pool

router = APIRouter(prefix="/api/v1/lots", tags=["Geo-Clustered Village Mandi"])


def _serialize_pool(pool: VillagePool) -> VillagePoolResponse:
    threshold = max(1.0, float(pool.target_threshold_quintals))
    progress_pct = round(min(100.0, (pool.total_quintals / threshold) * 100.0), 1)
    bids_list = [MillBidResponse.model_validate(b) for b in pool.bids]
    highest_bid = max((b.bid_price_per_qtl for b in bids_list), default=None)

    return VillagePoolResponse(
        id=pool.id,
        center_lat=pool.center_lat,
        center_lon=pool.center_lon,
        village_cluster_name=pool.village_cluster_name,
        district=pool.district,
        quality_tier=pool.quality_tier,
        total_quintals=round(pool.total_quintals, 2),
        target_threshold_quintals=pool.target_threshold_quintals,
        progress_percent=progress_pct,
        farmer_count=pool.farmer_count,
        avg_staple_mm=round(pool.avg_staple_mm, 2),
        avg_trash_pct=round(pool.avg_trash_pct, 2),
        avg_moisture_pct=round(pool.avg_moisture_pct, 2),
        avg_rd=round(pool.avg_rd, 2),
        ask_price_per_qtl=round(pool.ask_price_per_qtl, 2),
        estimated_pool_value_inr=round(pool.total_quintals * pool.ask_price_per_qtl, 2),
        status=pool.status,
        highest_bid_per_qtl=highest_bid,
        bids=bids_list,
        created_at=pool.created_at,
    )


@router.get("/pools", response_model=list[VillagePoolResponse])
def get_active_village_pools(
    status: str | None = None,
    db: Session = Depends(get_db),
) -> list[VillagePoolResponse]:
    """Return all active 5km geo-clustered VillagePools with farmer count, progress %, and bids."""
    query = db.query(VillagePool)
    if status:
        query = query.filter(VillagePool.status == status.strip().upper())

    pools = query.all()
    status_priority = {"READY_FOR_BIDDING": 0, "COLLECTING": 1, "LOCKED_BY_MILL": 2}
    pools.sort(key=lambda p: (status_priority.get(p.status, 3), -p.total_quintals))
    return [_serialize_pool(p) for p in pools]


@router.post("/join-pool", response_model=VillagePoolResponse)
@router.post("/publish", response_model=VillagePoolResponse)
async def join_village_pool(
    payload: JoinPoolRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> VillagePoolResponse:
    """Assign an existing graded CottonAssay into its matching 5km spatial VillagePool."""
    assay = db.query(CottonAssay).filter(CottonAssay.id == payload.assay_id).first()
    if assay is None:
        raise HTTPException(status_code=404, detail=f"CottonAssay #{payload.assay_id} not found.")

    if payload.quantity_quintals is not None and assay.pool_id is None:
        assay.quantity_quintals = payload.quantity_quintals
        db.commit()
        db.refresh(assay)

    prev_pool_status = None
    if assay.pool_id is not None:
        existing_pool = db.query(VillagePool).filter(VillagePool.id == assay.pool_id).first()
        if existing_pool is not None:
            return _serialize_pool(existing_pool)

    pool = assign_assay_to_village_pool(db, assay)
    serialized = _serialize_pool(pool)

    event_type = (
        "POOL_READY_FOR_BIDDING"
        if pool.status == "READY_FOR_BIDDING" and prev_pool_status != "READY_FOR_BIDDING"
        else "POOL_UPDATED"
    )
    background_tasks.add_task(
        ws_manager.broadcast_json,
        {
            "type": event_type,
            "pool": serialized.model_dump(mode="json"),
        },
    )
    return serialized


@router.post("/pools/{pool_id}/bid", response_model=VillagePoolResponse)
async def place_mill_bid(
    pool_id: int,
    payload: MillBidCreateRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> VillagePoolResponse:
    """Allow a Ginning Mill to place a direct farm-gate pickup bid on a VillagePool."""
    pool = db.query(VillagePool).filter(VillagePool.id == pool_id).first()
    if pool is None:
        raise HTTPException(status_code=404, detail=f"VillagePool #{pool_id} not found.")
    if pool.status == "LOCKED_BY_MILL":
        raise HTTPException(status_code=400, detail="This VillagePool is already locked by an accepted bid.")

    bid = MillBid(
        pool_id=pool.id,
        gin_mill_name=payload.gin_mill_name,
        gin_mill_location=payload.gin_mill_location,
        bid_price_per_qtl=round(payload.bid_price_per_qtl, 2),
        pickup_date=payload.pickup_date,
        free_farm_gate_pickup=payload.free_farm_gate_pickup,
        notes=payload.notes,
        status="PENDING",
    )
    db.add(bid)
    db.commit()
    db.refresh(pool)

    serialized = _serialize_pool(pool)
    background_tasks.add_task(
        ws_manager.broadcast_json,
        {
            "type": "NEW_MILL_BID",
            "pool_id": pool.id,
            "gin_mill_name": bid.gin_mill_name,
            "bid_price_per_qtl": bid.bid_price_per_qtl,
            "pool": serialized.model_dump(mode="json"),
        },
    )
    return serialized


@router.post("/bids/{bid_id}/accept", response_model=VillagePoolResponse)
async def accept_mill_bid(
    bid_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> VillagePoolResponse:
    """Accept a Gin Mill's bid on behalf of the VillagePool and lock the truckload for pickup."""
    bid = db.query(MillBid).filter(MillBid.id == bid_id).first()
    if bid is None:
        raise HTTPException(status_code=404, detail=f"MillBid #{bid_id} not found.")

    pool = db.query(VillagePool).filter(VillagePool.id == bid.pool_id).first()
    if pool is None:
        raise HTTPException(status_code=404, detail="Associated VillagePool not found.")

    for other_bid in pool.bids:
        other_bid.status = "ACCEPTED" if other_bid.id == bid.id else "REJECTED"

    pool.status = "LOCKED_BY_MILL"
    db.commit()
    db.refresh(pool)

    serialized = _serialize_pool(pool)
    background_tasks.add_task(
        ws_manager.broadcast_json,
        {
            "type": "BID_ACCEPTED",
            "pool_id": pool.id,
            "accepted_bid_id": bid.id,
            "gin_mill_name": bid.gin_mill_name,
            "bid_price_per_qtl": bid.bid_price_per_qtl,
            "pool": serialized.model_dump(mode="json"),
        },
    )
    return serialized

