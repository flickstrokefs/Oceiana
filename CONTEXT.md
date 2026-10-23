# CONTEXT.md — Project Overview (Updated 2026-10-23)

## What this project is

**Oceiana** — an honest, real-data ocean reporting tool for the **Bay of Bengal**.
Built for AIU Anveshan 2026-27 and rooted in Smart India Hackathon problem SIH26067
(MoES/INCOIS). The USP is auto-generated, source-cited visual reports on thermal
structure, cyclone heat potential, and fishing conditions, using real in-situ observations.

## Current state (verified by running code)

This project has BOTH a backend and a frontend. The statement "there is no backend"
in the old CONTEXT.md was written during the prototype phase and is now out of date.

**Backend** (`backend/`): FastAPI (Python 3.13), serving real Argo observations and
IFREMER glider data. Scientific processing (TEOS-10, vertical gradients, standardization)
is implemented and tested. 33 pytest tests pass.

**Frontend** (`frontend/`): React + TypeScript + Vite + CesiumJS. 3D globe displays
real Argo float positions and IFREMER glider trajectories.

## Real data in this repo (verified)

| Dataset | File | N obs |
|---------|------|-------|
| Argo Bay of Bengal, Jan 2020 | `data/raw/argo_bay_of_bengal_2020-01-01_2020-02-01.nc` | 9,124 rows / 51 profiles / 10 floats |
| IFREMER glider missions | `backend/storage/cache/glider_*.json` | ~30 missions cached |

Source: Ifremer ERDDAP (DOI 10.17882/42182), IFREMER OceanGliders GDAC.

## What is NOT real yet (honest list)

- Ocean field mesh (temperature/salinity colour overlay on the globe): uses
  trigonometric placeholder formulas in `MockOceanProvider.ts`. Labelled SYNTHETIC.
  Will be replaced by CMEMS forecast data in Phase 3.
- Hazard analysis (currents, wave height, SSH): uses the same placeholder formulas.
  Provenance correctly tagged as SYNTHETIC.
- Fishery / PFZ panel: hard-coded placeholder zones. Provenance correctly tagged as SYNTHETIC.
  Will be replaced by real SST/chlorophyll front detection in Phase 4.
- No forecast data from CMEMS yet. Phase 3 will add the copernicusmarine fetch.

## Stack

- Backend: FastAPI, xarray, gsw, pandas, scipy, argopy
- Frontend: React + TypeScript + Vite + CesiumJS (Cesium Ion token required)
- Python: 3.13, managed by uv in `backend/.venv`

## Target region

Bay of Bengal first (5-23 deg N, 80-100 deg E). Arabian Sea only after BoB is done.
Southern Ocean dropped from user-facing scope.

## Running locally

```
# Backend
cd backend
.venv\Scripts\uvicorn app.main:app --reload

# Frontend (separate terminal)
cd frontend
npm run dev
```

## Project phases

Phase 0 (done): Audit — real vs synthetic inventory, docs/AUDIT.md written.
Phase 1 (done): Remove falsehoods — provenance lies fixed, mislabelled files deleted,
  sampleNodes removed, import paths corrected.
Phase 2: Real data fetcher layer (argo_fetch.py, cmems_fetch.py, sst_chl_fetch.py).
Phase 3: Scientific products (MLD, D26, TCHP, fronts, thermocline, validation).
Phase 4: Visual reports (thermal / cyclone_heat / fishing / forecast_vs_obs).
Phase 5: Globe/map layer integration.
Phase 6: Offline packaging for competition demo.

## Rules (non-negotiable)

1. No fabricated numbers in the UI. Every number must come from a real file or API.
2. Provenance on everything: REAL | DERIVED | SIMULATED | SYNTHETIC.
3. No unsourced claims. No "50% fuel saving", no arbitrary RMSE figures.
4. This is NOT a forecast system. We fetch and present CMEMS operational forecasts.
5. Offline must work. Every fetcher caches to disk.
