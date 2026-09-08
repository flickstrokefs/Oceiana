import os
import argopy

# --------------------------------
# CONFIGURATION
# --------------------------------

LON_MIN, LON_MAX = 80.0, 90.0
LAT_MIN, LAT_MAX = 10.0, 20.0

DEPTH_MIN, DEPTH_MAX = 0.0, 2000.0

START_DATE = "2020-01-01"
END_DATE = "2020-02-01"

RAW_DIR = "../data/raw"

os.makedirs(RAW_DIR, exist_ok=True)


# --------------------------------
# FETCH ARGO DATA
# --------------------------------

print("Creating Argo fetcher...")

fetcher = argopy.DataFetcher(
    src="erddap",
    mode="standard"
)

fetcher = fetcher.region([
    LON_MIN,
    LON_MAX,
    LAT_MIN,
    LAT_MAX,
    DEPTH_MIN,
    DEPTH_MAX,
    START_DATE,
    END_DATE,
])

print("Loading Argo data...")

ds = fetcher.load().data

print()
print("SUCCESS!")
print("Observations:", ds.sizes["N_POINTS"])


# --------------------------------
# SAVE DATA
# --------------------------------

output_file = (
    f"argo_bay_of_bengal_"
    f"{START_DATE}_{END_DATE}.nc"
)

output_path = os.path.join(
    RAW_DIR,
    output_file
)

ds.to_netcdf(output_path)

print()
print("Argo data saved to:")
print(output_path)