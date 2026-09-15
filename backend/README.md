# OCEAN-X / ARIEL — Scientific Oceanographic Backend

Production-grade FastAPI backend developed for **Smart India Hackathon (SIH 2026)** problem statement **SIH26067**:
> **“Interactive 3D Visualization Platform Integrating Numerical Ocean Models and In-Situ Observations”**  
> *Sponsoring Ministry: Ministry of Earth Sciences (MoES) / INCOIS Ocean Valley*

---

## 1. System Overview

The backend integrates numerical ocean model fields (ROMS, IOCM, HCOM) with in-situ observations (Argo profiling floats, autonomous gliders, CTD/BGC soundings). It computes Thermodynamic Equation Of Seawater 2010 (**TEOS-10**) derived properties (`SA`, `CT`, `SIGMA0`), vertical gradients, horizontal depth slices, particle current flow vectors, dynamic marine hazard exceedances, and potential fishing zone (PFZ) advisories.

---

## 2. Prerequisites & Installation

### Prerequisites
- Python 3.11+ (Tested on Python 3.13)
- Node.js 18+ (for frontend)

### Backend Installation
```bash
cd backend
pip install -r requirements.txt
pip install xarray netCDF4 h5netcdf gsw pydantic-settings python-multipart
```

---

## 3. Environment Configuration

Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Key environment settings:
```ini
ENVIRONMENT=production
DEBUG=false
API_HOST=0.0.0.0
API_PORT=8000
API_BASE_PATH=/api
CORS_ORIGINS=["http://localhost:5173", "http://localhost:3000", "*"]
DATA_ROOT=./data
RAW_DATA_ROOT=./data/raw
PROCESSED_DATA_ROOT=./data/processed
STORAGE_UPLOADS=./storage/uploads
STORAGE_CACHE=./storage/cache
INCOIS_API_URL=https://data.incois.gov.in/api
```

---

## 4. Running the Backend

Launch with Uvicorn:
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
or run directly:
```bash
python main.py
```

API Documentation will be live at:
- **Swagger UI**: `http://localhost:8000/api/docs`
- **ReDoc**: `http://localhost:8000/api/redoc`
- **OpenAPI Schema**: `http://localhost:8000/api/openapi.json`

---

## 5. Dataset Setup & Scientific Pipeline

The repository includes real ocean observations:
- `data/raw/argo_bay_of_bengal_2020-01-01_2020-02-01.nc`: 9,124 raw in-situ observations from IFREMER/INCOIS ERDDAP.
- `backend/data/raw/argo_bay_of_bengal_2020-01-01_2020-01-05.csv`: Validated raw observations.

To re-run the offline batch standardization and TEOS-10 calculation:
```bash
python run_pipeline.py
```
This performs:
1. Pressure standardization onto a uniform 10 dbar grid.
2. TEOS-10 thermodynamic seawater calculations (`SA`, `CT`, `SIGMA0`) via `gsw`.
3. Vertical gradient calculations ($dT/dz$, $dS/dz$, $d\rho/dz$).
4. Serializing products to `backend/data/processed/`.

---

## 6. Testing

Execute the automated test suite:
```bash
pytest tests/ -v
```

The test suite validates:
- Unit parsing & QC range checks (`tests/test_parsers.py`)
- Standardizer & TEOS-10 algorithms
- Argo discovery, profiles, and depth queries (`tests/test_api_endpoints.py`)
- Webpage 2 Observation Profile modal contract (Model vs Glider vs Argo across 10 depth strata)
- Ocean depth slices and particle velocity vectors
- Calculated marine hazard exceedances
- Fishery advisory engine
- File upload & background processing job pipeline (`tests/test_upload_integration.py`)

---

## 7. Frontend Connection

1. Start backend on `http://localhost:8000`.
2. In `frontend/`, run `npm run dev`. Vite will automatically proxy all `/api/*` calls to the FastAPI backend.
3. Every view (`3D Ocean`, `Observation Profile`, `Data Manager`, `Hazard Assessment`, `Fishery Advisories`, `Search`, `Settings`, `Public View`) connects directly to the live backend.

---

## 8. Known Limitations & Future Extensibility
- Real-time external INCOIS ERDDAP live syncing requires public network connectivity. Local real NetCDF and CSV datasets are used offline.
- Very large NetCDF files (>10GB) should be converted to Zarr or chunked xarray stores for distributed cloud scaling.
