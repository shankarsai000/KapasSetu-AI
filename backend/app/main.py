"""
KapasSetu AI — FastAPI Core Entrypoint, CORS, Lifespan Seeder & Health Telemetry.
"""

from __future__ import annotations

import json
from contextlib import asynccontextmanager
from typing import Any

from fastapi import BackgroundTasks, Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app import database, models, schemas
from app.config import settings
from app.database import SessionLocal, init_db
from app.models import CottonAssay, Farmer, HalActuatorEvent, MillBid, VillagePool
from app.routers import ginner_hal, grading, marketplace, voice
from app.services.lint_inspector import lint_inspector
from app.services.feedback_store import log_hard_negative_frame
from ml_engine.contamination_tracker import contamination_tracker


def seed_initial_vidarbha_ecosystem() -> None:
    """
    Seed realistic Vidarbha cotton clusters, farmers, and mill bids on first run
    so both the Farmer PWA and Ginner Console showcase live marketplace activity
    out-of-the-box—including a Kalamb pool at 26.0/30.0 quintals ready to cross
    the commercial truckload threshold on a single demo submission!
    """
    with SessionLocal() as db:
        if db.query(VillagePool).count() > 0:
            return

        # 1. Kalamb Cluster (Yavatmal) — 26.0 / 30.0 Quintals (COLLECTING -> 1 lot away from READY!)
        kalamb_pool_kwargs: dict[str, Any] = dict(
            center_lat=20.4456,
            center_lon=78.3264,
            village_cluster_name="Kalamb Cluster",
            district="Yavatmal",
            quality_tier="TIER_A_LONG",
            total_quintals=26.0,
            target_threshold_quintals=30.0,
            farmer_count=6,
            avg_staple_mm=28.6,
            avg_trash_pct=2.2,
            avg_moisture_pct=8.1,
            avg_rd=76.2,
            ask_price_per_qtl=7868.0,
            status="COLLECTING",
        )

        # 2. Hinganghat Cluster (Wardha) — 34.5 / 30.0 Quintals (READY_FOR_BIDDING with live mill bids!)
        hinganghat_pool_kwargs: dict[str, Any] = dict(
            center_lat=20.5506,
            center_lon=78.8380,
            village_cluster_name="Hinganghat Cluster",
            district="Wardha",
            quality_tier="TIER_A_LONG",
            total_quintals=34.5,
            target_threshold_quintals=30.0,
            farmer_count=8,
            avg_staple_mm=28.9,
            avg_trash_pct=1.9,
            avg_moisture_pct=7.8,
            avg_rd=77.1,
            ask_price_per_qtl=7931.0,
            status="READY_FOR_BIDDING",
        )

        # 3. Dhamangaon Cluster (Amravati) — 31.2 / 30.0 Quintals (READY_FOR_BIDDING Medium-Long)
        dhamangaon_pool_kwargs: dict[str, Any] = dict(
            center_lat=20.7864,
            center_lon=78.1380,
            village_cluster_name="Dhamangaon Cluster",
            district="Amravati",
            quality_tier="TIER_B_MEDIUM_LONG",
            total_quintals=31.2,
            target_threshold_quintals=30.0,
            farmer_count=7,
            avg_staple_mm=26.9,
            avg_trash_pct=2.8,
            avg_moisture_pct=8.3,
            avg_rd=72.4,
            ask_price_per_qtl=7197.0,
            status="READY_FOR_BIDDING",
        )

        # 4. Katol Cluster (Nagpur) — 18.5 / 30.0 Quintals (COLLECTING)
        katol_pool_kwargs: dict[str, Any] = dict(
            center_lat=21.2736,
            center_lon=78.5861,
            village_cluster_name="Katol Cluster",
            district="Nagpur",
            quality_tier="TIER_B_MEDIUM_LONG",
            total_quintals=18.5,
            target_threshold_quintals=30.0,
            farmer_count=4,
            avg_staple_mm=27.2,
            avg_trash_pct=2.5,
            avg_moisture_pct=8.0,
            avg_rd=73.5,
            ask_price_per_qtl=7265.0,
            status="COLLECTING",
        )

        if not settings.USE_SQLITE_FALLBACK:
            from geoalchemy2.elements import WKTElement

            for pkw in (
                kalamb_pool_kwargs,
                hinganghat_pool_kwargs,
                dhamangaon_pool_kwargs,
                katol_pool_kwargs,
            ):
                pkw["geom"] = WKTElement(
                    f"POINT({pkw['center_lon']} {pkw['center_lat']})", srid=4326
                )

        p_kalamb = VillagePool(**kalamb_pool_kwargs)
        p_hinganghat = VillagePool(**hinganghat_pool_kwargs)
        p_dhamangaon = VillagePool(**dhamangaon_pool_kwargs)
        p_katol = VillagePool(**katol_pool_kwargs)

        db.add_all([p_kalamb, p_hinganghat, p_dhamangaon, p_katol])
        db.flush()

        # Seed representative Vidarbha farmers & baseline assays
        farmer1 = Farmer(
            phone="9823011101",
            name="Santosh Wankhede",
            village_name="Kalamb",
            district="Yavatmal",
            latitude=20.4456,
            longitude=78.3264,
        )
        farmer2 = Farmer(
            phone="9422188902",
            name="Prakashrao Thakre",
            village_name="Hinganghat",
            district="Wardha",
            latitude=20.5506,
            longitude=78.8380,
        )
        db.add_all([farmer1, farmer2])
        db.flush()

        db.add(
            CottonAssay(
                farmer_id=farmer1.id,
                farmer_name=farmer1.name,
                village_name="Kalamb",
                district="Yavatmal",
                reflectance_rd=76.2,
                yellowness_plus_b=8.6,
                color_grade="Grade A - Good Middling (HVI Rd >= 75)",
                staple_length_mm=28.6,
                trash_percent=2.2,
                pixel_to_mm_ratio=0.25,
                white_card_detected=True,
                coin_detected=True,
                moisture_percent=8.1,
                moisture_source="SOFTWARE_PROXY",
                relative_humidity_pct=52.0,
                ambient_temp_c=31.5,
                base_msp_price=7521.0,
                staple_adjustment=165.0,
                color_adjustment=200.0,
                trash_deduction=0.0,
                moisture_deduction=11.28,
                final_fair_price_per_qtl=7874.72,
                quantity_quintals=5.5,
                latitude=20.4456,
                longitude=78.3264,
                pool_id=p_kalamb.id,
            )
        )

        # Seed direct pickup Gin Mill bids on ready pools
        db.add_all(
            [
                MillBid(
                    pool_id=p_hinganghat.id,
                    gin_mill_name="Mahalaxmi Ginning & Pressing",
                    gin_mill_location="Hinganghat MIDC, Wardha (11 km)",
                    bid_price_per_qtl=8015.0,
                    pickup_date="Tomorrow, 09:30 AM",
                    free_farm_gate_pickup=True,
                    notes="Direct tractor-trolley weighbridge pickup; zero arhatiya commission.",
                    status="PENDING",
                ),
                MillBid(
                    pool_id=p_hinganghat.id,
                    gin_mill_name="Vidarbha SpinTex Agro Industries",
                    gin_mill_location="Butibori Industrial Area, Nagpur (38 km)",
                    bid_price_per_qtl=7960.0,
                    pickup_date="Tomorrow, 02:00 PM",
                    free_farm_gate_pickup=True,
                    notes="RTGS same-day settlement to individual FPO farmer accounts.",
                    status="PENDING",
                ),
                MillBid(
                    pool_id=p_dhamangaon.id,
                    gin_mill_name="Shree Renuka Cotton Ginners",
                    gin_mill_location="Dhamangaon Railway, Amravati (8 km)",
                    bid_price_per_qtl=7290.0,
                    pickup_date="In 2 Days, 10:00 AM",
                    free_farm_gate_pickup=True,
                    notes="Verified low-trash pool bonus included.",
                    status="PENDING",
                ),
            ]
        )

        # Seed 2 historical HAL contamination interlock audit records for ContaminationLog QA table
        sample_hal_1 = {
            "event_id": "HAL-2026-A104",
            "protocol": "KAPASSETU_HAL_V1",
            "gpio_pin_target": "RELAY_CH1_24V_NC",
            "air_valve_pin": "SOLENOID_CH2_8BAR",
            "command": "HALT_FEEDER_AND_EJECT",
            "hold_duration_ms": 5000,
            "contaminant": "white_pp_plastic",
            "confidence": 0.94,
            "inference_latency_ms": 14.2,
        }
        sample_hal_2 = {
            "event_id": "HAL-2026-A109",
            "protocol": "KAPASSETU_HAL_V1",
            "gpio_pin_target": "RELAY_CH1_24V_NC",
            "air_valve_pin": "SOLENOID_CH2_8BAR",
            "command": "HALT_FEEDER_AND_EJECT",
            "hold_duration_ms": 5000,
            "contaminant": "jute_twine",
            "confidence": 0.88,
            "inference_latency_ms": 15.8,
        }
        db.add_all(
            [
                HalActuatorEvent(
                    event_code="HAL-2026-A104",
                    mill_id="MILL-VIDARBHA-01",
                    camera_line_id="GIN-CHUTE-LINE-1",
                    contaminant_class="white_pp_plastic",
                    confidence=0.94,
                    inference_latency_ms=14.2,
                    action_command="HALT_FEEDER_AND_EJECT",
                    relay_duration_ms=5000,
                    hardware_mode="VIRTUAL_SIMULATOR",
                    operator_resolved=True,
                    payload_json=json.dumps(sample_hal_1),
                ),
                HalActuatorEvent(
                    event_code="HAL-2026-A109",
                    mill_id="MILL-VIDARBHA-01",
                    camera_line_id="GIN-CHUTE-LINE-1",
                    contaminant_class="jute_twine",
                    confidence=0.88,
                    inference_latency_ms=15.8,
                    action_command="HALT_FEEDER_AND_EJECT",
                    relay_duration_ms=5000,
                    hardware_mode="VIRTUAL_SIMULATOR",
                    operator_resolved=True,
                    payload_json=json.dumps(sample_hal_2),
                ),
            ]
        )

        db.commit()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    seed_initial_vidarbha_ecosystem()
    yield


app = FastAPI(
    title="KapasSetu AI — Optical Cotton Assay, Spatial Mandi & Edge HAL API",
    description=(
        "Calibrated dual-photo OpenCV cotton grading, PostGIS/Haversine 5km village lot "
        "aggregation, 2026-27 MSP fair valuation, and <35ms ginning lint contamination HAL."
    ),
    version=settings.APP_VERSION,
    lifespan=lifespan,
)

origins = (
    ["*"]
    if settings.CORS_ORIGINS.strip() == "*"
    else [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False if origins == ["*"] else True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(grading.router)
app.include_router(marketplace.router)
app.include_router(ginner_hal.router)
app.include_router(voice.router)


@app.post("/api/v1/grade")
async def grade_endpoint_direct(
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(database.get_db),
):
    """Direct alias endpoint fulfilling Argon contract for POST /api/v1/grade."""
    return await grading.analyze_cotton_sample(request=request, background_tasks=background_tasks, db=db)


@app.post("/api/v1/detect-contamination")
async def detect_contamination_tracked(
    request: schemas.ContaminationTrackRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(database.get_db),
) -> dict[str, Any]:
    """
    Argon Contract Endpoint:
    Runs sub-35ms ContaminationTracker with HSV shadow filtering and 4-frame IoU persistence.
    Fires HAL webhook only when a tracked contaminant persists for >= 4 consecutive frames with mean_conf >= 0.75.
    """
    from app.services.cv_grading import decode_image_bytes_or_base64
    from app.services.hal_controller import hal_controller, ws_manager

    frame_bgr = decode_image_bytes_or_base64(request.frame_base64)
    res = contamination_tracker.process_frame(frame_bgr, injected_hints=request.injected_contaminants)

    hal_result = None
    if res["alert_triggered"] and request.auto_trigger_hal:
        top_contam = res["alerting_contaminants"][0]
        hal_result = hal_controller.trigger_actuator(
            db=db,
            mill_id=request.mill_id,
            camera_id=request.camera_line_id,
            detections=[{
                "class_name": top_contam["class_name"],
                "confidence": top_contam["mean_confidence"],
                "bbox": top_contam["bbox"],
            }],
            inference_latency_ms=res["inference_latency_ms"],
        )
        background_tasks.add_task(
            ws_manager.broadcast_json,
            {
                "type": "HAL_ACTUATOR_TRIGGERED",
                "hal_payload": hal_result["hal_payload"],
                "hal_status": hal_result["status"],
            },
        )

    return {
        **res,
        "hal_status": hal_controller.get_status_snapshot(),
        "hal_trigger_event": hal_result["hal_payload"] if hal_result else None,
    }


@app.post("/api/v1/ginner/false-positive")
def ginner_false_positive_feedback(
    payload: schemas.FalsePositiveFeedbackRequest,
    db: Session = Depends(database.get_db),
) -> dict[str, Any]:
    """
    Argon Contract Endpoint:
    Logs operator-rejected frames into data/hard_negatives/ and background_hard_negatives/
    with an empty annotation file for active learning and model retraining.
    """
    from app.models import HalActuatorEvent
    if payload.event_id:
        ev = db.query(HalActuatorEvent).filter(HalActuatorEvent.event_code == payload.event_id).first()
        if ev:
            ev.is_false_positive = True
            db.commit()

    saved_info = log_hard_negative_frame(
        frame_bytes_or_b64=payload.frame_base64 or "",
        contaminant_class=payload.reported_class,
        operator_notes=payload.operator_notes,
    )
    return {
        "status": "success",
        "message": "False alarm logged to hard-negative pool for active retraining",
        **saved_info,
    }


@app.get("/health")
@app.get("/api/v1/health")
def health_check() -> dict[str, Any]:
    return {
        "status": "healthy",
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "database_mode": "SQLITE_HAVERSINE_FALLBACK"
        if settings.USE_SQLITE_FALLBACK
        else "POSTGRES_POSTGIS_SPATIAL",
        "lint_engine": "YOLOv8n-ONNX"
        if lint_inspector.onnx_active
        else "OpenCV-Spectral-Morph-Edge (<15ms)",
    }

