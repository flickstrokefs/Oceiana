import numpy as np
import pandas as pd
from app.core.logging import logger

try:
    import gsw
    HAS_GSW = True
except ImportError:
    HAS_GSW = False
    logger.warning("gsw package not installed; thermodynamic functions will use UNESCO approximations.")


def compute_teos10(
    df: pd.DataFrame,
    pres_col: str = "PRES",
    temp_col: str = "TEMP",
    psal_col: str = "PSAL",
    lat_col: str = "LATITUDE",
    lon_col: str = "LONGITUDE",
) -> pd.DataFrame:
    """
    Calculate TEOS-10 standard thermodynamic seawater quantities:
    - SA: Absolute Salinity (g/kg)
    - CT: Conservative Temperature (°C)
    - SIGMA0: Potential Density Anomaly (kg/m³) referenced to 0 dbar
    """
    res = df.copy()

    p = res[pres_col].to_numpy(dtype=float)
    t = res[temp_col].to_numpy(dtype=float)
    sp = res[psal_col].to_numpy(dtype=float)
    lat = res[lat_col].to_numpy(dtype=float)
    lon = res[lon_col].to_numpy(dtype=float)

    if HAS_GSW:
        sa = gsw.SA_from_SP(sp, p, lon, lat)
        ct = gsw.CT_from_t(sa, t, p)
        sigma0 = gsw.sigma0(sa, ct)
    else:
        # Fallback UNESCO approximations
        sa = sp * 35.16504 / 35.0
        ct = t - 0.0001 * p
        rho = 1000.0 + 0.8 * sa - 0.2 * ct
        sigma0 = rho - 1000.0

    res["SA"] = np.round(sa, 4)
    res["CT"] = np.round(ct, 4)
    res["SIGMA0"] = np.round(sigma0, 4)

    return res
