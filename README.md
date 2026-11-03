# KapasSetu AI — Optical Cotton Assay, Geo-Clustered Mandi & Edge Lint Inspection Suite

> **Bridging Farm-Gate Kapas to Clean Mill Bales via Calibrated Vision & Collective Market Power**  
> **Build Philosophy**: *100% Software-First Execution Today → Plug-and-Play Hardware Upgradation Tomorrow*

---

## 1. What Is KapasSetu AI?

**KapasSetu AI** is a three-sided, software-first B2B2C agricultural quality and trade platform with a built-in **Hardware Abstraction Layer (HAL)** designed for India's cotton ecosystem (starting with Vidarbha's 500,000+ smallholder cotton farmers and 300+ ginning mills):

1. **Calibrated Smartphone Cotton Grader (`frontend-kisan` + `cv_grading.py`)**:
   - **Photo 1 (Bulk Pile + White Paper Slip)**: Detects a plain $5\times 5\text{ cm}$ white paper reference card via OpenCV HSV + smoothness contour scoring, applies a diagonal **Von Kries** white-balance calibration, converts to device-independent **CIE $L^*a^*b^*$**, and computes HVI-equivalent **Reflectance ($Rd$)**, **Yellowness ($+b$)**, and **Adaptive Gaussian Trash %**.
   - **Photo 2 (Combed Seed Halo + ₹5 Coin on Dark Cloth)**: Detects a standard Indian ₹5 coin ($23.0\text{ mm}$ diameter) via `cv2.HoughCircles` to compute exact pixel-to-millimeter scale ($R_{\text{mm/px}} = 23.0 / D_{\text{px}}$), segments the combed cotton seed halo via Otsu thresholding, locates the central seed core, samples **72 radial rays** ($5^\circ$ increments), and outputs the **75th-percentile Upper Half Mean Length (UHML)** in millimeters.
   - **Agronomic Weather Moisture Proxy (`moisture_proxy.py`)**: Combines 2-tap picking/shade-drying inputs with live GPS **Open-Meteo** relative humidity & temperature telemetry (with a `BLE_SENSOR` schema hook for Phase-2 capacitive probes).

2. **Geo-Clustered Virtual Mandi & 2026–27 MSP Pricing Engine (`pricing_engine.py` + `lot_aggregator.py`)**:
   - Computes transparent farm-gate valuation anchored to **2026–27 Indian Cotton MSP** (`₹7,121/qtl` Medium Staple, `₹7,521/qtl` Long Staple $\ge 27.5\text{ mm}$) with exact staple, HVI color grade, trash ($>3\%$), and moisture ($>8\%$) adjustments.
   - Clusters individual $2\text{–}6\text{ quintal}$ farmer harvests within a **$5.0\text{ km}$ spatial radius** (`PostGIS ST_DWithin` or automatic SQLite Haversine fallback) into uniform **$30\text{+ quintal}$ commercial truckloads**, unlocking direct farm-gate pickup bids from ginning mills.

3. **Sub-35ms Edge Lint Contamination Scanner & Virtual PLC HAL (`frontend-ginner` + `lint_inspector.py` + `hal_controller.py`)**:
   - Processes ginning chute video streams at **30 FPS** locally via **YOLOv8n ONNX Runtime** (`models/cotton_contaminant_yolov8n.onnx`) with an automatic **<15ms OpenCV Spectral/Specular/Morphological Edge Detector** out-of-the-box for 5 critical contaminants: `white_pp_plastic`, `colored_plastic`, `jute_twine`, `human_hair_clump`, and `cloth_rag`.
   - Fires native browser **WebAudio API 880Hz/660Hz industrial sirens** + red viewport strobe alerts and dispatches standardized **`KAPASSETU_HAL_V1`** JSON payloads (`POST /api/v1/hal/actuator-trigger`) to halt the Virtual PLC Feeder Conveyor (`RELAY_CH1_24V_NC`) and fire the 8-bar Pneumatic Air-Jet Diverter (`SOLENOID_CH2_8BAR`) — ready for Phase-2 ESP32 / Jetson Orin 24V relays with zero code changes.

---

## 2. Monorepo Structure

```text
KapasSetu AI/
├── docker-compose.yml              # PostGIS 15-3.3, Redis 7, FastAPI Backend, Both React Frontends
├── start-dev.ps1                   # Instant local launcher (SQLite + Haversine fallback, zero Docker needed)
├── backend/                        # Python 3.11 + FastAPI + OpenCV + ONNX Runtime + SQLAlchemy/GeoAlchemy2
│   ├── app/
│   │   ├── main.py                 # FastAPI entrypoint, CORS, Vidarbha ecosystem seeder
│   │   ├── config.py               # MSP constants, spatial radii, HAL thresholds
│   │   ├── database.py             # PostGIS primary + automatic SQLite fallback
│   │   ├── models.py               # Farmer, CottonAssay, VillagePool, MillBid, HalActuatorEvent
│   │   ├── schemas.py              # Pydantic v2 validation contracts
│   │   ├── services/
│   │   │   ├── cv_grading.py       # White-Card Von Kries L*a*b* + Rs 5 Coin 72-Ray Halo Engine
│   │   │   ├── moisture_proxy.py   # Open-Meteo API + Agronomic / BLE Moisture Estimator
│   │   │   ├── pricing_engine.py   # 2026-27 MSP & Mandi Fair Valuation Engine
│   │   │   ├── lot_aggregator.py   # PostGIS ST_DWithin / Haversine 5km Pool Clustering
│   │   │   ├── lint_inspector.py   # YOLOv8n ONNX + <15ms Spectral-Morphological Fallback
│   │   │   └── hal_controller.py   # KAPASSETU_HAL_V1 Virtual PLC State Machine & WS Bus
│   │   └── routers/
│   │       ├── grading.py          # /api/v1/grade/analyze, /samples, /assays
│   │       ├── marketplace.py      # /api/v1/lots/pools, /join-pool, /pools/{id}/bid, /bids/{id}/accept
│   │       └── ginner_hal.py       # /ws/ginner/stream, /api/v1/hal/actuator-trigger, /reset-line
│   └── tests/
│       └── test_kapassetu_e2e.py   # Automated pytest verification for Fixes 1, 2, and 3
├── frontend-kisan/                 # Farmer & FPO Mobile-First PWA (EN / मराठी / हिन्दी, Port 5173)
└── frontend-ginner/                # Gin Mill B2B Inspection & Lot Bidding Console (Port 5174)
```

---

## 3. Quick Start

### Option A: Instant Local Run (Zero Docker Required — Runs in 5 Seconds)
```powershell
.\start-dev.ps1
```
Or start services individually:
```powershell
# 1. Backend (:8000)
cd backend
.\.venv\Scripts\uvicorn.exe app.main:app --reload --port 8000

# 2. Farmer Mobile PWA (:5173)
cd frontend-kisan
npm run dev

# 3. Ginner B2B Console (:5174)
cd frontend-ginner
npm run dev
```

### Option B: Full Docker + PostgreSQL/PostGIS Stack
```powershell
docker compose up --build
```

---

## 4. Judge & Investor Live Demo Walkthrough

1. **Prove Fix 1 (Optical Physics Calibrated)**: Open **Farmer PWA (`http://localhost:5173`)**, switch languages (**English | मराठी | हिन्दी**), pick **Kalamb Long Staple**, or capture a live photo using the on-screen White Card & ₹5 Coin SVG targets. Click **Generate HVI Assay & MSP Fair Price** to inspect the green/cyan OpenCV verification overlays (`Rd`, `+b`, `23.0mm` coin circle, and 75th-percentile radial fiber halo).
2. **Prove Fix 2 (Collective Bargaining Power)**: Set batch quantity to `4.5 Quintals` and tap **Add My 4.5 Quintals to Village Pool (5 km Radius)**. Watch **Kalamb Cluster** jump from `26.0` to `30.5 / 30.0 Quintals`, automatically flipping to `READY_FOR_BIDDING` and alerting **Ginner Console (`http://localhost:5174`)** over WebSockets! Submit a direct pickup bid from the Ginner Console (with automatic middleman commission ROI math) and accept it in 1 tap on the Farmer PWA.
3. **Prove Fix 3 (Sub-35ms Mill Speed & Phase-2 HAL)**: On **Ginner Console (`http://localhost:5174`)**, click **+ White PP Plastic** or **+ Colored Plastic** to inject a contaminant into the 30 FPS lint chute. Within `<35 ms`, bounding boxes render, the native WebAudio 880Hz klaxon siren sounds, the **Virtual PLC Feeder Conveyor** halts (`RELAY_CH1_24V_NC`), the **8-Bar Air-Jet Valve** fires (`SOLENOID_CH2_8BAR`), and the live `KAPASSETU_HAL_V1` JSON webhook payload streams in the terminal.

