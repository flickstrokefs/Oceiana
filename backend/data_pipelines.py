# data_pipelines.py
# Fetch ocean model data (CMEMS), Argo profiles, and INCOIS ERDDAP data
# strictly bounded to authorized ocean regions (Indian Ocean & Southern Ocean)
# and save into data/raw/

import os
import sys
from pathlib import Path
from datetime import datetime, timedelta
import xarray as xr
import pandas as pd
import numpy as np
import argopy

# Ensure backend root is on sys.path for app imports
BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.regions import (
    REGION_ARABIAN_SEA,
    REGION_BAY_OF_BENGAL,
    REGION_SOUTHERN_OCEAN,
    filter_dataframe_to_authorized_regions,
    validate_region,
    get_macro_region,
    normalize_longitude,
)

# -----------------------------
# GEOGRAPHIC CONFIGURATION (STRICT SCOPE: INDIAN OCEAN & SOUTHERN OCEAN)
# -----------------------------

# Region 1: Indian Ocean (encompassing Arabian Sea: 55°E-77.5°E, 5°N-26°N and Bay of Bengal: 80°E-95°E, 5°N-23.5°N)
IO_LON_MIN, IO_LON_MAX = 55.0, 95.0
IO_LAT_MIN, IO_LAT_MAX = 5.0, 26.0

# Region 2: Southern Ocean (Circumpolar Antarctic waters ACC sector: 40°E-90°E, 65°S-50°S)
SO_LON_MIN, SO_LON_MAX = 40.0, 90.0
SO_LAT_MIN, SO_LAT_MAX = -65.0, -50.0

# Time window (5 days default for Argo profile fetch)
START_DATE = "2020-01-01"
END_DATE = "2020-01-05"

# Depth range for profiles (dbar / m)
DEPTH_MIN, DEPTH_MAX = 0.0, 2000.0

# Output directory
RAW_DIR = BACKEND_DIR / "data" / "raw"
RAW_DIR.mkdir(parents=True, exist_ok=True)


# -----------------------------
# PIPELINE 1: Copernicus Marine (CMEMS) model data
# -----------------------------

def fetch_cmems():
    """
    Download a small subset of global ocean physics reanalysis from CMEMS.
    Requires:
        pip install copernicusmarine
        copernicusmarine login   (run once in terminal) 
    """
    import copernicusmarine

    # Example dataset: global ocean physics reanalysis (daily, ~8 km)
    # Adjust if you find a more suitable product.
    dataset_id = "cmems_mod_glo_phy_my_0.083deg_P1D-m"

    output_filename = f"model_bay_of_bengal_{START_DATE}_{END_DATE}.nc"
    output_path = os.path.join(str(RAW_DIR), output_filename)

    copernicusmarine.subset(
        dataset_id=dataset_id,
        variables=["thetao", "so", "uo", "vo"],  # temp, salinity, u/v currents
        minimum_longitude=80.0,
        maximum_longitude=90.0,
        minimum_latitude=10.0,
        maximum_latitude=20.0,
        start_datetime=START_DATE,
        end_datetime=END_DATE,
        minimum_depth=0.0,
        maximum_depth=30.0,
        output_filename=output_path,
        output_directory=".",  # already in RAW_DIR via output_filename
    )
    print("CMEMS model data saved to:", output_path)


# -----------------------------
# PIPELINE 2: Argo float profiles (argopy)
# -----------------------------

def fetch_argo(
    start_date: str = START_DATE,
    end_date: str = END_DATE,
) -> pd.DataFrame:
    """
    Download Argo profiles strictly for Indian Ocean and Southern Ocean,
    combine them safely, apply mandatory post-fetch geographic validation,
    and save both NetCDF and CSV datasets.
    """
    print(f"--> Fetching Argo profiles from IFREMER ERDDAP ({start_date} to {end_date})...")

    # Upstream Box 1: Indian Ocean [lon_min, lon_max, lat_min, lat_max, d_min, d_max, start, end]
    io_box = [IO_LON_MIN, IO_LON_MAX, IO_LAT_MIN, IO_LAT_MAX, DEPTH_MIN, DEPTH_MAX, start_date, end_date]
    print(f"    [1/3] Fetching Indian Ocean (box: {io_box[:4]})...")
    fetcher_io = argopy.DataFetcher(src="erddap", mode="standard").region(io_box)
    ds_io = fetcher_io.load().data

    # Upstream Box 2: Southern Ocean (Circumpolar Antarctic ACC sector)
    so_box = [SO_LON_MIN, SO_LON_MAX, SO_LAT_MIN, SO_LAT_MAX, DEPTH_MIN, DEPTH_MAX, start_date, end_date]
    print(f"    [2/3] Fetching Southern Ocean (box: {so_box[:4]})...")
    fetcher_so = argopy.DataFetcher(src="erddap", mode="standard").region(so_box)
    ds_so = fetcher_so.load().data

    # Safe combination (xarray concat along N_POINTS)
    ds_combined = xr.concat([ds_io, ds_so], dim="N_POINTS")

    # Mandatory Post-Fetch Geographic Validation and Filtering (Second Layer of Protection)
    # 1. Filter xarray dataset
    lats = ds_combined["LATITUDE"].values.astype(float)
    lons = ds_combined["LONGITUDE"].values.astype(float)
    valid_mask = np.array([validate_region(lat, lon) is not None for lat, lon in zip(lats, lons)])
    ds_filtered = ds_combined.isel(N_POINTS=valid_mask)

    # 2. Convert to DataFrame and apply DataFrame validation/normalization
    df_raw = ds_filtered.to_dataframe().reset_index()
    df_filtered = filter_dataframe_to_authorized_regions(df_raw, lat_col="LATITUDE", lon_col="LONGITUDE")

    # Ensure required columns are present
    required_cols = ["PRES", "TEMP", "PSAL", "LATITUDE", "LONGITUDE", "TIME"]
    for c in required_cols:
        if c not in df_filtered.columns:
            raise ValueError(f"Required Argo column '{c}' is missing after fetch.")

    # Save to disk:
    # 1. Multi-basin combined raw CSV & NetCDF
    csv_filename = f"argo_indian_southern_ocean_{start_date}_{end_date}.csv"
    csv_path = RAW_DIR / csv_filename
    nc_filename = f"argo_indian_southern_ocean_{start_date}_{end_date}.nc"
    nc_path = RAW_DIR / nc_filename

    df_filtered.to_csv(csv_path, index=True, index_label="N_POINTS")
    ds_filtered.to_netcdf(str(nc_path))

    # 2. Backward-compatibility copies / updates for legacy consumers expecting argo_bay_of_bengal_...
    legacy_csv_path = RAW_DIR / f"argo_bay_of_bengal_{start_date}_{end_date}.csv"
    legacy_nc_path = RAW_DIR / f"argo_bay_of_bengal_{start_date}_{end_date}.nc"
    df_filtered.to_csv(legacy_csv_path, index=True, index_label="N_POINTS")
    ds_filtered.to_netcdf(str(legacy_nc_path))

    # Verification and Reporting
    io_count = len(df_filtered[df_filtered["MACRO_REGION"] == "Indian Ocean"])
    so_count = len(df_filtered[df_filtered["MACRO_REGION"] == "Southern Ocean"])
    as_count = len(df_filtered[df_filtered["REGION"] == REGION_ARABIAN_SEA])
    bob_count = len(df_filtered[df_filtered["REGION"] == REGION_BAY_OF_BENGAL])
    out_of_scope_count = len(df_filtered[df_filtered["MACRO_REGION"].isna()])

    total_combined = ds_combined.sizes["N_POINTS"] if hasattr(ds_combined, "sizes") else ds_combined.dims["N_POINTS"]
    rejected_count = total_combined - len(df_filtered)

    print(f"\n[OK] Argo Fetch & Geographic Validation Complete:")
    print(f"     Total Valid Observations: {len(df_filtered)}")
    print(f"     - Indian Ocean:          {io_count} observations ({as_count} Arabian Sea, {bob_count} Bay of Bengal)")
    print(f"     - Southern Ocean:        {so_count} observations")
    print(f"     - Out-of-Scope Drops:    {rejected_count} rows rejected")
    print(f"     - Out-of-Scope Retained: {out_of_scope_count} (strictly 0)")
    print(f"     Saved CSV: {csv_path}")
    print(f"     Saved NC:  {nc_path}")

    assert out_of_scope_count == 0, "Security violation: out-of-scope ocean observations detected!"
    return df_filtered



# -----------------------------
# PIPELINE 3: INCOIS ERDDAP model/analysis data
# -----------------------------

def fetch_incois():
    """
    Download a subset from an INCOIS ERDDAP dataset.
    Requires:
        pip install xarray requests

    You MUST replace DATASET_ID and VARIABLES with a real dataset from:
    https://erddap.incois.gov.in/erddap/index.html

    Example pattern (griddap):
        https://erddap.incois.gov.in/erddap/griddap/DATASET_ID.nc?VAR1,VAR2&time>=...&latitude>=...&longitude>=...&depth>=...

    This function uses a placeholder dataset ID; update it before running.
    """
    import xarray as xr

    # TODO: Replace with an actual dataset ID from INCOIS ERDDAP
    # Example: "INCOIS_GLOBAL_ANALYSIS_FORECAST_PHY_001_024" (hypothetical)
    DATASET_ID = "REPLACE_WITH_REAL_INCOIS_DATASET_ID"

    # TODO: Replace with actual variable names from that dataset
    VARIABLES = ["thetao", "so"]  # example: temperature, salinity

    # Build ERDDAP griddap URL
    base_url = "https://erddap.incois.gov.in/erddap/griddap"

    # ERDDAP time format: YYYY-MM-DDTHH:MM:SSZ
    time_start = f"{START_DATE}T00:00:00Z"
    time_end = f"{END_DATE}T23:59:59Z"

    var_str = ",".join(VARIABLES)
    url = (
        f"{base_url}/{DATASET_ID}.nc"
        f"?{var_str}"
        f"&time>={time_start}&time<={time_end}"
        f"&latitude>={LAT_MIN}&latitude<={LAT_MAX}"
        f"&longitude>={LON_MIN}&longitude<={LON_MAX}"
        f"&depth>={DEPTH_MIN}&depth<={DEPTH_MAX}"
    )

    output_filename = f"incois_{DATASET_ID}_{START_DATE}_{END_DATE}.nc"
    output_path = os.path.join(RAW_DIR, output_filename)

    ds = xr.open_dataset(url)
    ds.to_netcdf(output_path)
    print("INCOIS data saved to:", output_path)


# -----------------------------
# MAIN RUNNER
# -----------------------------

def run_all():
    """
    Run all pipelines in sequence.
    Comment out any you do not want to run yet.
    """
    print("Starting data pipelines...")
    print(f"Indian Ocean Box:  [{IO_LON_MIN}, {IO_LON_MAX}, {IO_LAT_MIN}, {IO_LAT_MAX}]")
    print(f"Southern Ocean Box: [{SO_LON_MIN}, {SO_LON_MAX}, {SO_LAT_MIN}, {SO_LAT_MAX}]")
    print(f"Time: {START_DATE} to {END_DATE}")
    print(f"Depth: {DEPTH_MIN} to {DEPTH_MAX} dbar")
    print()

    # Pipeline 1: CMEMS model data
    # fetch_cmems()

    # Pipeline 2: Argo profiles
    fetch_argo()

    # Pipeline 3: INCOIS ERDDAP data
    # Uncomment only after you have chosen a real INCOIS dataset ID and variables:
    # fetch_incois()

    print()
    print("All requested pipelines completed. Check the data/raw/ folder.")


if __name__ == "__main__":
    run_all()
