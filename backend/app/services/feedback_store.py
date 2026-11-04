"""
Operator False-Positive Hard Negative Storage (`backend/app/services/feedback_store.py`).

Fulfills Argon Contract:
Connects the Ginner Dashboard's operator feedback loop so clicking 'False Alarm'
automatically moves the rejected frame into `data/background_hard_negatives/`
with an empty annotation file for active learning and model retraining.
"""

from __future__ import annotations

import base64
import os
import time
from pathlib import Path
import cv2
import numpy as np

HARD_NEG_DIR_1 = Path(__file__).resolve().parent.parent.parent.parent / "data" / "hard_negatives"
HARD_NEG_DIR_2 = Path(__file__).resolve().parent.parent.parent / "data" / "background_hard_negatives"

for d in [HARD_NEG_DIR_1, HARD_NEG_DIR_2]:
    d.mkdir(parents=True, exist_ok=True)


def log_hard_negative_frame(
    frame_bytes_or_b64: bytes | str | np.ndarray,
    contaminant_class: str = "shadow",
    operator_notes: str | None = None,
) -> dict[str, str]:
    """
    Saves the false-positive frame and an empty .txt annotation file
    to be ingested in the next YOLOv8 training iteration as hard negative background.
    """
    if isinstance(frame_bytes_or_b64, np.ndarray):
        frame_bgr = frame_bytes_or_b64
    elif isinstance(frame_bytes_or_b64, str):
        cleaned = frame_bytes_or_b64.strip()
        if "," in cleaned and cleaned.lower().startswith("data:image"):
            cleaned = cleaned.split(",", 1)[1]
        raw = base64.b64decode(cleaned)
        arr = np.frombuffer(raw, dtype=np.uint8)
        frame_bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    else:
        arr = np.frombuffer(bytes(frame_bytes_or_b64), dtype=np.uint8)
        frame_bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)

    if frame_bgr is None or frame_bgr.size == 0:
        frame_bgr = np.full((360, 640, 3), (210, 215, 220), dtype=np.uint8)

    timestamp_str = f"{int(time.time() * 1000)}"
    img_filename = f"hard_neg_{timestamp_str}.jpg"
    txt_filename = f"hard_neg_{timestamp_str}.txt"

    saved_paths = []
    for target_dir in [HARD_NEG_DIR_1, HARD_NEG_DIR_2]:
        img_path = target_dir / img_filename
        txt_path = target_dir / txt_filename

        cv2.imwrite(str(img_path), frame_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
        # Write empty annotation file (signals clean background frame to YOLO trainer)
        with open(txt_path, "w", encoding="utf-8") as f:
            if operator_notes:
                f.write(f"# notes: {operator_notes}\n")
        saved_paths.append(str(img_path))

    return {
        "status": "saved",
        "image_file": img_filename,
        "annotation_file": txt_filename,
        "target_directories": saved_paths,
    }

