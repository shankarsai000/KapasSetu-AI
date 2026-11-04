"""Optical Cotton Grading API Router (`POST /api/v1/grade/analyze`, sample presets, history)."""

from __future__ import annotations

from typing import Any
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import CottonAssay, Farmer
from app.schemas import AnalyzeGradeJsonRequest, AssayResponse
from app.services.cv_grading import (
    decode_image_bytes_or_base64,
    encode_bgr_to_base64_jpeg,
    generate_synthetic_demo_pair,
    run_complete_dual_photo_assay,
)
from app.services.hal_controller import ws_manager
from app.services.lint_inspector import lint_inspector
from app.services.lot_aggregator import assign_assay_to_village_pool, preview_nearby_pool
from app.services.moisture_proxy import estimate_cotton_moisture
from app.services.pricing_engine import calculate_fair_kapas_price

router = APIRouter(prefix="/api/v1/grade", tags=["Optical Cotton Grading"])


@router.get("/samples")
def list_demo_sample_presets() -> dict[str, Any]:
    """
    Generate and return realistic synthetic dual-photo cotton sample presets
    (Bulk Pile + White Card, and Dark Cloth + Rs 5 Coin + Combed Seed Halo)
    for instant one-tap testing in the Farmer PWA.
    """
    preset_ids = [
        "kalamb_long_grade_a",
        "wardha_medium_grade_b",
        "amravati_high_trash_dew",
    ]
    items = []
    for pid in preset_ids:
        pile_bgr, halo_bgr, cfg = generate_synthetic_demo_pair(pid)
        items.append(
            {
                "preset_id": pid,
                "label": cfg["label"],
                "village_name": cfg["village_name"],
                "district": cfg["district"],
                "latitude": cfg["lat"],
                "longitude": cfg["lon"],
                "pile_preview_base64": encode_bgr_to_base64_jpeg(pile_bgr, quality=82),
                "halo_preview_base64": encode_bgr_to_base64_jpeg(halo_bgr, quality=82),
            }
        )
    return {"samples": items}


@router.post("/analyze", response_model=AssayResponse)
async def analyze_cotton_sample(
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> AssayResponse:
    """
    Run the complete 3-Step Calibrated Cotton Assay:
      1. Photo 1 White-Card Von Kries L*a*b* Color & Trash %
      2. Photo 2 Rs 5 Coin Hough Scale + 72-Ray Combed Halo Staple Length (mm)
      3. Open-Meteo Agronomic Moisture Proxy + 2026-27 MSP Fair Valuation
    Accepts either `application/json` (base64 images or `sample_preset`) or `multipart/form-data`.
    """
    content_type = request.headers.get("content-type", "")

    if "multipart/form-data" in content_type:
        form = await request.form()
        pile_upload = form.get("pile_image")
        halo_upload = form.get("halo_image")
        sample_preset = str(form.get("sample_preset") or "kalamb_long_grade_a")

        if pile_upload is not None and hasattr(pile_upload, "read"):
            pile_bytes = await pile_upload.read()
            pile_bgr = decode_image_bytes_or_base64(pile_bytes)
        elif form.get("pile_image_base64"):
            pile_bgr = decode_image_bytes_or_base64(str(form.get("pile_image_base64")))
        else:
            pile_bgr, _, _ = generate_synthetic_demo_pair(sample_preset)

        if halo_upload is not None and hasattr(halo_upload, "read"):
            halo_bytes = await halo_upload.read()
            halo_bgr = decode_image_bytes_or_base64(halo_bytes)
        elif form.get("halo_image_base64"):
            halo_bgr = decode_image_bytes_or_base64(str(form.get("halo_image_base64")))
        else:
            _, halo_bgr, _ = generate_synthetic_demo_pair(sample_preset)

        farmer_name = str(form.get("farmer_name") or "Rameshwar Deshmukh")
        farmer_phone = str(form.get("farmer_phone") or "9823012345")
        village_name = str(form.get("village_name") or "Kalamb")
        district = str(form.get("district") or "Yavatmal")
        latitude = float(form.get("latitude") or 20.4456)
        longitude = float(form.get("longitude") or 78.3264)
        picking_session = str(form.get("picking_session") or "AFTERNOON_SUN")
        shade_dried_days = int(form.get("shade_dried_days") or 2)
        quantity_quintals = float(form.get("quantity_quintals") or 4.5)
        sensor_raw = form.get("sensor_override_pct")
        sensor_override_pct = float(sensor_raw) if sensor_raw not in (None, "", "null") else None
        auto_join_pool = str(form.get("auto_join_pool") or "false").lower() in ("true", "1", "yes")
        is_mock = str(form.get("is_mock") or "false").lower() in ("true", "1", "yes")
    else:
        body = await request.json()
        payload = AnalyzeGradeJsonRequest(**body)
        sample_preset = payload.sample_preset or "kalamb_long_grade_a"

        try:
            if payload.pile_image_base64:
                pile_bgr = decode_image_bytes_or_base64(payload.pile_image_base64)
            else:
                pile_bgr, _, _ = generate_synthetic_demo_pair(sample_preset)

            if payload.halo_image_base64:
                halo_bgr = decode_image_bytes_or_base64(payload.halo_image_base64)
            else:
                _, halo_bgr, _ = generate_synthetic_demo_pair(sample_preset)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        farmer_name = payload.farmer_name
        farmer_phone = payload.farmer_phone
        village_name = payload.village_name
        district = payload.district
        latitude = payload.latitude
        longitude = payload.longitude
        picking_session = payload.picking_session
        shade_dried_days = payload.shade_dried_days
        quantity_quintals = payload.quantity_quintals
        sensor_override_pct = payload.sensor_override_pct
        auto_join_pool = payload.auto_join_pool
        is_mock = payload.is_mock

    # 1. Optical / Deep Learning Grading (with is_mock fallback support)
    cv_metrics = run_complete_dual_photo_assay(pile_bgr, halo_bgr, is_mock=is_mock)

    # 1b. Run fast YOLO Contamination check
    if is_mock:
        contaminants = []
    else:
        yolo_inspection = lint_inspector.inspect_frame(pile_bgr)
        contaminants = yolo_inspection.get("contaminants_detected", [])

    # 2. Agronomic Weather Moisture Proxy (or BLE Override)
    moisture_res = estimate_cotton_moisture(
        lat=latitude,
        lon=longitude,
        picking_session=picking_session,
        shade_dried_days=shade_dried_days,
        sensor_override_pct=sensor_override_pct,
    )

    # 3. 2026-27 MSP & Mandi Fair Pricing Engine
    pricing_res = calculate_fair_kapas_price(
        staple_mm=cv_metrics["staple_length_mm"],
        trash_pct=cv_metrics["trash_percent"],
        moisture_pct=moisture_res["moisture_percent"],
        color_grade=cv_metrics["color_grade"],
    )

    # 4. Find or create Farmer record
    farmer = db.query(Farmer).filter(Farmer.phone == farmer_phone).first()
    if farmer is None:
        farmer_kwargs: dict[str, Any] = dict(
            phone=farmer_phone,
            name=farmer_name,
            village_name=village_name,
            district=district,
            latitude=latitude,
            longitude=longitude,
        )
        if not settings.USE_SQLITE_FALLBACK:
            from geoalchemy2.elements import WKTElement

            farmer_kwargs["geom"] = WKTElement(f"POINT({longitude} {latitude})", srid=4326)
        farmer = Farmer(**farmer_kwargs)
        db.add(farmer)
        db.flush()

    # 5. Persist CottonAssay
    assay_kwargs: dict[str, Any] = dict(
        farmer_id=farmer.id,
        farmer_name=farmer_name,
        village_name=village_name,
        district=district,
        reflectance_rd=cv_metrics["reflectance_rd"],
        yellowness_plus_b=cv_metrics["yellowness_plus_b"],
        color_grade=cv_metrics["color_grade"],
        staple_length_mm=cv_metrics["staple_length_mm"],
        trash_percent=cv_metrics["trash_percent"],
        pixel_to_mm_ratio=cv_metrics["pixel_to_mm_ratio"],
        white_card_detected=cv_metrics["white_card_detected"],
        coin_detected=cv_metrics["coin_detected"],
        moisture_percent=moisture_res["moisture_percent"],
        moisture_source=moisture_res["moisture_source"],
        relative_humidity_pct=moisture_res["relative_humidity_pct"],
        ambient_temp_c=moisture_res["ambient_temp_c"],
        base_msp_price=pricing_res["base_msp_price"],
        staple_adjustment=pricing_res["staple_adjustment"],
        color_adjustment=pricing_res["color_adjustment"],
        trash_deduction=pricing_res["trash_deduction"],
        moisture_deduction=pricing_res["moisture_deduction"],
        final_fair_price_per_qtl=pricing_res["final_fair_price_per_qtl"],
        quantity_quintals=quantity_quintals,
        latitude=latitude,
        longitude=longitude,
    )
    if not settings.USE_SQLITE_FALLBACK:
        from geoalchemy2.elements import WKTElement

        assay_kwargs["geom"] = WKTElement(f"POINT({longitude} {latitude})", srid=4326)

    assay = CottonAssay(**assay_kwargs)
    db.add(assay)
    db.commit()
    db.refresh(assay)

    if auto_join_pool:
        pool = assign_assay_to_village_pool(db, assay)
        db.refresh(assay)
        background_tasks.add_task(
            ws_manager.broadcast_json,
            {
                "type": "POOL_UPDATED",
                "pool_id": pool.id,
                "status": pool.status,
                "total_quintals": pool.total_quintals,
                "village_cluster_name": pool.village_cluster_name,
            },
        )

    pool_preview = preview_nearby_pool(
        db=db,
        lat=latitude,
        lon=longitude,
        staple_mm=assay.staple_length_mm,
        village_name=village_name,
    )

    return AssayResponse(
        id=assay.id,
        farmer_id=assay.farmer_id,
        farmer_name=assay.farmer_name,
        village_name=assay.village_name,
        district=assay.district,
        reflectance_rd=assay.reflectance_rd,
        yellowness_plus_b=assay.yellowness_plus_b,
        color_grade=assay.color_grade,
        staple_length_mm=assay.staple_length_mm,
        staple_category=pricing_res["staple_category"],
        trash_percent=assay.trash_percent,
        pixel_to_mm_ratio=assay.pixel_to_mm_ratio,
        white_card_detected=assay.white_card_detected,
        coin_detected=assay.coin_detected,
        moisture_percent=assay.moisture_percent,
        moisture_source=assay.moisture_source,
        relative_humidity_pct=assay.relative_humidity_pct,
        ambient_temp_c=assay.ambient_temp_c,
        base_msp_price=assay.base_msp_price,
        staple_adjustment=assay.staple_adjustment,
        color_adjustment=assay.color_adjustment,
        trash_deduction=assay.trash_deduction,
        moisture_deduction=assay.moisture_deduction,
        final_fair_price_per_qtl=assay.final_fair_price_per_qtl,
        expected_batch_value_inr=round(assay.final_fair_price_per_qtl * assay.quantity_quintals, 2),
        minimum_walkaway_price_per_qtl=pricing_res["minimum_walkaway_price_per_qtl"],
        negotiation_tip=pricing_res["negotiation_tip"],
        quantity_quintals=assay.quantity_quintals,
        latitude=assay.latitude,
        longitude=assay.longitude,
        pool_id=assay.pool_id,
        annotated_pile_base64=cv_metrics["annotated_pile_base64"],
        annotated_halo_base64=cv_metrics["annotated_halo_base64"],
        nearby_pool_preview=pool_preview,
        contaminants_detected=contaminants,
        is_mock=is_mock,
        created_at=assay.created_at,
    )


@router.get("/assays")
def list_recent_assays(limit: int = 20, db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    rows = (
        db.query(CottonAssay)
        .order_by(CottonAssay.id.desc())
        .limit(min(100, max(1, limit)))
        .all()
    )
    return [
        {
            "id": r.id,
            "farmer_name": r.farmer_name,
            "village_name": r.village_name,
            "district": r.district,
            "color_grade": r.color_grade,
            "staple_length_mm": r.staple_length_mm,
            "trash_percent": r.trash_percent,
            "moisture_percent": r.moisture_percent,
            "final_fair_price_per_qtl": r.final_fair_price_per_qtl,
            "quantity_quintals": r.quantity_quintals,
            "pool_id": r.pool_id,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]

