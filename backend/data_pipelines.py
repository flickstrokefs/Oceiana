import os
import xarray as xr
import pandas as pd
import numpy as np
import argopy
# data_pipelines.py
# Fetch ocean model data (CMEMS), Argo profiles, and INCOIS ERDDAP data
# for a common region/time window and save into data/raw/

import os
from datetime import datetime, timedelta

# -----------------------------
# CONFIGURATION
# -----------------------------

# Region: Bay of Bengal
LON_MIN, LON_MAX = 80.0, 90.0
LAT_MIN, LAT_MAX = 10.0, 20.0

# Time window (5 days)
START_DATE = "2020-01-01"
# END_DATE = "2020-01-05"
END_DATE = "2020-02-01"

# Depth range for model data (m)
DEPTH_MIN, DEPTH_MAX = 0.0, 30.0

# Output directory
RAW_DIR = "data/raw"
os.makedirs(RAW_DIR, exist_ok=True)


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
    output_path = os.path.join(RAW_DIR, output_filename)

    copernicusmarine.subset(
        dataset_id=dataset_id,
        variables=["thetao", "so", "uo", "vo"],  # temp, salinity, u/v currents
        minimum_longitude=LON_MIN,
        maximum_longitude=LON_MAX,
        minimum_latitude=LAT_MIN,
        maximum_latitude=LAT_MAX,
        start_datetime=START_DATE,
        end_datetime=END_DATE,
        minimum_depth=DEPTH_MIN,
        maximum_depth=DEPTH_MAX,
        output_filename=output_path,
        output_directory=".",  # already in RAW_DIR via output_filename
    )
    print("CMEMS model data saved to:", output_path)


# -----------------------------
# PIPELINE 2: Argo float profiles (argopy)
# -----------------------------

def fetch_argo():
    """
    Download Argo profiles for the same region/time window.
    Requires:
        pip install argopy xarray
    """
    import argopy
    import xarray as xr

    # Box: [lon_min, lon_max, lat_min, lat_max, depth_min, depth_max, start_date, end_date]
    box = [
        LON_MIN,
        LON_MAX,
        LAT_MIN,
        LAT_MAX,
        0.0,
        2000.0,  # Argo profiles go deep; filter later if needed
        START_DATE,
        END_DATE,
    ]

    fetcher = argopy.DataFetcher(src="erddap", mode="standard")
    fetcher = fetcher.region(box)

    ds = fetcher.load().data

    # Keep core variables typically used for comparison with model
    keep_vars = [
        v
        for v in ds.data_vars
        if any(
            k in v.upper()
            for k in ["TEMP", "PSAL", "DEPTH", "LATITUDE", "LONGITUDE", "DATE", "TIME"]
        )
    ]
    if not keep_vars:
        # Fallback: keep all if no obvious match
        keep_vars = list(ds.data_vars)

    ds_core = ds[keep_vars]

    # output_filename = f"argo_bay_of_bengal_{START_DATE}_{END_DATE}.csv"
    # output_path = os.path.join(RAW_DIR, output_filename)

    # df = ds_core.to_dataframe()
    # df.to_csv(output_path)
    # print("Argo profiles saved to:", output_path)  --- as committed i have changed it to netcdf format to check the data is being extracted or not after final test i will do chng it !

    output_filename = f"argo_bay_of_bengal_{START_DATE}_{END_DATE}.nc"
    output_path = os.path.join(RAW_DIR, output_filename)

    ds_core.to_netcdf(output_path)
    print("Argo profiles saved to:", output_path)



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
    print("Region:", LON_MIN, LON_MAX, LAT_MIN, LAT_MAX)
    print("Time:", START_DATE, "to", END_DATE)
    print("Depth:", DEPTH_MIN, "to", DEPTH_MAX)
    print()

    # Pipeline 1: CMEMS model data
    # fetch_cmems() # -- AS i have chng it to check that the data is being extracted or not after final test i will do chng it 

    # Pipeline 2: Argo profiles
    fetch_argo()

    # Pipeline 3: INCOIS ERDDAP data
    # Uncomment only after you have chosen a real INCOIS dataset ID and variables:
    # fetch_incois()

    print()
    print("All requested pipelines completed. Check the data/raw/ folder.")


if __name__ == "__main__":
    run_all()
