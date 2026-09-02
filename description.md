# SIH26067 — Web-Based Interactive 3D Ocean Visualization Platform

**Sponsoring Ministry:** Ministry of Earth Sciences (MoES)
**Department:** Indian National Centre for Ocean Information Services (INCOIS) — Ocean Valley
**Theme:** Disaster Management

---

## 1. Problem (As Officially Stated)

INCOIS generates large volumes of 3D ocean model output (temperature, salinity, currents, chlorophyll) and collects real-time/delayed-mode observations from Argo floats and Gliders — all stored as NetCDF/ASCII across multiple depths, grids, and time steps.

No existing tool lets forecasters co-visualize model fields and in-situ instrument data in one interactive, web-based, 3D environment. Current tools are desktop-bound, 2D-only, or can't overlay instruments on model fields — forcing forecasters to toggle between disconnected software, slowing hazard assessment, search-and-rescue support, fishery advisories, and climate monitoring.

## 2. Our Solution — Scope Correction

**Important framing note:** an earlier draft of this proposal leaned heavily on an analytics/AI layer (anomaly alerts, forecasting, auto-generated insights). Against the official spec, that is not what's being asked for or scored. The official "Core functional requirements" are entirely about **rendering fidelity, instrument overlay, and interactive control** — not predictive analytics. This version corrects scope to match.

We propose a **browser-native 3D Ocean Data Visualization System** built around the six core requirements below, in priority order matching the official spec.

---

## 3. Core Functional Requirements (Official) → Our Approach

### 3.1 3D Volumetric Rendering
- Depth-resolved rendering of temperature, salinity, and current vectors across the water column — not just discrete point markers at fixed depths.
- **Depth-slice views**: pick a depth, see the horizontal field at that level.
- **Isosurface extraction**: render a 3D surface connecting all points at a chosen value (e.g., "show me the 20°C surface") — a real, named requirement, not a stretch feature.
- **Time-step animation**: play through timesteps rather than only scrubbing a static slider.
- Built on **CesiumJS** (georeferencing is native, matches the "web-based, platform-independent" requirement) with custom WebGL layers for volumetric/isosurface rendering where Cesium's built-in primitives aren't enough.

### 3.2 Instrument Data Overlay
- Co-display of **Argo float, Glider, CTD, and BGC (bio-geo-chemical)** data as geospatially accurate markers — broader than Argo alone.
- Clicking any instrument marker opens a **depth-vs-variable profile chart** with timestamps (a real chart, e.g. temperature vs. depth as a line, not just a tooltip number).

### 3.3 Multi-Format Data Ingestion
- Parsers for **NetCDF** (via `xarray`, standing in for PyNIO which is largely superseded) and delimited text formats.
- **Modular ingestion architecture**: each data source (model, Argo, Glider, CTD/BGC) is its own pluggable parser module conforming to a shared internal schema, so adding a new source means writing one new parser, not touching the rest of the pipeline.

### 3.4 Customizable Colorbar & Variable Controls
- Dynamic colorbar editor: palette choice, min/max range, linear/log scale toggle.
- Variable selector (switch between temperature/salinity/currents/chlorophyll).
- Layer opacity controls (blend model layer with instrument overlay).
- **Vertical exaggeration slider** — stretches the depth axis for perceptibility, standard in oceanographic 3D tools since real ocean depth is tiny relative to horizontal extent.

### 3.5 Web-Based, Scalable Architecture
- Frontend: React + TypeScript + CesiumJS/resium — no client-side installs.
- Backend: FastAPI serving a **REST API modeled on OPeNDAP conventions** (INCOIS's own LAS already uses OPeNDAP) — sliced array queries by variable/depth/time/region, not just flat precomputed files. Full OPeNDAP protocol compliance is a stretch goal; OPeNDAP-*style* query semantics are the realistic prototype target.

### 3.6 Extensible Design
- Plugin-style ingestion (per 3.3) explicitly designed to accommodate future sensors named in the spec — moorings, HF-radar, ADCP — even though we won't build parsers for all of them.
- Interoperability nod: structure NetCDF handling around **CF Conventions** (the standard metadata convention for climate/forecast NetCDF files) so the ingestion layer isn't fighting non-standard assumptions.

---

## 4. Data Sources (Official Links)

| Type | Source |
|---|---|
| Numerical model output | `las.incois.gov.in`, Copernicus `GLOBAL_MULTIYEAR_PHY_001_030` |
| Argo floats | `ftp.ifremer.fr/ifremer/argo` |
| Glider profiles | `ftp.ifremer.fr/ifremer/glider/v2/` |
| CTD/BGC | Additional in-situ collection (source TBD — check INCOIS portal access) |

## 5. Architecture

```text
   MODEL DATA (LAS / Copernicus)      ARGO / GLIDER / CTD-BGC (Ifremer FTP)
              │                                    │
              ▼                                    ▼
     ┌──────────────────┐              ┌──────────────────────┐
     │ NetCDF Parser      │              │ Modular Instrument    │
     │ Module (xarray)    │              │ Parser Modules         │
     └────────┬───────────┘              └──────────┬─────────────┘
              │                                       │
              └───────────────┬───────────────────────┘
                               ▼
                  ┌─────────────────────────┐
                  │ Shared Internal Schema   │
                  │ (lat, lon, depth, time,  │
                  │  variable, value)        │
                  └───────────┬─────────────┘
                               ▼
                  ┌─────────────────────────┐
                  │ FastAPI — OPeNDAP-style  │
                  │ sliced query endpoints   │
                  └───────────┬─────────────┘
                               ▼
                  ┌─────────────────────────┐
                  │ React + Cesium Frontend  │
                  │ - Volumetric/isosurface  │
                  │   rendering              │
                  │ - Depth/time controls    │
                  │ - Colorbar/opacity/      │
                  │   vertical exaggeration  │
                  │ - Click-to-profile chart │
                  └─────────────────────────┘
```

## 6. What We're Explicitly De-scoping (and why)

- **AI-generated insights, alerts, forecasting** — not part of the official ask. May be added as a small bonus panel only if core rendering/overlay/controls are fully solid with time to spare. Not to be prioritized over anything in Section 3.
- **Full OGC WMS/WCS compliance** — a real standards implementation is a multi-week effort in itself; we'll structure data conventionally (CF-compliant NetCDF handling) so it's *interoperability-minded* without claiming full standards compliance we can't deliver in hackathon time.

## 7. Bonus: Hardware Sensor Extensibility Demo

Unchanged from earlier framing — a compact low-cost sensor probe (temperature, turbidity, conductivity/TDS, GPS, depth, IMU) streams into the same modular ingestion architecture as a live "new instrument type," directly demonstrating requirement 3.6 (Extensible Design) with a real, working example rather than just an architectural claim.

## 8. Public Outreach Angle (Secondary, Official)

The same platform, with model/technical layers simplified, doubles as a science-communication tool for schools, exhibitions, and e-learning — costs nothing extra to build if the UI is designed with a "simple mode" toggle, and directly echoes language from the official PS.

---

## 9. Why This Matches the Rubric

| Official Requirement | Where It Lives in Our Solution |
|---|---|
| 3D volumetric rendering + isosurfaces + time animation | Section 3.1 |
| Argo/Glider/CTD/BGC overlay + click-to-profile | Section 3.2 |
| Multi-format ingestion, modular architecture | Section 3.3 |
| Colorbar/variable/opacity/vertical exaggeration controls | Section 3.4 |
| Web-based scalable architecture, OPeNDAP-style backend | Section 3.5 |
| Extensible/plugin design for future sensors | Section 3.6 + hardware bonus |
| Public outreach value | Section 8 |
