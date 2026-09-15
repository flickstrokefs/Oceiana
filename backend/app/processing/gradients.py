import numpy as np
import pandas as pd


def compute_vertical_gradients(
    df: pd.DataFrame,
    group_col: str = "PROFILE_ID",
    pres_col: str = "PRES",
    temp_col: str = "TEMP",
    psal_col: str = "PSAL",
    density_col: str = "SIGMA0",
) -> pd.DataFrame:
    """
    Calculate vertical oceanographic gradients per profile:
    - dT/dz (°C / dbar)
    - dS/dz (PSU / dbar)
    - dρ/dz (kg/m³ / dbar)
    """
    results = []

    for _, group in df.groupby(group_col, sort=True):
        grp = group.sort_values(pres_col).copy()
        p = grp[pres_col].to_numpy(dtype=float)

        if len(grp) < 2:
            grp["TEMP_GRADIENT"] = 0.0
            grp["PSAL_GRADIENT"] = 0.0
            if density_col in grp.columns:
                grp["SIGMA0_GRADIENT"] = 0.0
            results.append(grp)
            continue

        dp = np.gradient(p)
        dp[dp == 0] = 1e-6

        dt = np.gradient(grp[temp_col].to_numpy(dtype=float))
        ds = np.gradient(grp[psal_col].to_numpy(dtype=float))

        grp["TEMP_GRADIENT"] = np.round(dt / dp, 5)
        grp["PSAL_GRADIENT"] = np.round(ds / dp, 5)

        if density_col in grp.columns:
            d_rho = np.gradient(grp[density_col].to_numpy(dtype=float))
            grp["SIGMA0_GRADIENT"] = np.round(d_rho / dp, 5)

        results.append(grp)

    if not results:
        return df.copy()

    return pd.concat(results, ignore_index=True)
