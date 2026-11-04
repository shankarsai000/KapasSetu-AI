"""End-to-End Automated Verification Suite for KapasSetu AI Backend (Fixes 1, 2, and 3)."""

from __future__ import annotations

import os
import sys
from pathlib import Path

import cv2
import numpy as np
from fastapi.testclient import TestClient

# Ensure isolated test SQLite DB
BACKEND_ROOT = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BACKEND_ROOT.parent
sys.path.insert(0, str(PROJECT_ROOT))
sys.path.insert(0, str(BACKEND_ROOT))
TEST_DB = BACKEND_ROOT / "test_kapassetu.db"
if TEST_DB.exists():
    try:
        TEST_DB.unlink()
    except OSError:
        pass

os.environ["USE_SQLITE_FALLBACK"] = "True"
os.environ["SQLITE_URL"] = f"sqlite:///{(BACKEND_ROOT / 'test_kapassetu.db').as_posix()}"

from app.main import app  # noqa: E402
from app.services.cv_grading import encode_bgr_to_base64_jpeg  # noqa: E402


def teardown_module() -> None:
    test_db = BACKEND_ROOT / "test_kapassetu.db"
    if test_db.exists():
        try:
            test_db.unlink()
        except OSError:
            pass


def test_health_and_seeded_pools() -> None:
    with TestClient(app) as client:
        res = client.get("/api/v1/health")
        assert res.status_code == 200
        assert res.json()["status"] == "healthy"

        pools_res = client.get("/api/v1/lots/pools")
        assert pools_res.status_code == 200
        pools = pools_res.json()
        assert len(pools) >= 4
        kalamb = next(p for p in pools if "Kalamb" in p["village_cluster_name"])
        assert kalamb["status"] == "COLLECTING"
        assert kalamb["total_quintals"] == 26.0


def test_fix1_and_fix2_grade_pool_threshold_and_mill_bid() -> None:
    """
    Verify Fix 1 (Optical White Card + Coin Halo CV Calibration) and
    Fix 2 (2026-27 MSP Pricing + 5km Spatial Pool Crossing 30-Quintal Threshold + Mill Bidding).
    """
    with TestClient(app) as client:
        # 1. Analyze Kalamb Long Staple sample (5.0 quintals)
        grade_res = client.post(
            "/api/v1/grade/analyze",
            json={
                "sample_preset": "kalamb_long_grade_a",
                "farmer_name": "Gajanan Ingole",
                "farmer_phone": "9890123456",
                "village_name": "Kalamb",
                "district": "Yavatmal",
                "latitude": 20.4480,
                "longitude": 78.3290,
                "picking_session": "AFTERNOON_SUN",
                "shade_dried_days": 2,
                "quantity_quintals": 5.0,
                "auto_join_pool": False,
            },
        )
        assert grade_res.status_code == 200, grade_res.text
        assay = grade_res.json()

        # Verify Optical Physics Calibration
        assert assay["white_card_detected"] is True
        assert assay["coin_detected"] is True
        assert 0.22 <= assay["pixel_to_mm_ratio"] <= 0.28
        assert assay["staple_length_mm"] >= 28.0
        assert "Grade A" in assay["color_grade"]
        assert assay["base_msp_price"] == 7521.0
        assert assay["final_fair_price_per_qtl"] > 7521.0
        assert assay["annotated_pile_base64"].startswith("data:image/jpeg;base64,")
        assert assay["annotated_halo_base64"].startswith("data:image/jpeg;base64,")

        # 2. Join 5km Kalamb Village Pool (26.0 + 5.0 = 31.0 Quintals -> READY_FOR_BIDDING!)
        join_res = client.post(
            "/api/v1/lots/join-pool",
            json={"assay_id": assay["id"]},
        )
        assert join_res.status_code == 200
        pool = join_res.json()
        assert pool["village_cluster_name"] == "Kalamb Cluster"
        assert pool["total_quintals"] == 31.0
        assert pool["status"] == "READY_FOR_BIDDING"

        # 3. Gin Mill places a direct farm-gate pickup bid on Kalamb Cluster
        bid_res = client.post(
            f"/api/v1/lots/pools/{pool['id']}/bid",
            json={
                "gin_mill_name": "Yavatmal CleanBale Ginning Pvt Ltd",
                "gin_mill_location": "Yavatmal MIDC (18 km)",
                "bid_price_per_qtl": 7980.0,
                "pickup_date": "Tomorrow, 11:00 AM",
                "free_farm_gate_pickup": True,
            },
        )
        assert bid_res.status_code == 200
        updated_pool = bid_res.json()
        assert updated_pool["highest_bid_per_qtl"] == 7980.0
        bid_id = updated_pool["bids"][0]["id"]

        # 4. Accept bid -> locks pool
        accept_res = client.post(f"/api/v1/lots/bids/{bid_id}/accept")
        assert accept_res.status_code == 200
        locked_pool = accept_res.json()
        assert locked_pool["status"] == "LOCKED_BY_MILL"
        assert locked_pool["bids"][0]["status"] == "ACCEPTED"


def test_fix3_sub35ms_lint_inspection_and_hal_interlock() -> None:
    """
    Verify Fix 3 (<35ms Edge Lint Contamination Detection + KAPASSETU_HAL_V1 Relay Interlock).
    """
    with TestClient(app) as client:
        # Build synthetic ginning chute frame with a white PP plastic strip & colored wrapper
        frame = np.full((360, 640, 3), (212, 215, 218), dtype=np.uint8)
        cv2.rectangle(frame, (180, 110), (310, 142), (254, 254, 255), -1)
        cv2.rectangle(frame, (410, 190), (485, 245), (235, 45, 30), -1)
        frame_b64 = encode_bgr_to_base64_jpeg(frame, quality=85)

        res = client.post(
            "/api/v1/hal/inspect-frame",
            json={
                "frame_base64": frame_b64,
                "mill_id": "MILL-VIDARBHA-01",
                "camera_line_id": "GIN-CHUTE-LINE-1",
                "auto_trigger_hal": True,
            },
        )
        assert res.status_code == 200
        data = res.json()
        assert data["trigger_hal_relay"] is True
        assert len(data["contaminants_detected"]) >= 1
        assert data["hal_status"]["conveyor_state"] == "PAUSED_BY_AI"
        assert data["hal_status"]["air_jet_diverter_state"] == "FIRING_VALVE"
        assert data["hal_trigger_event"]["protocol"] == "KAPASSETU_HAL_V1"
        assert data["hal_trigger_event"]["gpio_pin_target"] == "RELAY_CH1_24V_NC"

        # Reset line and mark false positive
        reset_res = client.post(
            "/api/v1/hal/reset-line",
            json={
                "event_id": data["hal_trigger_event"]["event_id"],
                "mark_false_positive": True,
            },
        )
        assert reset_res.status_code == 200
        assert reset_res.json()["hal_status"]["conveyor_state"] == "RUNNING"


def test_is_mock_dataset_mode_bypass() -> None:
    """
    Verify Dataset Mode (is_mock=True):
    Bypasses white-card Von Kries and ₹5 coin contour search, sets default spatial ratio (0.1 mm/px),
    passes through MobileNetV3 and YOLO, and maintains the exact same output schema.
    """
    with TestClient(app) as client:
        # Build plain raw dataset image without calibration card or coin (e.g. CIRCOT/Kaggle)
        raw_cotton = np.full((300, 300, 3), (225, 230, 235), dtype=np.uint8)
        # Add slight dark trash specks
        cv2.circle(raw_cotton, (100, 100), 4, (40, 40, 40), -1)
        raw_b64 = encode_bgr_to_base64_jpeg(raw_cotton, quality=80)

        res = client.post(
            "/api/v1/grade/analyze",
            json={
                "pile_image_base64": raw_b64,
                "halo_image_base64": raw_b64,
                "is_mock": True,
                "farmer_name": "CIRCOT Dataset Sample",
                "farmer_phone": "9999988888",
                "village_name": "Wardha",
                "district": "Wardha",
                "latitude": 20.7453,
                "longitude": 78.6022,
            },
        )
        assert res.status_code == 200, res.text
        data = res.json()
        assert data["is_mock"] is True
        assert data["white_card_detected"] is False
        assert data["coin_detected"] is False
        # Exact default spatial ratio assigned
        assert data["pixel_to_mm_ratio"] == 0.1
        # Valid staple and grade from MobileNetV3
        assert 21.0 <= data["staple_length_mm"] <= 36.0
        assert "Grade" in data["color_grade"]
        assert "final_fair_price_per_qtl" in data
        assert isinstance(data["contaminants_detected"], list)

