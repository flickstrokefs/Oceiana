import pytest
import pandas as pd
import numpy as np
from pathlib import Path

from app.core.regions import (
    REGION_ARABIAN_SEA,
    REGION_BAY_OF_BENGAL,
    REGION_SOUTHERN_OCEAN,
    validate_region,
    get_macro_region,
    normalize_longitude,
    filter_dataframe_to_authorized_regions,
)
from data_pipelines import (
    IO_LON_MIN,
    IO_LON_MAX,
    IO_LAT_MIN,
    IO_LAT_MAX,
    SO_LON_MIN,
    SO_LON_MAX,
    SO_LAT_MIN,
    SO_LAT_MAX,
)
from data_service import (
    load_argo_data,
    standardize_profiles,
    add_density_products,
    add_vertical_gradients,
)


def test_upstream_bounding_boxes_alignment():
    """Verify upstream Argo query boxes align with authorized geographic scope."""
    # Indian Ocean bounds
    assert IO_LON_MIN >= 55.0 and IO_LON_MAX <= 95.0
    assert IO_LAT_MIN >= 5.0 and IO_LAT_MAX <= 26.0

    # Southern Ocean bounds (circumpolar Antarctic ACC sector <= -50°S)
    assert SO_LAT_MAX <= -50.0
    assert SO_LAT_MIN >= -78.0


def test_filter_dataframe_strictly_rejects_out_of_scope():
    """Verify that filter_dataframe_to_authorized_regions drops Pacific, Atlantic, Med, and land points."""
    synthetic_data = pd.DataFrame({
        "LATITUDE": [
            15.0,    # Bay of Bengal (VALID)
            16.0,    # Arabian Sea (VALID)
            -55.0,   # Southern Ocean (VALID)
            0.0,     # Pacific Ocean (PROHIBITED)
            25.0,    # Atlantic Ocean (PROHIBITED)
            35.0,    # Mediterranean (PROHIBITED)
            18.0,    # Indian mainland peninsula interior (PROHIBITED)
            0.0,     # Equatorial Indian Ocean outside AS/BOB (PROHIBITED)
        ],
        "LONGITUDE": [
            88.0,    # Bay of Bengal
            65.0,    # Arabian Sea
            65.0,    # Southern Ocean
            -140.0,  # Pacific Ocean
            -40.0,   # Atlantic Ocean
            18.0,    # Mediterranean
            78.0,    # Mainland India
            75.0,    # Equatorial Indian Ocean
        ],
        "PRES": [10.0, 20.0, 30.0, 40.0, 50.0, 60.0, 70.0, 80.0],
        "TEMP": [28.0, 27.5, 1.5, 26.0, 22.0, 18.0, 25.0, 28.0],
        "PSAL": [33.5, 36.5, 34.0, 35.0, 35.5, 38.0, 35.0, 35.0],
        "TIME": ["2020-01-01 00:00:00"] * 8,
    })

    filtered = filter_dataframe_to_authorized_regions(synthetic_data)

    # Exactly 3 rows must survive
    assert len(filtered) == 3
    assert set(filtered["REGION"].unique()) == {REGION_BAY_OF_BENGAL, REGION_ARABIAN_SEA, REGION_SOUTHERN_OCEAN}
    assert set(filtered["MACRO_REGION"].unique()) == {"Indian Ocean", "Southern Ocean"}

    # Zero out-of-scope rows
    for _, row in filtered.iterrows():
        assert validate_region(row["LATITUDE"], row["LONGITUDE"]) is not None


def test_longitude_formats_and_wrapping():
    """Verify handling of both -180..180 and 0..360 longitude representations."""
    # Test Southern Ocean float with longitude 300°E (which is -60°W in Drake Passage/ACC)
    df_360 = pd.DataFrame({
        "LATITUDE": [-58.0, -62.0],
        "LONGITUDE": [300.0, 200.0],  # 300 -> -60, 200 -> -160 (both in Southern Ocean circumpolar)
        "PRES": [0.0, 10.0],
        "TEMP": [1.0, 0.8],
        "PSAL": [33.8, 33.9],
        "TIME": ["2020-01-01", "2020-01-01"],
    })

    filtered = filter_dataframe_to_authorized_regions(df_360)
    assert len(filtered) == 2
    assert all(filtered["LONGITUDE"].between(-180, 180))
    assert all(filtered["REGION"] == REGION_SOUTHERN_OCEAN)
    assert all(filtered["MACRO_REGION"] == "Southern Ocean")


def test_processed_pipeline_scope_zero_violations():
    """Verify processed standardized, derived, and gradient files contain zero out-of-scope observations."""
    from data_service import STANDARDIZED_PATH, DERIVED_PATH, GRADIENT_PATH

    for path in [STANDARDIZED_PATH, DERIVED_PATH, GRADIENT_PATH]:
        if not path.exists():
            continue

        df = pd.read_csv(path)
        for _, row in df.iterrows():
            reg = validate_region(float(row["LATITUDE"]), float(row["LONGITUDE"]))
            macro = get_macro_region(float(row["LATITUDE"]), float(row["LONGITUDE"]))
            assert reg is not None, f"Out of scope observation at ({row['LATITUDE']}, {row['LONGITUDE']}) in {path.name}"
            assert macro in ["Indian Ocean", "Southern Ocean"], f"Invalid macro basin {macro} in {path.name}"
