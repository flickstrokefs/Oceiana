# DATA_SOURCES.md — Oceanographic Data Provenance, DOIs & Access Catalog

**Platform:** Oceiana / ARIEL 2.0  
**Verification Status:** 100% Audited with active code & tests  
**Offline Capability:** Fully functional from committed local cache without active internet connection

---

## 1. Primary Data Catalog

| Dataset / Asset | Upstream Agency | Protocol & Endpoint | Persistent Identifier (DOI/URL) | Geographic Box / Coverage | Temporal Window | Provenance Classification |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Argo Profiling Floats** | **Ifremer Coriolis GDAC** | ERDDAP REST (`argopy`) / NetCDF4 | **DOI: 10.17882/42182**<br>`https://doi.org/10.17882/42182` | Bay of Bengal<br>$80^\circ\text{–}100^\circ\text{E}, 5^\circ\text{–}23^\circ\text{N}$ | Jan 1 – Feb 1, 2020<br>(51 profiles, 9,124 soundings) | **`REAL`** (In-situ physical sounding) |
| **Autonomous Gliders** | **OceanGliders GDAC / IOOS** | ERDDAP tabledap (`gliders.ioos.us`) | `https://gliders.ioos.us/erddap` | Bay of Bengal (`ru29-20180812T0220`)<br>Southern Ocean (`amlr01`, `amlr02`, etc.) | Mission durations<br>(224 to 3,098 waypoints) | **`REAL`** (In-situ underwater vehicle) |
| **Tropical Cyclone Best Tracks** | **NOAA NCEI (WMO)** | IBTrACS v04r01 CSV / NetCDF | `https://www.ncei.noaa.gov/products/international-best-track-archive` | North Indian Ocean (NI Basin)<br>Bay of Bengal track subset | 2015 – Present<br>(Amphan, Fani, Mocha, etc.) | **`REAL`** (Meteorological agency best-track synthesis) |
| **Global Ocean Physics (PHY)** | **Copernicus Marine (CMEMS)** | Python API (`copernicusmarine`) | `GLOBAL_ANALYSISFORECAST_PHY_001_024`<br>`https://doi.org/10.48670/moi-00016` | Global $1/12^\circ$ grid<br>(Temperature, Salinity, Currents, MLD) | Daily reanalysis & 10-day operational forecast | **`SIMULATED`** (External operational model) |
| **High-Resolution SST** | **NOAA CoastWatch / JPL MUR** | ERDDAP OPeNDAP | `jplMURSST41`<br>`https://doi.org/10.5067/GHGMR-4FJ04` | Global $0.01^\circ$ (~1 km)<br>Cloud-free microwave/infrared blend | Daily | **`REAL`** (Satellite L4 multi-sensor blend) |
| **Ocean Color (Chlorophyll-a)** | **NOAA CoastWatch / VIIRS** | ERDDAP OPeNDAP | `nesdisVHNSQchlaDaily`<br>`https://doi.org/10.5067/VIRSC-1D001` | Global $750\text{ m}$ / $0.04^\circ$ grid | Daily | **`REAL`** (Satellite L3/L4 ocean color) |

---

## 2. Provenance Classification Standards

Every API response, report figure, and chart in Oceiana strictly adheres to a 4-tier provenance taxonomy:

1. **`REAL`**: Direct, physically measured observations captured by in-situ instruments (Argo CTD sensors, autonomous glider payloads) or WMO-verified post-storm best-track analyses (IBTrACS).
2. **`DERIVED`**: Thermodynamic or mathematical calculations computed **directly from REAL observations** using peer-reviewed equations. The formula, reference, and input source are explicitly stated (e.g. TEOS-10 absolute salinity, de Boyer Montégut MLD, Shay et al. TCHP, vertical gradients).
3. **`SIMULATED`**: Numerical model simulations produced by an **external operational forecasting agency** (e.g. Mercator Ocean / Copernicus Marine). Never labeled as in-house calculations.
4. **`SYNTHETIC`**: Fallback placeholder formulas. By project policy, synthetic formulas are **strictly prohibited** from user-facing views or must be prominently badged `DEMO / SYNTHETIC`.

---

## 3. Local Cache & Manifest Architecture

All fetchers save query results to structured disk caches with verifiable cryptographic hash keys and JSON manifests:

```
backend/
├── data/
│   ├── cache/
│   │   ├── argo/
│   │   │   ├── <hash>.nc         # Raw NetCDF data file
│   │   │   └── <hash>.json       # Manifest metadata
│   │   ├── sst/
│   │   ├── chl/
│   │   ├── cmems/
│   │   └── ibtracs/
│   └── raw/
│       └── argo_bay_of_bengal_2020-01-01_2020-02-01.nc (Verified baseline)
```

### Manifest Schema Example (`<hash>.json`)
```json
{
  "source": "Argo — Ifremer Coriolis GDAC",
  "provenance": "REAL",
  "doi": "10.17882/42182",
  "dataset_id": "argo_bay_of_bengal",
  "retrieved_at": "2026-10-23T01:30:00Z",
  "time_range": ["2020-01-01", "2020-02-01"],
  "bbox": [80.0, 5.0, 100.0, 23.0],
  "qc_filter": [1],
  "n_records": 9124,
  "n_profiles": 51
}
```

---

## 4. Offline Demonstration Guarantee

When operating offline (Wi-Fi disconnected):
1. Fetchers check local disk cache before attempting network connections.
2. If network is unavailable and cache is present, data is served instantly with the `CACHED OFFLINE` indicator.
3. If data is not present in cache, the system returns an honest `503 Service Unavailable` explaining exactly which command (`python -m app.data.refresh`) will pre-fetch the requested region.
4. Under NO circumstances does the system fabricate mock numbers to mask an offline cache miss.
