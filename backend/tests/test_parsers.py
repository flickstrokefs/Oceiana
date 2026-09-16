import os
import pytest
import pandas as pd
import numpy as np
from app.processing.quality_control import clean_coordinates, clean_pressure, flag_suspicious_values
from app.processing.standardizer import standardize_single_profile, standardize_all_profiles
from app.processing.teos10 import compute_teos10
from app.processing.gradients import compute_vertical_gradients
from app.processing.csv_parser import CSVParser


def test_quality_control():
    df = pd.DataFrame({
        "LATITUDE": [-95.0, 15.0, 22.0, 95.0],
        "LONGITUDE": [65.0, 72.0, 170.0, 80.0],
        "PRES": [-5.0, 0.0, 100.0, 200.0],
        "TEMP": [25.0, 28.0, 15.0, 50.0],
        "PSAL": [35.0, 35.5, 34.0, 60.0],
    })

    cleaned_geo = clean_coordinates(df)
    assert len(cleaned_geo) == 2
    assert all(cleaned_geo["LATITUDE"].between(-90, 90))
    assert all(cleaned_geo["LONGITUDE"].between(-180, 180))

    cleaned_pres = clean_pressure(df)
    assert len(cleaned_pres) == 3
    assert all(cleaned_pres["PRES"] >= 0)

    flagged = flag_suspicious_values(df)
    assert bool(flagged.loc[3, "TEMP_VALID"]) is False
    assert bool(flagged.loc[3, "PSAL_VALID"]) is False


def test_standardizer():
    # Synthetic vertical profile
    profile = pd.DataFrame({
        "PROFILE_ID": [1, 1, 1, 1],
        "PRES": [3.2, 28.5, 52.0, 98.4],
        "TEMP": [28.5, 26.1, 23.0, 18.2],
        "PSAL": [34.5, 35.0, 35.5, 36.0],
    })

    std = standardize_single_profile(profile, step=10.0)
    assert 10.0 in std["PRES"].values
    assert 20.0 in std["PRES"].values
    assert 50.0 in std["PRES"].values
    assert len(std) > len(profile)

    # Temperature decreases with depth
    assert std.loc[std["PRES"] == 10.0, "TEMP"].values[0] > std.loc[std["PRES"] == 90.0, "TEMP"].values[0]


def test_teos10_and_gradients():
    df = pd.DataFrame({
        "PROFILE_ID": [1, 1, 1],
        "LATITUDE": [15.0, 15.0, 15.0],
        "LONGITUDE": [70.0, 70.0, 70.0],
        "PRES": [0.0, 50.0, 100.0],
        "TEMP": [28.0, 25.0, 20.0],
        "PSAL": [35.5, 35.7, 36.0],
    })

    teos = compute_teos10(df)
    assert "SA" in teos.columns
    assert "CT" in teos.columns
    assert "SIGMA0" in teos.columns
    assert all(teos["SIGMA0"] > 20.0)  # Typical ocean surface sigma0 > 20 kg/m3

    grad = compute_vertical_gradients(teos)
    assert "TEMP_GRADIENT" in grad.columns
    assert "PSAL_GRADIENT" in grad.columns
    assert "SIGMA0_GRADIENT" in grad.columns
    assert all(grad["TEMP_GRADIENT"] <= 0.0)  # Temperature cools downwards
