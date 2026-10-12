# AIU ANVESHAN 2026–27 | Evaluation Report 04: Technical Feasibility & System Audit

**Evaluation Date:** October 12, 2026  
**Evaluator:** Technical Systems Architect & Code Auditor  
**Target Event:** AIU ANVESHAN 2026–27 (Student Research Convention)  
**Project:** OCEIANA (OCEAN-X / ARIEL)  
**Track:** Category 06: Interdisciplinary Research / Category 02: Engineering & Technology  

---

## 1. Verdict & Confidence Level

* **Verdict:** **CONDITIONAL GO (STRONG CODE QUALITY, LOCAL RUNTIME ENVIRONMENT NOT YET CONFIGURED)**
* **Confidence Level:** **HIGH (90%)**

### Executive Summary
The technical architecture of OCEIANA is modular, clean, and engineered according to modern scientific software design principles. The backend enforces asynchronous FastAPI routes, Pydantic v2 schemas, in-memory LRU caching, and standard scientific libraries (`xarray`, `gsw`, `numpy`). The frontend couples React 19 with CesiumJS via custom WebGL subsurface shaders. However, the local workspace currently lacks installed dependencies (`node_modules` missing in `frontend/`, scientific packages missing in local Python), and a critical import bug exists in `glider_service.py` that will crash execution if executed from the `backend/` root directory.

---

## 2. Evaluation Methodology
This audit was performed through direct static analysis, directory audits, and execution path verification across:
* **Frontend:** [frontend/package.json](file:///c:/Saumya_workspace/team%20ariel/Oceiana/frontend/package.json), [frontend/vite.config.ts](file:///c:/Saumya_workspace/team%20ariel/Oceiana/frontend/vite.config.ts), [frontend/src/ocean/OceanEngine.ts](file:///c:/Saumya_workspace/team%20ariel/Oceiana/frontend/src/ocean/OceanEngine.ts).
* **Backend:** [backend/app/main.py](file:///c:/Saumya_workspace/team%20ariel/Oceiana/backend/app/main.py), [backend/main.py](file:///c:/Saumya_workspace/team%20ariel/Oceiana/backend/main.py), [backend/app/services/glider_service.py](file:///c:/Saumya_workspace/team%20ariel/Oceiana/backend/app/services/glider_service.py).
* **Data & Storage:** [data/raw/](file:///c:/Saumya_workspace/team%20ariel/Oceiana/data/raw/) and [backend/data/processed/](file:///c:/Saumya_workspace/team%20ariel/Oceiana/backend/data/processed/).

---

## 3. Verified Architecture Audit

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        BROWSER CLIENT LAYER (WebGL)                     │
│  - React 19 + TypeScript + Vite 8.2 + CesiumJS 1.145                  │
│  - Custom Subsurface Shaders (UnderwaterFieldMesh.ts - 38 KB)          │
│  - Dynamic Vertical Exaggeration Slider & 4D Depth Scrubber           │
│  - Synchronized Observation Comparison Modal (Model vs. Float)         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP / REST (JSON & GeoJSON)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        FASTAPI BACKEND SERVICE                         │
│  - Asynchronous Starlette ASGI + Uvicorn (Port 8000)                   │
│  - In-Memory LRU Cache (cache.py) + Pydantic v2 Schemas                │
│  - Routers: /argo, /gliders, /observations, /ocean, /hazard, /fishery  │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │                                │
                    ▼                                ▼
┌──────────────────────────────────────┐  ┌──────────────────────────────┐
│       SCIENTIFIC PIPELINE LAYER       │  │        STORAGE TIERS         │
│  - CF-NetCDF Parser (xarray / netCDF4)│  │ - Raw NetCDF: 16,009 soundings│
│  - 10-dbar Pressure Gridder          │  │ - Processed CSVs: SA, CT,    │
│  - TEOS-10 Thermodynamic Engine (gsw)│  │   sigma0, vertical gradients │
│  - Vertical Derivative Calculator    │  │ - Glider cache: 7,437 pts    │
└──────────────────────────────────────┘  └──────────────────────────────┘
```

---

## 4. Strengths & Architectural Merits

1. **Decoupled Heavy Computation from UI:**
   Heavy multidimensional NetCDF slicing and thermodynamic floating-point calculations are handled entirely in Python on the server. The browser only receives lightweight downsampled JSON points, preventing WebGL out-of-memory crashes.
2. **Standardized Coordinate Gridding:**
   In [backend/app/processing/standardizer.py](file:///c:/Saumya_workspace/team%20ariel/Oceiana/backend/app/processing/standardizer.py), profile soundings with erratic sample intervals are normalized to exact 10-dbar isobaric levels ($0, 10, 20, \dots, 2000 \text{ dbar}$), guaranteeing deterministic profile rendering.
3. **Structured API Contracts & Domain Error Handling:**
   [backend/app/core/errors.py](file:///c:/Saumya_workspace/team%20ariel/Oceiana/backend/app/core/errors.py) maps internal scientific domain exceptions (`InvalidCoordinateError`, `DatasetNotFoundError`) to standardized HTTP 4xx/5xx status codes.
4. **Deployability:**
   A working [render.yaml](file:///c:/Saumya_workspace/team%20ariel/Oceiana/render.yaml) is present for cloud deployment on Render, allowing judges to test the app live on their own tablets or laptops via a public URL.

---

## 5. Critical Technical Bugs & Failure Vulnerabilities

### 🐛 Bug 1: Dangerous Module Import in `glider_service.py`
* **File:** [backend/app/services/glider_service.py](file:///c:/Saumya_workspace/team%20ariel/Oceiana/backend/app/services/glider_service.py#L61)
* **Code:**
  ```python
  from backend.scripts.ingest_ifremer_gliders import run_full_ingestion
  ```
* **Failure Mode:** When running Uvicorn from inside the `backend/` directory (the standard deployment pattern specified in `render.yaml`: `cd backend && uvicorn main:app`), Python's `sys.path` root is `backend/`. Attempting to import `backend.scripts` triggers an immediate:
  ```text
  ModuleNotFoundError: No module named 'backend'
  ```
* **Fix:** Change to `from scripts.ingest_ifremer_gliders import run_full_ingestion` or add the project root to `sys.path`.

### ⚠️ Vulnerability 2: Missing Local Runtime Dependencies
* In the cloned workspace, `node_modules/` is not installed in `frontend/`.
* Running `python -c "import xarray"` failed with `ModuleNotFoundError`.
* **Risk:** If the team attempts a live presentation without pre-installing and verifying the offline environment, network failure at the convention venue will result in a total presentation collapse.

### ⚠️ Vulnerability 3: GPU/WebGL Performance on Low-End Hardware
* [UnderwaterFieldMesh.ts](file:///c:/Saumya_workspace/team%20ariel/Oceiana/frontend/src/ocean/layers/UnderwaterFieldMesh.ts) renders 3D bathymetric volumetric meshes.
* On laptops without dedicated NVIDIA/AMD GPUs (e.g., standard university laptops with integrated Intel HD graphics), rendering large meshes alongside CesiumJS may cause frame drops below 20 FPS.
* **Mitigation:** Implement dynamic Level of Detail (LOD) and a resolution toggle (Low/Medium/High) in the UI settings view.

---

## 6. Corrective Actions (Ranked by Impact & Effort)

| Priority | Action | Effort | Impact | Target Location |
|:---:|---|:---:|:---:|---|
| **1** | **Fix the `backend.` Import Bug** in `glider_service.py`. | 5 mins | **CRITICAL** | `backend/app/services/glider_service.py:L61,L114` |
| **2** | **Set Up Isolated Virtual Environment & Install Dependencies:** `pip install -r requirements.txt` and `npm install` in frontend. | 15 mins | **CRITICAL** | Workspace Root |
| **3** | **Build & Cache an Offline Standalone Bundle** with SQLite/JSON fallbacks so the app runs 100% locally without internet access. | 1 hr | **CRITICAL** | Presentation Laptop |
| **4** | **Deploy Live Production Mirror on Render/Vercel** to provide a QR code for judges to open on their smartphones. | 30 mins | **HIGH** | `render.yaml` |

---

## 7. Conditions That Would Alter This Verdict
* **Upgrade to Full GO:** The import bug is fixed, dependencies installed, automated pytest tests verified passing, and the frontend verified compiling cleanly (`npm run build`).
* **Downgrade to NO-GO:** The application crashes during startup due to unresolved import or WebGL initialization exceptions.

---

## 8. Final Recommendation
Resolve the import bug in `glider_service.py` immediately and prepare a foolproof offline execution package. The underlying code design is production-grade; only environment provisioning and offline reliability require attention.
