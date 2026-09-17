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
      "region": "Indian Ocean",
      "time": "2024-09-12T00:00:00Z"
    }
    ```
  - **Response**:
    ```json
    {
      "variable": "Current Speed (m/s)",
      "threshold": 1.5,
      "total_exceedance_area_km2": 435000.0,
      "max_value": 2.5,
      "unit": "m/s",
      "regions": [
        { "name": "North Arabian Sea", "area": "125,000", "maxValue": "2.4", "risk_level": "HIGH" },
        { "name": "Bay of Bengal", "area": "98,000", "maxValue": "2.1", "risk_level": "MODERATE" },
        { "name": "Lakshadweep", "area": "62,000", "maxValue": "1.8", "risk_level": "MODERATE" },
        { "name": "Andaman Sea", "area": "40,000", "maxValue": "1.7", "risk_level": "LOW" },
        { "name": "Equatorial IO", "area": "110,000", "maxValue": "2.5", "risk_level": "HIGH" }
      ],
      "provenance": "REAL"
    }
    ```

---

### 2.8 Fishery Advisories & Potential Fishing Zones (PFZ)
- `GET /api/fishery/advisory`
  - **Query Params**: `region`, `variable`, `time_range`
  - **Response**:
    ```json
    {
      "region": "Indian Ocean",
      "generated_date": "12 Sep 2024",
      "conditions": {
        "status": "Favourable Conditions",
        "chlorophyll_range": "0.3 – 2.5 mg/m³",
        "sst_range": "26 – 29 °C",
        "current_state": "Moderate (0.4 – 0.8 m/s)"
      },
      "recommended_zones": [
        { "name": "Eastern Arabian Sea", "status": "High productivity (thermal front)", "rating": "HIGH", "lat": 15.2, "lon": 72.8 },
        { "name": "Persian Bay of Bengal", "status": "Good conditions", "rating": "GOOD", "lat": 18.4, "lon": 86.1 },
        { "name": "Western Bay of Bengal", "status": "Good conditions", "rating": "GOOD", "lat": 13.5, "lon": 81.2 },
        { "name": "Equatorial Indian Ocean", "status": "Moderate conditions", "rating": "MODERATE", "lat": 2.1, "lon": 78.0 }
      ],
      "provenance": "DERIVED"
    }
    ```
- `GET /api/fishery/pfz`
  - **Description**: Vector feature coordinates of high biological productivity blooms and thermal fronts.

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
