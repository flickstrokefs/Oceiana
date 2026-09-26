# OCEAN-X / ARIEL — Operational Oceanographic Decision Support Frontend

Production React + TypeScript + Vite + CesiumJS frontend application for **Smart India Hackathon (SIH 2026)** problem statement **SIH26067**.

---

## Key Operational Oceanographic Capabilities

### 1. Marine Hazard Assessment (`HazardAssessmentView.tsx`)
- **Operational Variables**:
  - Current Speed ($m/s$) from Copernicus GLORYS12V1
  - Significant Wave Height ($m$) from Copernicus Wave Analysis & Forecast
  - Sea Surface Height Anomaly ($m$)
  - Thermal Stress Index (Degree Heating Weeks / Coral Bleaching Risk)
- **Spherical Geodesic Integration**:
  - Calculates true surface area in $\text{km}^2$ over the WGS84 ellipsoid.
- **Geospatial Raster Grid**:
  - Renders true lat/lon grid cells, coastline vectors, threshold exceedance highlights, and hover crosshair inspection (Coords, Value, Threshold, Exceedance Status, Source, Timestamp).
- **Provenance Audit**:
  - Full transparency: displays dataset ID, processing level, spatial resolution ($0.083^\circ$), and model provenance.

### 2. Fishery Advisories & Potential Fishing Zones (`FisheryAdvisoriesView.tsx`)
- **Official INCOIS Sectors**:
  - 14 registered Indian coastal sectors (Gujarat to West Bengal, Lakshadweep, Andaman & Nicobar) with landing center bearings and distances. Marked with emerald radar beacons (`OFFICIAL`).
- **Ocean-X Multi-Factor PFZ Detection**:
  - Computes thermal front gradient ($|\nabla \text{SST}|$ in $^\circ\text{C}/100\text{km}$), chlorophyll suitability, surface current shear, and wave safety penalty (`DERIVED`).
- **Dynamic Oceanographic Conditions**:
  - Real-time chlorophyll range, SST range, current state, sea state wave height, active PFZ count, and mean productivity index.
- **Deep PFZ Inspection Drawer**:
  - Full in-situ physical parameters, operational confidence gauge, and official maritime safety notice.

---

## Development & Build Commands

```bash
# Install dependencies
npm install

# Start development server with proxy to backend (http://localhost:8000)
npm run dev

# Lint codebase
npm run lint

# Build production bundle
npm run build
```
