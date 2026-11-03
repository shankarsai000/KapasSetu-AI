"""PostGIS 5km Spatial Clustering & 30-Quintal Commercial Truckload Lot Aggregator."""

from __future__ import annotations

import math
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config import settings
from app.models import CottonAssay, VillagePool


def determine_quality_tier(staple_mm: float) -> str:
    """Map millimeter staple length to uniform commercial ginning lot tiers."""
    if staple_mm >= 28.0:
        return "TIER_A_LONG"
    if staple_mm >= 26.0:
        return "TIER_B_MEDIUM_LONG"
    return "TIER_C_MEDIUM"


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Compute exact great-circle distance in kilometers between two WGS84 coordinates."""
    earth_radius_km = 6371.0088
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)
    a = (
        math.sin(d_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2.0) ** 2
    )
    return 2.0 * earth_radius_km * math.atan2(math.sqrt(a), math.sqrt(max(0.0, 1.0 - a)))


def find_matching_collecting_pool(
    db: Session,
    lat: float,
    lon: float,
    quality_tier: str,
) -> VillagePool | None:
    """Find the closest COLLECTING VillagePool of matching quality_tier within 5.0 km."""
    if not settings.USE_SQLITE_FALLBACK:
        from geoalchemy2.elements import WKTElement

        point = WKTElement(f"POINT({lon} {lat})", srid=4326)
        candidate = (
            db.query(VillagePool)
            .filter(
                VillagePool.status == "COLLECTING",
                VillagePool.quality_tier == quality_tier,
                func.ST_DWithin(
                    VillagePool.geom,
                    point,
                    settings.VILLAGE_POOL_RADIUS_METERS,
                ),
            )
            .order_by(func.ST_Distance(VillagePool.geom, point))
            .first()
        )
        return candidate

    # SQLite + Haversine fallback mode
    candidates = (
        db.query(VillagePool)
        .filter(
            VillagePool.status == "COLLECTING",
            VillagePool.quality_tier == quality_tier,
        )
        .all()
    )
    nearest_pool: VillagePool | None = None
    nearest_dist = float("inf")
    for pool in candidates:
        dist = haversine_km(lat, lon, pool.center_lat, pool.center_lon)
        if dist <= settings.VILLAGE_POOL_RADIUS_KM and dist < nearest_dist:
            nearest_dist = dist
            nearest_pool = pool
    return nearest_pool


def preview_nearby_pool(
    db: Session,
    lat: float,
    lon: float,
    staple_mm: float,
    village_name: str,
) -> dict:
    """Return a non-mutating preview of the matching 5km pool for the GradeCertificate screen."""
    tier = determine_quality_tier(staple_mm)
    pool = find_matching_collecting_pool(db, lat, lon, tier)
    if pool is None:
        # Also check if there is a READY_FOR_BIDDING pool right here to display context
        ready_pools = (
            db.query(VillagePool)
            .filter(VillagePool.quality_tier == tier, VillagePool.status == "READY_FOR_BIDDING")
            .all()
        )
        for rp in ready_pools:
            if haversine_km(lat, lon, rp.center_lat, rp.center_lon) <= settings.VILLAGE_POOL_RADIUS_KM:
                return {
                    "exists": True,
                    "pool_id": rp.id,
                    "village_cluster_name": rp.village_cluster_name,
                    "quality_tier": tier,
                    "current_quintals": round(rp.total_quintals, 2),
                    "target_threshold_quintals": rp.target_threshold_quintals,
                    "farmer_count": rp.farmer_count,
                    "status": rp.status,
                }
        return {
            "exists": False,
            "pool_id": None,
            "village_cluster_name": f"{village_name} Cluster",
            "quality_tier": tier,
            "current_quintals": 0.0,
            "target_threshold_quintals": settings.DEFAULT_POOL_THRESHOLD_QUINTALS,
            "farmer_count": 0,
            "status": "NEW_POOL_ON_JOIN",
        }

    return {
        "exists": True,
        "pool_id": pool.id,
        "village_cluster_name": pool.village_cluster_name,
        "quality_tier": pool.quality_tier,
        "current_quintals": round(pool.total_quintals, 2),
        "target_threshold_quintals": pool.target_threshold_quintals,
        "farmer_count": pool.farmer_count,
        "status": pool.status,
    }


def assign_assay_to_village_pool(db: Session, assay: CottonAssay) -> VillagePool:
    """
    Assign a graded CottonAssay to an existing 5km VillagePool of the same quality tier,
    or create a new VillagePool. Automatically transitions status to READY_FOR_BIDDING
    once pooled weight >= 30.0 quintals.
    """
    if assay.pool_id is not None:
        existing = db.query(VillagePool).filter(VillagePool.id == assay.pool_id).first()
        if existing is not None:
            return existing

    quality_tier = determine_quality_tier(assay.staple_length_mm)
    pool = find_matching_collecting_pool(db, assay.latitude, assay.longitude, quality_tier)

    qty = max(0.5, float(assay.quantity_quintals))

    if pool is not None:
        prev_qty = max(0.0, float(pool.total_quintals))
        new_qty = round(prev_qty + qty, 2)

        # Weighted quality averages by quintal weight
        pool.avg_staple_mm = round(
            ((pool.avg_staple_mm * prev_qty) + (assay.staple_length_mm * qty)) / new_qty, 2
        )
        pool.avg_trash_pct = round(
            ((pool.avg_trash_pct * prev_qty) + (assay.trash_percent * qty)) / new_qty, 2
        )
        pool.avg_moisture_pct = round(
            ((pool.avg_moisture_pct * prev_qty) + (assay.moisture_percent * qty)) / new_qty, 2
        )
        pool.avg_rd = round(
            ((pool.avg_rd * prev_qty) + (assay.reflectance_rd * qty)) / new_qty, 2
        )
        pool.ask_price_per_qtl = round(
            ((pool.ask_price_per_qtl * prev_qty) + (assay.final_fair_price_per_qtl * qty)) / new_qty,
            2,
        )
        pool.total_quintals = new_qty
        pool.farmer_count = int(pool.farmer_count) + 1

        if pool.total_quintals >= pool.target_threshold_quintals:
            pool.status = "READY_FOR_BIDDING"
    else:
        cluster_name = (
            assay.village_name
            if "Cluster" in assay.village_name
            else f"{assay.village_name} Cluster"
        )
        initial_status = (
            "READY_FOR_BIDDING"
            if qty >= settings.DEFAULT_POOL_THRESHOLD_QUINTALS
            else "COLLECTING"
        )
        pool_kwargs = dict(
            center_lat=assay.latitude,
            center_lon=assay.longitude,
            village_cluster_name=cluster_name,
            district=assay.district or "Yavatmal",
            quality_tier=quality_tier,
            total_quintals=round(qty, 2),
            target_threshold_quintals=settings.DEFAULT_POOL_THRESHOLD_QUINTALS,
            farmer_count=1,
            avg_staple_mm=round(assay.staple_length_mm, 2),
            avg_trash_pct=round(assay.trash_percent, 2),
            avg_moisture_pct=round(assay.moisture_percent, 2),
            avg_rd=round(assay.reflectance_rd, 2),
            ask_price_per_qtl=round(assay.final_fair_price_per_qtl, 2),
            status=initial_status,
        )
        if not settings.USE_SQLITE_FALLBACK:
            from geoalchemy2.elements import WKTElement

            pool_kwargs["geom"] = WKTElement(
                f"POINT({assay.longitude} {assay.latitude})", srid=4326
            )
        pool = VillagePool(**pool_kwargs)
        db.add(pool)
        db.flush()

    assay.pool_id = pool.id
    db.commit()
    db.refresh(pool)
    return pool

