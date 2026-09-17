# OCEAN-X / ARIEL — BACKEND ARCHITECTURE
**System Architecture & Scientific Engineering Design**  
**SIH Problem Statement 26067:** Interactive 3D Visualization Platform Integrating Numerical Ocean Models and In-Situ Observations  
**Sponsoring Body:** Ministry of Earth Sciences (MoES) / INCOIS Ocean Valley  

---

## 1. Architectural Philosophy

The OCEAN-X / ARIEL backend is engineered around three core physical and computational realities:
1. **Multidimensional Scientific Data**: Ocean data exists in 4D space-time: $\mathcal{F}(\text{lat}, \text{lon}, \text{depth}, \text{time}) \to (\text{temp}, \text{salinity}, \vec{V}, \text{chl}, \dots)$. We use `xarray` and `numpy` as first-class multidimensional abstractions.
2. **Strict Provenance Integrity**: Scientific decisions rely on knowing whether a value is `REAL` (measured), `DERIVED` (calculated via thermodynamic formulas such as TEOS-10), or `SIMULATED` (numerical model output). Mocks are banned from production endpoints.
3. **Decoupled Frontend Contract**: The frontend's Cesium WebGL globe and 2D analytical overlays require slicing, downsampling, and JSON serialization without sending multi-gigabyte files to the browser.

---

## 2. Layered Component Architecture

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                          FASTAPI APPLICATION LAYER                          │
│  - FastAPI 0.135+ with Starlette ASGI & Uvicorn                             │
│  - Strict Pydantic v2 validation models & OpenAPI 3.1 documentation        │
│  - Asynchronous streaming & non-blocking execution                         │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                ┌──────────────────────┴──────────────────────┐
                ▼                                             ▼
┌──────────────────────────────┐              ┌──────────────────────────────┐
│       API ROUTERS LAYER      │              │      STORAGE & REGISTRY      │
│  - api.argo                  │              │  - SQLite / JSON metadata    │
│  - api.observations          │              │  - storage/raw (NetCDF/CSV)  │
│  - api.gliders               │              │  - storage/processed         │
│  - api.ocean (slices/volume) │              │  - In-memory LRU cache       │
│  - api.datasets (manager)    │              └──────────────┬───────────────┘
│  - api.hazard                │                             │
│  - api.fishery               │                             │
│  - api.search                │                             │
│  - api.system                │                             │
└──────────────┬───────────────┘                             │
               │                                             │
               ▼                                             ▼
┌──────────────────────────────┐              ┌──────────────────────────────┐
│        SERVICES LAYER        │◄─────────────┤     PROCESSING PIPELINE      │
│  - argo_service              │              │  - NetCDF Parser (xarray)    │
│  - observation_service       │              │  - CSV / CTD Parser          │
│  - model_service             │              │  - CF-Conventions Mapper     │
│  - ocean_field_service       │              │  - Standard 10 dbar Gridding │
│  - hazard_service            │              │  - TEOS-10 (gsw: SA, CT, rho)│
│  - fishery_service           │              │  - Vertical Gradients        │
│  - dataset_service           │              │  - QC & Range Validators     │
└──────────────────────────────┘              └──────────────────────────────┘
```

---

## 3. Directory Layout & Module Responsibilities

```text
backend/
├── app/
│   ├── main.py                     # App factory, CORS, exception handlers, router registry
│   ├── core/
│   │   ├── config.py               # Pydantic Settings (ENV, paths, limits)
│   │   ├── logging.py              # Structured logging configuration
│   │   ├── errors.py               # Scientific & HTTP domain exceptions
│   │   └── cache.py                # In-memory LRU cache with hash keys
│   ├── schemas/                    # Pydantic v2 data models for request/response
│   │   ├── common.py
│   │   ├── argo.py
│   │   ├── observation.py
│   │   ├── ocean.py
│   │   ├── dataset.py
│   │   ├── hazard.py
│   │   └── fishery.py
│   ├── processing/                 # Scientific parsers, gridding, algorithms
│   │   ├── netcdf_parser.py        # CF-compliant xarray parser with alias mapping
│   │   ├── csv_parser.py           # Robust delimited ASCII / CSV parser
│   │   ├── standardizer.py         # Pressure gridding & linear interpolation
│   │   ├── teos10.py               # Thermodynamic Equation Of Seawater 2010 (gsw)
│   │   ├── gradients.py            # Vertical gradient computation (dT/dz, dS/dz, dρ/dz)
│   │   └── quality_control.py      # Range checks, coordinate validation, flag handlers
│   ├── services/                   # Business logic and data aggregation
│   │   ├── argo_service.py         # Real Argo float query and profiling engine
│   │   ├── observation_service.py  # Model vs Glider vs Argo composite engine
│   │   ├── model_service.py        # Numerical model slicing & field extraction
│   │   ├── ocean_service.py        # Generic parameter, depth-slice & volume service
│   │   ├── hazard_service.py       # Exceedance area and risk calculation
│   │   ├── fishery_service.py      # PFZ identification and advisory compilation
│   │   ├── dataset_service.py      # Dataset registry & ingestion orchestration
│   │   └── search_service.py       # Multi-entity catalog search
│   └── api/                        # HTTP route handlers
│       ├── system.py
│       ├── argo.py
│       ├── observations.py
│       ├── gliders.py
│       ├── ocean.py
│       ├── datasets.py
│       ├── hazard.py
│       ├── fishery.py
│       └── search.py
├── data/
│   ├── raw/                        # Original NetCDF and CSV files
│   └── processed/                  # Standardized, derived, and gridded products
├── tests/                          # Automated pytest suite
│   ├── test_parsers.py
│   ├── test_argo_service.py
│   ├── test_observations_api.py
│   ├── test_ocean_api.py
│   ├── test_hazard_fishery.py
│   └── test_frontend_contract.py
├── data_service.py                 # Preserved backward-compatible facade
├── ariel_observations.py           # Preserved backward-compatible facade
├── main.py                         # Root entry point delegating to app.main
└── requirements.txt
```

---

## 4. Scientific Ingestion & Standardization Pipeline

```text
[Raw NetCDF / CSV / CTD]
         │
         ▼
[Format & Schema Inspection] ──► Inspect dimensions, coordinates, CF variable aliases
         │
         ▼
[Quality Control Filtering]  ──► Validate: lat ∈ [-90, 90], lon ∈ [-180, 180], pres ≥ 0, drop NaNs
         │
         ▼
[Profile Grouping & Index]   ──► Profile ID assignment by (platform, cycle) or (lat, lon, time)
         │
         ▼
[Standard Pressure Gridding] ──► 10 dbar interval interpolation across observed bounds
         │
         ▼
[TEOS-10 Thermodynamic Calc] ──► gsw.SA_from_SP, gsw.CT_from_t, gsw.sigma0
         │
         ▼
[Vertical Gradient Engine]   ──► Central differences: dT/dz, dS/dz, dρ/dz
         │
         ▼
[Indexed Scientific Store]   ──► SQLite Metadata Registry + xarray Datasets for fast slice
```

---

## 5. Performance, Chunking & Downsampling Strategy

1. **Spatial Bounding**: All spatial queries apply index-assisted bounding-box filters before extracting values.
2. **Adaptive Striding / Downsampling**: When the Cesium client requests a large geographic extent, the backend applies coordinate decimation (`slice(None, None, step)`) to maintain fast sub-100ms response times.
3. **Lazy xarray Processing**: NetCDF files are opened with open-on-demand mechanics rather than reading the entire array into RAM.
4. **Fast In-Memory Caching**: Frequently accessed depth slices (e.g. 0m, 50m, 100m, 500m, 1000m) are cached using LRU memory stores keyed by `(parameter, depth, time_bucket, bbox)`.
