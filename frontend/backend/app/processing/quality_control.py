import numpy as np
import pandas as pd
from typing import Tuple


def clean_coordinates(df: pd.DataFrame, lat_col: str = "LATITUDE", lon_col: str = "LONGITUDE") -> pd.DataFrame:
    """Filter coordinates to physically valid bounds [-90, 90] and [-180, 180]."""
    mask = (
        (df[lat_col] >= -90.0)
        & (df[lat_col] <= 90.0)
        & (df[lon_col] >= -180.0)
        & (df[lon_col] <= 180.0)
    )
    return df[mask].copy()


def clean_pressure(df: pd.DataFrame, pres_col: str = "PRES") -> pd.DataFrame:
    """Filter pressure to non-negative ocean values."""
    return df[df[pres_col] >= 0.0].copy()


def flag_suspicious_values(
    df: pd.DataFrame,
    temp_col: str = "TEMP",
    psal_col: str = "PSAL",
) -> pd.DataFrame:
    """
    Validate ocean physical limits:
    In-situ Temp: [-2.5, 40.0] °C
    Practical Salinity: [2.0, 42.0] PSU
    """
    res = df.copy()
    if temp_col in res.columns:
        res["TEMP_VALID"] = (res[temp_col] >= -2.5) & (res[temp_col] <= 40.0)
    if psal_col in res.columns:
        res["PSAL_VALID"] = (res[psal_col] >= 2.0) & (res[psal_col] <= 42.0)
    return res
