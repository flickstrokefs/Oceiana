import numpy as np
import pandas as pd
from typing import List


def standardize_single_profile(
    profile_df: pd.DataFrame,
    step: float = 10.0,
    pres_col: str = "PRES",
    temp_col: str = "TEMP",
    psal_col: str = "PSAL",
) -> pd.DataFrame:
    """Interpolate a single vertical sounding onto a uniform pressure grid."""
    clean = profile_df.drop_duplicates(subset=[pres_col]).sort_values(pres_col)
    if len(clean) < 2:
        return clean

    p_min = float(clean[pres_col].min())
    p_max = float(clean[pres_col].max())

    start_p = np.ceil(p_min / step) * step
    end_p = np.floor(p_max / step) * step

    grid = np.arange(start_p, end_p + step * 0.5, step)
    if p_min <= 0:
        grid = np.insert(grid, 0, 0.0)
    grid = np.unique(np.round(grid, 4))

    t_interp = np.interp(grid, clean[pres_col].values, clean[temp_col].values)
    s_interp = np.interp(grid, clean[pres_col].values, clean[psal_col].values)

    row0 = clean.iloc[0]
    res = pd.DataFrame({
        pres_col: grid,
        temp_col: np.round(t_interp, 3),
        psal_col: np.round(s_interp, 3),
    })

    # Propagate metadata columns
    for col in clean.columns:
        if col not in [pres_col, temp_col, psal_col]:
            res[col] = row0[col]

    return res


def standardize_all_profiles(
    df: pd.DataFrame,
    group_col: str = "PROFILE_ID",
    step: float = 10.0,
) -> pd.DataFrame:
    """Group observations by profile identifier and interpolate each onto standard grid."""
    results: List[pd.DataFrame] = []
    for _, group in df.groupby(group_col, sort=True):
        std = standardize_single_profile(group, step=step)
        results.append(std)

    if not results:
        return df.copy()

    return pd.concat(results, ignore_index=True).sort_values([group_col, "PRES"]).reset_index(drop=True)
