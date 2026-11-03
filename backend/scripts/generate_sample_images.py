"""
Generate realistic, high-resolution sample JPEG images for MVP demo testing:
1. Calibrated Physical Photos (with White Paper Slip + Rs 5 Coin on Cotton)
2. Raw Dataset Images (CIRCOT / Kaggle style without calibration objects for Dataset Mode)
3. Combed Cotton Seed Halo with Rs 5 coin (for Staple measurement)
4. Raw uncalibrated seed cotton fibers for Dataset Mode
5. Ginning Chute Contaminant Test Frames (White PP Plastic, Colored Plastic, Jute Twine)
"""

import sys
from pathlib import Path
import cv2
import numpy as np

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT_DIR / "backend"))

from app.services.cv_grading import generate_synthetic_demo_pair

SAMPLE_DIRS = [
    ROOT_DIR / "sample_inputs",
    ROOT_DIR / "frontend-kisan" / "public" / "sample_inputs",
]

for d in SAMPLE_DIRS:
    d.mkdir(parents=True, exist_ok=True)

# 1. Generate Calibrated Pairs (Preset 1: Kalamb Grade A, Preset 2: Wardha Grade B, Preset 3: Amravati Grade C)
presets = [
    ("kalamb_long_grade_a", "01_calibrated_pile_gradeA_whitecard_coin.jpg", "01_calibrated_halo_rs5coin_28mm.jpg"),
    ("wardha_medium_grade_b", "02_calibrated_pile_gradeB_standard.jpg", "02_calibrated_halo_rs5coin_26mm.jpg"),
    ("amravati_high_trash_dew", "03_calibrated_pile_gradeC_high_trash.jpg", "03_calibrated_halo_rs5coin_24mm.jpg"),
]

for preset_id, pile_name, halo_name in presets:
    pile_bgr, halo_bgr, _ = generate_synthetic_demo_pair(preset_id)
    for d in SAMPLE_DIRS:
        cv2.imwrite(str(d / pile_name), pile_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
        cv2.imwrite(str(d / halo_name), halo_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
    print(f"Saved calibrated pair: {pile_name}, {halo_name}")

# 2. Generate Standard Dataset / CIRCOT / Kaggle Style Images (NO coin, NO white paper - pure cotton bolls/lint)
rng = np.random.default_rng(42)

# 2a. CIRCOT Clean Raw Seed Cotton (Dataset Mode sample)
circot_pile = np.full((480, 640, 3), (228, 234, 238), dtype=np.float32)
noise_f = rng.normal(0, 10, (480, 640)).astype(np.float32)
noise_c = cv2.GaussianBlur(rng.normal(0, 24, (480, 640)).astype(np.float32), (35, 35), 9.0)
circot_pile += (noise_f * 0.4 + noise_c * 1.2)[:, :, None]
# Add natural seed-coat & small trash
for _ in range(45):
    rx, ry = int(rng.integers(30, 610)), int(rng.integers(30, 450))
    cv2.circle(circot_pile, (rx, ry), int(rng.integers(2, 5)), (38, 42, 55), -1)
circot_img = np.clip(circot_pile, 0, 255).astype(np.uint8)

# 2b. Kaggle Style High-Trash Cotton Field Harvest
kaggle_pile = np.full((480, 640, 3), (200, 210, 218), dtype=np.float32)
kaggle_pile += (noise_f * 0.5 + noise_c * 1.4)[:, :, None]
for _ in range(130):
    rx, ry = int(rng.integers(20, 620)), int(rng.integers(20, 460))
    cv2.ellipse(kaggle_pile, (rx, ry), (int(rng.integers(2, 7)), int(rng.integers(2, 5))), float(rng.uniform(0, 180)), 0, 360, (28, 35, 48), -1)
kaggle_img = np.clip(kaggle_pile, 0, 255).astype(np.uint8)

# 2c. Raw Combed Halo on Dark Cloth (CIRCOT lab staple sample without ₹5 coin)
circot_halo = np.full((480, 640, 3), (24, 26, 30), dtype=np.uint8)
cx, cy = 320, 240
# Draw combed fibers radiating outward
halo_overlay = circot_halo.astype(np.float32)
for deg in range(720):
    rad = np.radians(deg * 0.5)
    ext = 20.0 + 115.0 + float(rng.normal(-4, 5))
    x2 = int(cx + ext * np.cos(rad))
    y2 = int(cy + ext * np.sin(rad))
    cv2.line(halo_overlay, (int(cx + 18 * np.cos(rad)), int(cy + 18 * np.sin(rad))), (x2, y2), (230, 235, 240), 2, cv2.LINE_AA)
circot_halo = cv2.GaussianBlur(np.clip(halo_overlay, 0, 255).astype(np.uint8), (3, 3), 0.7)
cv2.circle(circot_halo, (cx, cy), 18, (32, 35, 42), -1)

dataset_samples = [
    ("04_circot_dataset_clean_seed_cotton.jpg", circot_img),
    ("05_kaggle_dataset_high_trash_field_cotton.jpg", kaggle_img),
    ("06_circot_dataset_combed_halo_pure.jpg", circot_halo),
]

for name, img in dataset_samples:
    for d in SAMPLE_DIRS:
        cv2.imwrite(str(d / name), img, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
    print(f"Saved dataset sample: {name}")

# 3. Ginning Chute Contaminant Test Frames (for Ginner Console live testing)
chute_base = np.full((360, 640, 3), (210, 214, 218), dtype=np.uint8)
# Add moving lint texture
for _ in range(35):
    tx, ty = int(rng.integers(30, 610)), int(rng.integers(10, 350))
    cv2.ellipse(chute_base, (tx, ty), (35, 18), 0, 0, 360, (225, 228, 232), -1)

# 3a. White PP fertilizer bag shred on chute
frame_white_pp = chute_base.copy()
cv2.rectangle(frame_white_pp, (210, 110), (340, 142), (255, 255, 255), -1)
cv2.rectangle(frame_white_pp, (210, 110), (340, 142), (240, 245, 255), 2)

# 3b. Colored plastic wrapper + jute twine on chute
frame_colored_jute = chute_base.copy()
cv2.rectangle(frame_colored_jute, (380, 180), (455, 230), (235, 45, 25), -1) # Colored blue/red wrapper
cv2.line(frame_colored_jute, (130, 140), (240, 165), (42, 110, 165), 8)     # Jute twine

ginner_samples = [
    ("07_ginner_chute_white_pp_plastic_contaminant.jpg", frame_white_pp),
    ("08_ginner_chute_colored_plastic_and_jute_contaminants.jpg", frame_colored_jute),
]

for name, img in ginner_samples:
    for d in SAMPLE_DIRS:
        cv2.imwrite(str(d / name), img, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
    print(f"Saved ginner sample: {name}")

print("\nAll sample images successfully written to sample_inputs/ and frontend-kisan/public/sample_inputs/!")
