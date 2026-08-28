# Pathway 2 — Data Processing (Rajveer)

**Owner:** Rajveer
**Goal:** Turn the raw files Shiva & Agnay produce into small, precomputed slices the backend can serve instantly, and compute the model-vs-observation comparison layer.

---

## What you need to learn first (in order)

You said you want to focus on learning what you'll actually need on the job — here's the real order of priority, not the "complete course" order:

1. **xarray basics** — specifically: opening a NetCDF file (`xr.open_dataset`), selecting by dimension (`.sel()` for lat/lon/depth/time), and converting a selection to a plain array/DataFrame. You don't need to learn xarray's full API — just these operations.
2. **pandas basics** — you'll use this constantly for the Argo CSV data and for building the comparison table. Focus on: filtering rows, merging two DataFrames on nearest key (`pd.merge_asof` or manual nearest-neighbor matching), and exporting to JSON/CSV.
3. **NumPy basics** — just enough for simple math (differences, averages, thresholds) on arrays.

Don't go deep into ML libraries yet — the comparison layer is a straightforward subtraction + threshold, not a trained model. If there's time later for a stretch anomaly-detection feature, that's a separate, later task.

## Step 1: Load and inspect real data
Once Shiva/Agnay hand you one NetCDF file and one Argo CSV:
- Open the NetCDF with xarray, print its structure (`print(ds)`) to see what variables/dimensions actually exist — don't assume, verify.
- Load the Argo CSV with pandas, check its columns.

## Step 2: Subset the model grid
- Pick a coarse resolution (e.g. every 0.25° instead of the native grid) to keep output small.
- For each depth layer and timestep you have, extract temperature/salinity/currents at that coarse resolution.
- Export as a simple JSON structure: something like a list of `{lat, lon, depth, time, temperature, salinity}` records, OR a nested array if that's easier for the frontend — check with Prabhleen once she has a rendering approach, don't guess the format in isolation.

## Step 3: Match Argo stations to the grid
- For each Argo profile point, find the nearest model grid cell (same lat/lon/depth/time bucket).
- Compute delta = model_value − observed_value for temperature (and salinity if time allows).
- Output: a list of stations with `{lat, lon, depth, time, observed_value, model_value, delta}`.

## Step 4: Flag divergence
- Pick a simple threshold (e.g. delta > 1°C is "significant divergence") — this doesn't need to be scientifically rigorous for a prototype, just defensible and clearly labeled as a threshold-based flag, not a claim of a real anomaly.
- Add a boolean `flagged` field to the station output.

## Output contract (this is what you hand to the backend)
Two clean files (JSON or CSV, agree on one format with whoever wires up FastAPI):
- `grid_slice.json` — the coarse model grid, ready to serve as-is.
- `stations.json` — Argo points with model/observed/delta/flagged.

## Things to avoid
- Don't process the full native-resolution grid — always work coarse/subsetted, both for your own iteration speed and because the frontend can't render huge data anyway.
- Don't wait for "clean" pipeline output from Shiva/Agnay before starting — practice on whatever raw file exists on day one, even if it's rough.
- Don't build this as a live/real-time service yet — batch-processing a static file into static output files is enough for the prototype.
