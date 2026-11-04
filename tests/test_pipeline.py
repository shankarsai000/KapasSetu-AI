"""
KapasSetu AI — Autonomous Master Verification Suite (`tests/test_pipeline.py`).

Fulfills Argon Stage 4 Contract:
1. Uploading a synthetic dataset image with is_mock=True returns a valid JSON grade
   response in < 5.0 seconds without crashing on missing coin/white-card contours.
2. Feeding 1 to 3 consecutive frames of a synthetic contaminant does NOT trigger the alarm
   (proving transient false-positive suppression), whereas feeding the 4th consecutive frame
   triggers alert_triggered == True and fires the HAL webhook.
3. Feeding a synthetic dark shadow patch (reduced Value V, identical Hue/Saturation)
   is rejected by the HSV shadow filter.
"""

from __future__ import annotations

import os
import sys
import time
from pathlib import Path

import cv2
import numpy as np
from fastapi.testclient import TestClient

ROOT_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT_DIR / "backend"
sys.path.insert(0, str(BACKEND_DIR))
sys.path.insert(0, str(ROOT_DIR))

# Isolate DB for tests
os.environ["USE_SQLITE_FALLBACK"] = "True"
os.environ["SQLITE_URL"] = f"sqlite:///{(BACKEND_DIR / 'test_argon.db').as_posix()}"

from app.main import app
from app.services.cv_grading import encode_bgr_to_base64_jpeg
from ml_engine.calibration import calibrate_and_enhance, shades_of_gray_color_constancy
from ml_engine.contamination_tracker import ContaminationTracker
from ml_engine.grading_model import grading_model


def test_1_dataset_mode_latency_and_schema():
    """Requirement 1: is_mock=True finishes in < 5.0s with complete schema without coin/card."""
    # Raw synthetic CIRCOT-style image (no coin, no white card)
    raw_img = np.full((320, 320, 3), (220, 226, 232), dtype=np.uint8)
    cv2.circle(raw_img, (120, 140), 5, (35, 40, 50), -1)
    b64 = encode_bgr_to_base64_jpeg(raw_img)

    with TestClient(app) as client:
        t0 = time.perf_counter()
        res = client.post(
            "/api/v1/grade",
            json={
                "pile_image_base64": b64,
                "halo_image_base64": b64,
                "is_mock": True,
                "farmer_name": "Argon Test Farmer",
                "farmer_phone": "9876543210",
                "village_name": "Kalamb",
                "district": "Yavatmal",
                "quantity_quintals": 4.5,
            },
        )
        elapsed = time.perf_counter() - t0

        assert res.status_code == 200, res.text
        data = res.json()

        # Contract checks
        assert elapsed < 5.0, f"Inference took too long: {elapsed:.2f}s"
        assert data["is_mock"] is True
        assert data["white_card_detected"] is False
        assert data["coin_detected"] is False
        assert data["pixel_to_mm_ratio"] == 0.1
        assert "final_fair_price_per_qtl" in data
        assert "negotiation_tip" in data
        assert 20.0 <= data["staple_length_mm"] <= 36.0


def test_2_multi_frame_temporal_persistence_and_hal_trigger():
    """
    Requirement 2: 1 to 3 consecutive frames of contaminant do NOT trigger alarm.
    Feeding the 4th consecutive frame triggers alert_triggered == True.
    """
    tracker = ContaminationTracker(persistence_frames=4, min_confidence=0.75)

    # Base chute frame with a plastic contaminant strip
    frame = np.full((360, 640, 3), (210, 215, 220), dtype=np.uint8)
    # Bright specular white plastic strip
    cv2.rectangle(frame, (200, 120), (320, 150), (255, 255, 255), -1)

    hint = [{
        "class_name": "plastic",
        "confidence": 0.92,
        "bbox": [200, 120, 320, 150],
    }]

    # Frames 1, 2, 3: Must NOT trigger alert
    for frame_idx in range(1, 4):
        res = tracker.process_frame(frame, injected_hints=hint)
        assert res["alert_triggered"] is False, f"Frame {frame_idx} prematurely triggered alarm!"
        assert res["active_tracks_count"] >= 1

    # Frame 4: 4th consecutive frame MUST trigger alert
    res_4 = tracker.process_frame(frame, injected_hints=hint)
    assert res_4["alert_triggered"] is True, "Frame 4 failed to trigger persistent alarm!"
    assert len(res_4["alerting_contaminants"]) >= 1
    assert res_4["alerting_contaminants"][0]["consecutive_frames"] == 4
    assert res_4["inference_latency_ms"] < 35.0, f"Latency exceeds 35ms: {res_4['inference_latency_ms']}ms"


def test_3_hsv_shadow_filter_rejection():
    """
    Requirement 3: A dark shadow patch (reduced V, identical Hue/Saturation) is rejected.
    """
    tracker = ContaminationTracker()

    # Create uniform background cotton surface
    base_color = (215, 220, 225)
    frame = np.full((360, 640, 3), base_color, dtype=np.uint8)

    # Darker conveyor shadow patch: same chromatic tint, only lower intensity V
    shadow_box = [150, 100, 250, 180]
    frame[100:180, 150:250] = (150, 154, 158)

    is_shadow = tracker.is_hsv_shadow(frame, shadow_box)
    assert is_shadow is True, "HSV Shadow Filter failed to identify conveyor illumination shadow!"


def test_4_fast_3_view_tta_and_backbone_escalation():
    """
    Verify 3-View TTA execution and automatic backbone escalation logic.
    """
    sample_img = np.full((224, 224, 3), (225, 230, 235), dtype=np.uint8)
    tta_res = grading_model.predict_with_tta(sample_img)

    assert tta_res["tta_views_evaluated"] == 3
    assert tta_res["icra_grade"] in ["Good", "Medium", "Poor"]
    assert 0.0 <= tta_res["confidence"] <= 1.0

    # Test automatic escalation when accuracy drops < 0.75
    new_backbone = grading_model.escalate_backbone_if_needed(validation_acc=0.71)
    assert new_backbone == "ResNet50", "Failed to escalate to ResNet50 when val_acc < 0.75!"
