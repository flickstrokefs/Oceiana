# AUDIT.md — Phase 0 Baseline Audit

**Generated:** 2026-10-23
**Auditor:** Antigravity (automated + code-verified)
**Purpose:** Ground-truth inventory of what is real vs synthetic in every backend route and frontend view.

---

## 0. Test baseline (evidence)

```
cd backend && .venv\Scripts\python.exe -m pytest -q
33 passed, 1 warning in 17.41s
```

All 33 tests pass.

---

## 1. Data files inventory

### Real data (verified)

| File | Source | Verified content |
|------|--------|-----------------|
| `data/raw/argo_bay_of_bengal_2020-01-01_2020-02-01.nc` | Ifremer ERDDAP, DOI 10.17882/42182 | 9,124 N_POINTS, 51 profiles, 10 floats, lat 10.1-17.1 N, lon 84.0-89.9 E. Jan 2020. REAL |
| `backend/storage/cache/glider_*.json` | IFREMER OceanGliders GDAC | ~30 missions cached. Region labels unverified. REAL-UNVERIFIED-REGION |

### Duplicate / mislabelled files (must be removed)

| File | Problem |
|------|---------|
| `backend/data/raw/argo_bay_of_bengal_2020-01-01_2020-01-05.nc` | Byte-identical to indian_southern_ocean file. Lat range -62.1 to 20.1 N - NOT Bay of Bengal. Only 1,743/16,009 rows in BoB. Name is a lie. |
| `backend/data/raw/argo_indian_southern_ocean_2020-01-01_2020-01-05.nc` | Same file. Also mislabelled. |
| `backend/data/raw/argo_bay_of_bengal_2020-01-01_2020-01-05.csv` | Derived from mislabelled NC. Same problem. |
| `backend/data/raw/argo_indian_southern_ocean_2020-01-01_2020-01-05.csv` | Byte-identical to CSV above. |

Fix in Phase 1: Delete all 4 mislabelled files.

---

## 2. Backend services

### argo_service.py - REAL
- Loads from `data/raw/argo_bay_of_bengal_2020-01-01_2020-02-01.nc` (real Argo).

### glider_service.py - REAL-UNVERIFIED-REGION  
- Loads from IFREMER cache JSON files.
- BUG: Import path `from backend.scripts.ingest_ifremer_gliders` (lines 61, 114) is WRONG. Should be `from scripts.ingest_ifremer_gliders`. Crashes if cache empty.
- Profile fallback (lines 176-184): synthetic T/S formula when no real soundings exist. Must be flagged.

### model_service.py - SYNTHETIC (critical)
- ALL temperature, salinity, currents, chlorophyll, oxygen are hand-written sin/exp formulas.
- No ROMS/CMEMS/INCOIS file loaded. Catalog claims "INCOIS IOCM" - no such file exists.
- provenance="DERIVED" - correct label is "SYNTHETIC".
- T RMSE vs Argo: 2.6 deg C, bias +4 deg C at 200 m.
- Must be removed from all user-facing paths.

### hazard_service.py - SYNTHETIC (critical)
- Calls model_service - inherits synthetic values.
- Wave height: current_speed * 1.8 + 0.4 - invented.
- SSH: 0.12 * (lat/10.0) - 0.05 - invented.
- provenance="REAL" - THIS IS A LIE. Must be corrected.

### fishery_service.py - SYNTHETIC (critical)
- Hard-coded 5 fishing zones with invented lat/lon, chlorophyll, SST, confidence.
- provenance="REAL" on both endpoints - THIS IS A LIE.

### ocean_service.py - SYNTHETIC (critical)
- Depth slices and currents built on model_service - all synthetic.
- Labels output as "DERIVED" - actually "SYNTHETIC".

---

## 3. Frontend components

### argoService.ts - MIXED
- fetchArgoProfiles(): real summaries from backend API. OK.
- sampleNodes (lines 42-50): 7 HARD-CODED fake T/S values attached to every real profile. SYNTHETIC.
- fetchArgoReadings(): real soundings. OK.
- Fix: use fetchArgoReadings to populate nodes.

### gliderService.ts - REAL (with null fallback)
- Fetches from backend API. Real IFREMER data.

### observationService.ts - SYNTHETIC PATH
- Falls back to composeLocalProfile() on any backend error.
- composeLocalProfile -> buildModelProfile -> OceanState.sampleSpatialField -> MockOceanProvider.sampleField -> sine/cosine formulas.
- Model card labeled 'IO-ROMS / mock field' but numbers still shown in UI.
- Static fallback table (lines 295-306): 9 rows of hardcoded numbers.

### MockOceanProvider.ts - SYNTHETIC
- All T, S, currents, chlorophyll: trigonometric formulas.
- 3 hardcoded fake Argo profiles with invented coordinates.
- Default provider in OceanState constructor.

### oceanDepthData.ts - SYNTHETIC
- generateMockOceanDepthPoints(): thermocline equation + sinusoidal noise. No real data.
- loadOceanDepthData(): falls back to mock generator.

### ObservationProfileModal.tsx - MIXED
- Tries real backend first. OK.
- Static fallback table (lines 296-306): 9 hardcoded values shown as model/glider/argo. NOT from data.

---

## 4. Per-view real/synthetic table

| View / Panel | What it shows | Real? | Note |
|---|---|---|---|
| Globe - Argo markers | Profile positions | REAL | Coords from real NetCDF |
| Globe - Argo HUD on click | T/S profile nodes | SYNTHETIC | sampleNodes hard-coded |
| Globe - Glider markers | IFREMER missions | REAL-UNVERIFIED-REGION | Region labels unchecked |
| Globe - Glider profile | T/S (when soundings exist) | REAL | Formula fallback if missing |
| Globe - Ocean field mesh | Temperature/salinity overlay | SYNTHETIC | MockOceanProvider formulas |
| Globe - Currents layer | Current vectors | SYNTHETIC | ModelService formulas |
| Observation Profile Modal | Obs vs Model table | SYNTHETIC | Static fallback or OceanState mock |
| Hazard Analysis panel | Area/risk by region | SYNTHETIC | model_service + invented areas, provenance="REAL" is a lie |
| Fishery / PFZ panel | Zone coordinates, SST, chl | SYNTHETIC | Hard-coded invented values, provenance="REAL" is a lie |
| Data Manager | Dataset list | REAL | Lists actual loaded files |
| Underwater depth view | Volumetric T/S points | SYNTHETIC | generateMockOceanDepthPoints() |

---

## 5. Bugs requiring immediate fix (Phase 1)

1. fishery_service.py L85, L155: provenance="REAL" -> change to "SYNTHETIC"
2. hazard_service.py L140: provenance="REAL" -> change to "SYNTHETIC"
3. glider_service.py L61, L114: wrong import path `from backend.scripts...` -> `from scripts...`
4. argoService.ts L42-50: sampleNodes -> fetch real soundings or show "load profile" on demand
5. ObservationProfileModal.tsx L296-306: static fallback table -> "No data available" message
6. OceanState.ts L62: MockOceanProvider default -> must never appear in user-visible path without DEMO badge
7. Delete 4 mislabelled files in backend/data/raw/ (2020-01-01_2020-01-05 pair)
8. CONTEXT.md: rewrite - there IS a full FastAPI backend
9. data_state.md / README: fix "16,000 soundings" claim - correct BoB file has 9,124 rows, 51 profiles

---

## 6. What is safe / good

| Component | Status |
|---|---|
| backend/app/processing/teos10.py | GOOD - correct TEOS-10 via gsw |
| backend/app/processing/standardizer.py | GOOD - linear interp to 10 dbar |
| backend/app/processing/gradients.py | GOOD - correct vertical gradients |
| backend/app/services/argo_service.py | GOOD - loads real NetCDF |
| data/raw/argo_bay_of_bengal_2020-01-01_2020-02-01.nc | GOOD - 51 real BoB profiles, Jan 2020 |
| backend/storage/cache/glider_*.json | GOOD - IFREMER (region audit pending) |
| 33 pytest tests | ALL PASS |
