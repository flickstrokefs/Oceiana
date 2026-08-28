# Pathway 1 — Data Pipelines (Shiva + Agnay)

**Owners:** Shiva, Agnay
**Goal:** Build every data pipeline the platform needs, working end-to-end from source → local files, BEFORE the backend or frontend touches any of it. Nothing downstream can start until at least one pipeline produces real output.

---

## Why this comes first
The entire platform is worthless without real data flowing. Rajveer's processing work and Prabhleen's frontend prompts are both meaningless without sample data files to point at. Your job is to de-risk the biggest unknown in the whole project as early as possible.

---

## Pipeline 1: Numerical ocean model output

**Primary target (for the pitch):** INCOIS — check what public data/API access they expose. Government portals can be slow or awkward, so timebox investigating this to ~1-2 hours before falling back.

**Working fallback (use this to actually build):** Copernicus Marine Service (CMEMS)
- Install: `pip install copernicusmarine`
- Register for a free CMEMS account (needed for API access) — do this first, account approval can lag.
- Pull one bounded dataset: pick a small region (Arabian Sea or Bay of Bengal — relevant to India, keeps data volume sane) and one short time window (a few days), one or two depth layers (surface + one deeper layer).
- Variables to pull: temperature, salinity, currents (u/v), sea surface height.
- Output: raw NetCDF file(s) saved locally.

**Definition of done for this pipeline:** a script that, run end-to-end, downloads a NetCDF file for your chosen region/time/depth without manual intervention.

## Pipeline 2: In-situ observations (Argo floats)

- Install: `pip install argopy`
- Pull Argo profiles for the SAME region and time window as Pipeline 1 — this alignment matters, Rajveer's comparison step depends on both pipelines covering the same space/time.
- Output: Argo profile data (temperature, salinity, depth, lat/lon, timestamp) saved locally, ideally as a clean CSV/Parquet so Rajveer doesn't have to touch Argo's raw format at all.

## Pipeline 3 (stretch, only if 1 & 2 are solid): buoy network data

- Look into RAMA/OMNI buoy network public access if time allows. Don't start this until Pipelines 1 and 2 are both producing clean output — it's a bonus, not a requirement.

---

## Division of labor suggestion (adjust as you go)
- One of you owns Pipeline 1 (model data), the other owns Pipeline 2 (Argo) — build them in parallel since they're independent, then sync on making sure the region/time window matches.
- Once both work standalone, jointly write ONE script that runs both pulls together and drops files into a shared `/data/raw/` folder with a consistent naming convention (e.g. `model_<region>_<date>.nc`, `argo_<region>_<date>.csv`) — Rajveer needs predictable filenames.

## Handoff to Rajveer
Don't wait until pipelines are "perfect." The moment you have ONE real NetCDF file and ONE real Argo CSV for the same region/time, hand them to Rajveer so he can start learning xarray against real data instead of waiting idle.

## Things to avoid
- Don't try to pull global data — pick one small region and stick with it across both pipelines.
- Don't build a scheduler/automation for repeated pulls yet — a script you run manually once is enough for prototype stage.
- Don't spend time on error handling/retries until the happy path works once.
