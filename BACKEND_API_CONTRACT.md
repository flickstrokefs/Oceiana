# OCEAN-X / ARIEL — BACKEND API CONTRACT SPECIFICATION
**Version:** 2.0.0  
**Target:** INCOIS / MoES SIH Problem Statement SIH26067  
**Contract Status:** Production Specification  

---

## 1. Overview & Core Principles

This document defines the formal REST API contract between the **OCEAN-X / ARIEL** React + TypeScript + CesiumJS frontend and the FastAPI scientific oceanographic backend.

### Data Provenance Rules
Every observation and profile item returned by the API must declare its provenance mode:
1. `REAL`: Direct observation from physical instruments (Argo, Glider, CTD, Mooring) or recorded numerical model NetCDF outputs.
2. `DERIVED`: Scientifically calculated values (TEOS-10 Absolute Salinity, Conservative Temperature, Potential Density Anomaly, vertical gradients, current speed from $u$ and $v$).
3. `SIMULATED`: Calibrated hydrodynamic model proxy where physical data is unobservable. Never silently mixed with `REAL`.

---

## 2. API Endpoints Inventory

### 2.1 System & Health
- `GET /api/health`
  - **Description**: System health, active datasets, engine readiness, and latency check.
  - **Response**: `{ status: "healthy", service: "Ariel Ocean Data API", version: "2.0.0", timestamp: ISO8601, datasets_loaded: int, uptime_seconds: float }`
- `GET /api/metadata`
  - **Description**: Global scientific metadata: supported ocean variables, units, valid ranges, standard depth strata, and instruments.

---

### 2.2 Argo Profiling Floats
- `GET /api/argo`
  - **Description**: Argo dataset summary, spatial bounds, temporal range, and parameter statistics.
- `GET /api/argo/observations`
  - **Query Params**:
    - `limit`: int (default 1000, max 10000)
    - `min_lat`, `max_lat`: float [-90, 90]
    - `min_lon`, `max_lon`: float [-180, 180]
    - `min_pressure`, `max_pressure`: float (dbar)
    - `start_time`, `end_time`: ISO8601
    - `min_temperature`, `max_temperature`: float (°C)
    - `min_salinity`, `max_salinity`: float (PSU)
    - `standardized`: bool (default false, true = 10 dbar grid)
    - `platform_number`: int (optional WMO identifier)
  - **Response**: `{ count: int, standardized: bool, filters: dict, observations: ArgoObservation[] }`
- `GET /api/argo/profiles`
  - **Description**: List distinct Argo profiles with profile metadata (platform number, cycle number, timestamp, coordinates, min/max pressure).
- `GET /api/argo/profiles/{profile_id}`
  - **Description**: Single profile vertical sounding with pressure, temperature, salinity, and QC flags.
- `GET /api/argo/depth`
  - **Description**: Common standard pressure grid levels (0, 10, 20, ... 2000 dbar).

---

### 2.3 Unified In-Situ Observations & Observation Profile (Screen 2)
- `GET /api/observations`
  - **Query Params**: `type` ('argo' | 'glider' | 'all'), `bbox` (minLon,minLat,maxLon,maxLat)
  - **Response**: Array of observation platform summaries with live positions and latest readings.
- `GET /api/observations/{id}`
  - **Description**: Platform metadata, sensor payloads, and mission trajectory.
- `GET /api/observations/{id}/profile`
  - **Query Params**: `type` ('argo' | 'glider')
  - **Mandatory Frontend Contract**: Used by `ObservationProfileModal.tsx`:
    ```json
    {
      "selectedId": "argo-2901633",
      "selectedType": "argo",
      "provenance": "REAL",
      "model": {
        "id": "model-incois-io",
        "label": "INCOIS Regional Ocean Model",
        "sourceType": "model",
        "latitude": 14.5,
        "longitude": 64.2,
        "timestamp": "2024-09-12T14:30:00Z",
        "depth": 2000,
        "status": "Operational",
        "surfaceValues": {
          "temperature": 28.1,
          "salinity": 35.0,
          "currentSpeed": 0.6,
          "chlorophyll": 0.4,
          "oxygen": 4.8
        }
      },
      "glider": { ... },
      "argo": { ... },
      "profile": {
        "depths": [0, 50, 100, 200, 250, 500, 750, 1000, 1500, 2000],
        "model": [ { "depth": 0, "temperature": 28.1, "salinity": 35.0, "currentSpeed": 0.6, "chlorophyll": 0.4, "oxygen": 4.8 }, ... ],
        "glider": [ ... ],
        "argo": [ ... ]
      },
      "availableVariables": ["temperature", "salinity", "currentSpeed", "chlorophyll", "oxygen"]
    }
    ```

---

### 2.4 Autonomous Gliders
- `GET /api/gliders`
  - **Description**: Active glider missions, waypoints count, battery/status, last known position.
- `GET /api/gliders/{id}`
  - **Description**: Metadata, mission details, sensor payload specification.
- `GET /api/gliders/{id}/track`
  - **Description**: 3D trajectory points `(lat, lon, depth, time)` for Cesium polyline trajectory rendering.
- `GET /api/gliders/{id}/profile`
  - **Description**: Most recent dive/climb vertical profile.

---

### 2.5 Numerical Ocean Models
- `GET /api/models`
  - **Description**: Catalog of registered numerical models (e.g., `INCOIS-IOCM`, `INCOIS-HCOM`, `CMEMS-GLOBAL`).
- `GET /api/models/{id}/field`
  - **Query Params**: `variable`, `depth`, `time`, `lat_min`, `lat_max`, `lon_min`, `lon_max`, `step`
- `GET /api/models/{id}/profile`
  - **Query Params**: `lat`, `lon`, `time`
  - **Response**: Vertical column profile from the model grid at `(lat, lon)`.

---

### 2.6 Generic Ocean Field & Depth Slices (3D Workspace)
- `GET /api/ocean/{parameter}`
  - **Parameters**: `temperature`, `salinity`, `currents`, `chlorophyll`
  - **Query Params**: `depth` (meters), `time` (ISO8601), `lat_min`, `lat_max`, `lon_min`, `lon_max`, `resolution` (grid step)
  - **Response**:
    ```json
    {
      "parameter": "temperature",
      "unit": "°C",
      "depth": 500,
      "time": "2024-09-12T00:00:00Z",
      "latitudes": [7.0, 8.0, 9.0, ...],
      "longitudes": [58.0, 59.0, 60.0, ...],
      "values": [[...], [...]],
      "min_val": 10.2,
      "max_val": 18.4,
      "provenance": "REAL"
    }
    ```
- `GET /api/ocean/depth-slice`
  - **Description**: Sliced horizontal field at target depth stratum.
- `GET /api/ocean/currents`
  - **Description**: Horizontal velocity vector field `(u, v, speed, angle)` for Cesium particle flow animation.
- `GET /api/ocean/volume`
  - **Description**: 3D bounding box volumetric sample `(lat × lon × depth)` for isosurface extraction.
- `GET /api/ocean/profile`
  - **Description**: Point vertical sounding at arbitrary `(lat, lon, time)`.
- `GET /api/ocean/timeseries`
  - **Description**: Temporal evolution of a variable at `(lat, lon, depth)`.
- `GET /api/regions/{region_id}/slice`
  - **Description**: Regional slice specifically adhering to `UnderwaterRegionDataProvider.ts` (`arabian-sea`, `central-indian-ocean`, `eastern-indian-ocean`, `western-indian-ocean`).
- `GET /api/ocean-depth-points`
  - **Description**: 3D point cloud matching `oceanDepthData.ts`.

---

### 2.7 Marine Hazard Assessment Engine
- `POST /api/hazard/analyze`
  - **Request Body**:
    ```json
    {
      "variable": "Current Speed (m/s)",
      "threshold": 1.5,
      "region": "Arabian Sea",
      "time_range": "2026-09-18T00:00:00Z"
    }
    ```
  - **Response**:
    ```json
    {
      "variable": "Current Speed (m/s)",
      "threshold": 1.5,
      "region": "Arabian Sea",
      "unit": "m/s",
      "max_value": 2.45,
      "total_area_exceeded_km2": 43500.0,
      "provenance": "MODEL",
      "timestamp": "2026-09-18T06:00:00Z",
      "regions": [
        {
          "name": "North Arabian Sea",
          "region_id": "north_arabian_sea",
          "area_exceeded_km2": 43500.0,
          "total_area_km2": 1820000.0,
          "exceedance_pct": 2.39,
          "max_value": 2.45,
          "threshold": 1.5,
          "unit": "m/s",
          "risk_level": "MODERATE",
          "status": "Localized boundary current jet exceeding operational limits",
          "source": "Copernicus Marine Service (GLORYS12V1)",
          "provenance": "MODEL",
          "timestamp": "2026-09-18T06:00:00Z"
        }
      ],
      "provenance_meta": {
        "provenance": "MODEL",
        "source": "Copernicus Marine Service (E.U. Copernicus Programme)",
        "dataset": "GLOBAL_ANALYSISFORECAST_PHY_001_024",
        "timestamp": "2026-09-18T06:00:00Z",
        "processing_level": "L4 Daily Near-Real-Time Physics Reanalysis/Forecast",
        "resolution": "0.083° (~9 km)",
        "region": "Arabian Sea"
      }
    }
    ```
- `GET /api/hazard/grid`
  - **Query Params**: `variable`, `region`, `threshold` (optional), `time_range` (optional)
  - **Response**: `HazardGridData` with 2D arrays `latitudes`, `longitudes`, `values`, `mask` (boolean exceedance matrix), `exceeded_area_km2`, and full `provenance_meta`.
- `GET /api/hazard/layers`
  - **Response**: Registered ocean hazard layers with operational thresholds and metadata.
- `GET /api/hazard/sources`
  - **Response**: Operational provider catalog metadata (Copernicus GLORYS12V1, Copernicus Wave, NOAA Coral Reef Watch).

---

### 2.8 Fishery Advisories & Potential Fishing Zones (PFZ)
- `GET /api/fishery/advisory`
  - **Query Params**: `region`, `variable`, `time_range`
  - **Response**:
    ```json
    {
      "region": "Arabian Sea",
      "variable": "Chlorophyll (mg/m³)",
      "time_range": "Next 7 days",
      "generated_date": "18 Sep 2026 06:00 UTC",
      "valid_until": "21 Sep 2026 23:59 UTC",
      "provenance": "OFFICIAL",
      "conditions": {
        "chlorophyll_range": "0.15 – 3.52 mg/m³",
        "sst_range": "26.0 – 29.5 °C",
        "current_state": "Moderate (0.2 – 0.8 m/s)",
        "wave_state": "Slight to Moderate (1.5 – 2.6 m)",
        "pfz_count": 14,
        "mean_productivity_score": 72.4,
        "summary_text": "Active coastal thermal/chlorophyll fronts detected along continental shelf."
      },
      "recommended_zones": [
        {
          "id": "pfz-incois-karnataka",
          "name": "Karnataka Coastal Sector PFZ",
          "region": "Arabian Sea",
          "status": "Active Upwelling Front",
          "rating": "VERY_GOOD",
          "chlorophyll_mean": 2.4,
          "sst_mean": 27.5,
          "front_strength": 0.42,
          "current_speed": 0.45,
          "wave_height": 1.6,
          "score": 88.0,
          "confidence": 0.90,
          "is_official": true,
          "sector": "Karnataka Sector",
          "landing_center": "Mangalore (Old Port)",
          "distance_km": 42.0,
          "bearing_deg": 285.0,
          "source": "INCOIS Marine Fisheries Advisory Services (MFAS)",
          "provenance": "OFFICIAL",
          "valid_until": "21 Sep 2026 23:59 UTC"
        }
      ],
      "provenance_meta": { ... }
    }
    ```
- `GET /api/fishery/pfz`
  - **Query Params**: `region`
  - **Response**: Georeferenced coordinates of both official INCOIS PFZs (`provenance: "OFFICIAL"`) and Ocean-X algorithmic front detections (`provenance: "DERIVED"`).
- `GET /api/fishery/grid`
  - **Query Params**: `variable`, `region`, `time_range`
  - **Response**: 2D geospatial raster grid for Chlorophyll, SST, Currents, Wave Height, Thermal Front Gradient, or Productivity Index.
- `GET /api/fishery/pfz/{id}`
  - **Response**: Comprehensive in-situ parameters for single selected PFZ zone.

---

### 2.9 Dataset Manager & Ingestion
- `GET /api/datasets`
  - **Description**: List all registered datasets in system.
- `POST /api/datasets/upload`
  - **Description**: Multipart upload for `.nc`, `.csv`, `.txt` files.
  - **Behavior**: Saves to `storage/raw/`, auto-detects dimensions and coordinates, schedules background validation job.
- `GET /api/datasets/{id}`
  - **Description**: Dataset schema, variables, coordinates, spatial extent, time bounds, attributes.
- `GET /api/datasets/{id}/status`
  - **Description**: Processing status (`UPLOADED`, `PROCESSING`, `READY`, `FAILED`) and error log.
- `POST /api/datasets/{id}/process`
  - **Description**: Run standardization, quality control, and derived parameter generation.
- `DELETE /api/datasets/{id}`
  - **Description**: Removes dataset entry and cached artifacts.

---

### 2.10 Search & Scientific Resources Catalog
- `GET /api/search`
  - **Query Params**: `q`, `type` (model | argo | glider | mooring | all), `region`, `depth_min`, `depth_max`, `time_start`, `time_end`
  - **Response**: Array of searchable resources matching `SearchResourcesView.tsx`.
