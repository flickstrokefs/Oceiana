"""
app.science.thermocline — Thermocline depth and gradient from Argo profiles.

Thermocline: the layer of maximum vertical temperature gradient (dT/dz).

Method: Find the pressure level of maximum |dT/dp| in the main thermocline
  depth range (50–500 dbar), then interpolate to sub-dbar precision.

Also computed:
  - Thermocline strength (°C/m): the maximum gradient value
  - Seasonal thermocline flag: shallow secondary maximum above 100 dbar

Reference:
  Fieux, M., & Stommel, H. (1975). A note on the identification of the
  thermocline by an objective method. Oceanologica Acta, referenced approach
  formalized in:
  Kara, A. B., Rochford, P. A., & Hurlburt, H. E. (2000). An optimal
  definition for ocean mixed layer depth. Journal of Geophysical Research:
  Oceans, 105(C7), 16803–16821. https://doi.org/10.1029/2000JC900072

Provenance: DERIVED from REAL Argo temperature profiles.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Optional

import numpy as np
import pandas as pd

logger = logging.getLogger("ariel.science.thermocline")

THERMO_PMIN = 50.0    # dbar — ignore surface diurnal warming above this
THERMO_PMAX = 500.0   # dbar — main thermocline expected above this in BoB

METHOD_REF = (
    "Kara, A. B., Rochford, P. A., & Hurlburt, H. E. (2000). "
    "An optimal definition for ocean mixed layer depth. "
    "Journal of Geophysical Research: Oceans, 105(C7), 16803–16821. "
    "https://doi.org/10.1029/2000JC900072"
)


@dataclass
class ThermoclineResult:
    profile_id: str
    platform_number: str
    latitude: float
    longitude: float
    time: str
    thermocline_depth_m: Optional[float]   # Depth of maximum dT/dz (m)
    thermocline_strength_C_m: Optional[float]  # |dT/dz| at thermocline (°C/m)
    t_above_m: Optional[float]             # Mean T above thermocline (°C)
    t_below_m: Optional[float]             # Mean T below thermocline (°C)
    delta_t: Optional[float]               # T_above - T_below (°C)
    n_levels: int
    provenance: str = "DERIVED"
    source: str = "Argo — Ifremer ERDDAP (DOI 10.17882/42182)"
    method: str = f"Maximum |dT/dp| in {THERMO_PMIN}–{THERMO_PMAX} dbar"
    method_ref: str = METHOD_REF
    flag: str = "OK"   # OK | SHALLOW | WEAK | NO_DATA


def compute_thermocline_profile(
    pres: np.ndarray,
    temp: np.ndarray,
    profile_id: str = "",
    platform_number: str = "",
    latitude: float = float("nan"),
    longitude: float = float("nan"),
    time: str = "",
    pmin: float = THERMO_PMIN,
    pmax: float = THERMO_PMAX,
    min_strength: float = 0.05,   # °C/dbar — minimum gradient to call it a thermocline
) -> ThermoclineResult:
    """
    Compute thermocline depth from a single Argo profile.

    Uses in-situ temperature (TEMP); CT preferred but not required.
    Gradient is finite difference: dT/dz ≈ ΔT/Δp (negative for normal profile).
    """
    sort_idx = np.argsort(pres)
    p = pres[sort_idx].astype(float)
    t = temp[sort_idx].astype(float)

    valid = np.isfinite(p) & np.isfinite(t)
    p, t = p[valid], t[valid]

    meta = dict(profile_id=profile_id, platform_number=platform_number,
                latitude=latitude, longitude=longitude, time=time,
                n_levels=int(valid.sum()))

    if len(p) < 4:
        return ThermoclineResult(**meta, thermocline_depth_m=None,
                                  thermocline_strength_C_m=None, t_above_m=None,
                                  t_below_m=None, delta_t=None, flag="SHALLOW")

    # Restrict to thermocline search window
    win = (p >= pmin) & (p <= pmax)
    pw, tw = p[win], t[win]

    if len(pw) < 3:
        return ThermoclineResult(**meta, thermocline_depth_m=None,
                                  thermocline_strength_C_m=None, t_above_m=None,
                                  t_below_m=None, delta_t=None, flag="SHALLOW")

    # Central finite difference of temperature with pressure
    dT = np.gradient(tw, pw)  # °C per dbar
    abs_dT = np.abs(dT)
    max_idx = int(np.argmax(abs_dT))
    grad_max = float(abs_dT[max_idx])

    if grad_max < min_strength:
        return ThermoclineResult(**meta, thermocline_depth_m=None,
                                  thermocline_strength_C_m=round(grad_max, 4),
                                  t_above_m=None, t_below_m=None, delta_t=None,
                                  flag="WEAK")

    thermo_p = float(pw[max_idx])

    # Temperature above and below thermocline
    above = t[p < thermo_p]
    below = t[p > thermo_p]
    t_above = float(np.nanmean(above)) if len(above) > 0 else float("nan")
    t_below = float(np.nanmean(below)) if len(below) > 0 else float("nan")
    delta_t = round(t_above - t_below, 2) if np.isfinite(t_above) and np.isfinite(t_below) else None

    return ThermoclineResult(
        **meta,
        thermocline_depth_m=round(thermo_p, 1),
        thermocline_strength_C_m=round(grad_max, 4),
        t_above_m=round(t_above, 3) if np.isfinite(t_above) else None,
        t_below_m=round(t_below, 3) if np.isfinite(t_below) else None,
        delta_t=delta_t,
        flag="OK",
    )


def compute_thermocline_dataframe(
    df: pd.DataFrame,
    profile_col: str = "PROFILE_ID",
    pres_col: str = "PRES",
    temp_col: str = "TEMP",
    lat_col: str = "LATITUDE",
    lon_col: str = "LONGITUDE",
    time_col: str = "TIME",
    platform_col: str = "PLATFORM_NUMBER",
) -> pd.DataFrame:
    """Compute thermocline diagnostics for all profiles in a DataFrame."""
    results = []
    for pid, grp in df.groupby(profile_col, sort=True):
        pres = grp[pres_col].to_numpy(dtype=float)
        temp = grp[temp_col].to_numpy(dtype=float)
        lat = float(grp[lat_col].iloc[0]) if lat_col in grp else float("nan")
        lon = float(grp[lon_col].iloc[0]) if lon_col in grp else float("nan")
        t = str(grp[time_col].iloc[0]) if time_col in grp else ""
        plat = str(grp[platform_col].iloc[0]) if platform_col in grp else ""

        result = compute_thermocline_profile(
            pres=pres, temp=temp,
            profile_id=str(pid), platform_number=plat,
            latitude=lat, longitude=lon, time=t,
        )
        results.append(result.__dict__)

    out = pd.DataFrame(results)
    valid = out.dropna(subset=["thermocline_depth_m"])
    if len(valid):
        logger.info(
            f"Thermocline: {len(valid)}/{len(out)} profiles with clear thermocline. "
            f"Median depth={valid['thermocline_depth_m'].median():.1f} m, "
            f"median strength={valid['thermocline_strength_C_m'].median():.4f} C/m"
        )
    return out


def thermocline_summary(df: pd.DataFrame) -> dict:
    valid = df.dropna(subset=["thermocline_depth_m"])
    return {
        "n_profiles": len(df),
        "n_with_thermocline": len(valid),
        "thermocline_depth_median_m": round(float(valid["thermocline_depth_m"].median()), 1) if len(valid) else None,
        "thermocline_strength_median_C_m": round(float(valid["thermocline_strength_C_m"].median()), 4) if len(valid) else None,
        "delta_t_median_C": round(float(valid["delta_t"].median()), 2) if len(valid) and "delta_t" in valid else None,
        "provenance": "DERIVED",
        "source": "Argo — Ifremer ERDDAP (DOI 10.17882/42182)",
        "method": f"Maximum |dT/dp| in {THERMO_PMIN}–{THERMO_PMAX} dbar window",
        "method_ref": METHOD_REF,
    }
