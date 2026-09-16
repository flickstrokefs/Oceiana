import argparse
import sys
from pathlib import Path
import pandas as pd

# Ensure backend root is on sys.path
BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from data_pipelines import fetch_argo, RAW_DIR, START_DATE, END_DATE
from data_service import (
    PRIMARY_DATA_PATH,
    LEGACY_DATA_PATH,
    standardize_profiles,
    add_density_products,
    add_vertical_gradients,
    save_processed_data,
    save_derived_data,
    save_gradient_data,
    STANDARDIZED_PATH,
    DERIVED_PATH,
    GRADIENT_PATH,
)
from app.core.regions import (
    validate_region,
    get_macro_region,
    REGION_ARABIAN_SEA,
    REGION_BAY_OF_BENGAL,
    REGION_SOUTHERN_OCEAN,
)


def verify_file_geographic_scope(csv_path: Path, dataset_label: str):
    """Verify that every single observation in the CSV belongs to Indian Ocean or Southern Ocean."""
    if not csv_path.exists():
        raise FileNotFoundError(f"Dataset {csv_path} does not exist.")

    df = pd.read_csv(csv_path)
    total_obs = len(df)
    unique_profiles = df["PROFILE_ID"].nunique() if "PROFILE_ID" in df.columns else None

    # Verify every row
    invalid_rows = []
    io_count = 0
    so_count = 0
    as_count = 0
    bob_count = 0

    for idx, row in df.iterrows():
        lat = float(row["LATITUDE"])
        lon = float(row["LONGITUDE"])
        reg = validate_region(lat, lon)
        macro = get_macro_region(lat, lon)

        if reg is None or macro is None:
            invalid_rows.append((idx, lat, lon))
        elif macro == "Indian Ocean":
            io_count += 1
            if reg == REGION_ARABIAN_SEA:
                as_count += 1
            elif reg == REGION_BAY_OF_BENGAL:
                bob_count += 1
        elif macro == "Southern Ocean":
            so_count += 1

    print(f"\n--- Geographic Scope Audit: {dataset_label} ---")
    print(f"File: {csv_path.name}")
    print(f"Total Observations:        {total_obs}")
    if unique_profiles:
        print(f"Total Unique Profiles:     {unique_profiles}")
    print(f"Indian Ocean Observations: {io_count} ({as_count} Arabian Sea, {bob_count} Bay of Bengal)")
    print(f"Southern Ocean Observations: {so_count}")
    print(f"Out-of-Scope Observations: {len(invalid_rows)}")

    if invalid_rows:
        raise ValueError(
            f"CRITICAL: Found {len(invalid_rows)} observations outside authorized regions in {csv_path.name}!"
        )
    print(f"[PASS] 100% of observations are strictly within Indian Ocean and Southern Ocean.")
    return {
        "total": total_obs,
        "indian_ocean": io_count,
        "arabian_sea": as_count,
        "bay_of_bengal": bob_count,
        "southern_ocean": so_count,
        "out_of_scope": len(invalid_rows),
    }


def main():
    parser = argparse.ArgumentParser(description="Ariel Argo Data Pipeline: Indian & Southern Ocean Scope")
    parser.add_argument("--fetch", action="store_true", help="Force re-fetching real Argo data from ERDDAP")
    args = parser.parse_args()

    print("=======================================================")
    print("      OCEAN-X / ARIEL DATA PIPELINE (STRICT SCOPE)     ")
    print(" Authorized Regions: Indian Ocean & Southern Ocean      ")
    print("=======================================================")

    # Step 0: Upstream Argo Fetch
    should_fetch = args.fetch or not PRIMARY_DATA_PATH.exists()
    if should_fetch:
        print("\n[Stage 0/4] Fetching real Argo profiles (upstream argopy query)...")
        fetch_argo()
    else:
        print(f"\n[Stage 0/4] Using existing multi-basin raw dataset: {PRIMARY_DATA_PATH.name}")

    # Step 1: Standardize Profiles
    print("\n[Stage 1/4] Standardizing Argo profiles (10 dbar common pressure grid)...")
    standardized = standardize_profiles()
    print(f"       Standardized rows: {len(standardized)}")

    # Step 2: Save Standardized Data
    print("\n[Stage 2/4] Saving standardized dataset...")
    std_file = save_processed_data()
    print(f"       Saved to: {std_file}")

    # Step 3: Compute TEOS-10 Derived Products
    print("\n[Stage 3/4] Computing TEOS-10 derived oceanographic products (SA, CT, SIGMA0)...")
    derived = add_density_products(standardized)
    print(f"       Derived rows: {len(derived)}")
    der_file = save_derived_data()
    print(f"       Saved to: {der_file}")

    # Step 4: Compute Vertical Gradients
    print("\n[Stage 4/4] Computing vertical gradients (dTEMP/dPRES, dSA/dPRES, dSIGMA0/dPRES)...")
    gradient = add_vertical_gradients(derived)
    print(f"       Gradient rows: {len(gradient)}")
    grad_file = save_gradient_data()
    print(f"       Saved to: {grad_file}")

    # Mandatory Post-Processing Scope Verification
    print("\n=======================================================")
    print("      MANDATORY GEOGRAPHIC SCOPE VERIFICATION         ")
    print("=======================================================")
    verify_file_geographic_scope(PRIMARY_DATA_PATH, "RAW DATASET")
    verify_file_geographic_scope(Path(std_file), "STANDARDIZED DATASET")
    verify_file_geographic_scope(Path(der_file), "DERIVED DATASET")
    verify_file_geographic_scope(Path(grad_file), "GRADIENT DATASET")

    print("\n=======================================================")
    print("      PIPELINE EXECUTION COMPLETED SUCCESSFULLY        ")
    print("=======================================================")


if __name__ == "__main__":
    main()