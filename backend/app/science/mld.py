"""
app.science.mld — Mixed Layer Depth calculation from Argo profiles.

Method: Density threshold criterion.
  MLD = depth at which potential density (sigma0) exceeds surface value
        (at 10 dbar reference) by delta_sigma = 0.03 kg/m³.

Reference:
  de Boyer Montégut, C., Madec, G., Fischer, A. S., Lazar, A., & Iudicone, D. (2004).
  Mixed layer depth over the global ocean: An examination of profile data and a
  profile-based climatology. Journal of Geophysical Research: Oceans, 109(C12).
  https://doi.org/10.1029/2004JC002378

Delta criterion: 0.03 kg/m³  (standard; matches INCOIS operational product)
Reference depth: 10 dbar      (avoids diurnal skin effect near surface)

Provenance: DERIVED from REAL Argo measurements (TEOS-10 sigma0 via gsw).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Optional

import numpy as np
import pandas as pd

logger = logging.getLogger("ariel.science.mld")

# de Boyer Montégut 2004 — density threshold
DELTA_SIGMA = 0.03   # kg/m³
REF_PRES = 10.0      # dbar — reference level (avoids diurnal surface noise)

METHOD_REF = (
    "de Boyer Montégut et al. (2004), JGR Oceans, 109(C12). "
    "https://doi.org/10.1029/2004JC002378"
)


@dataclass
class MLDResult:
    profile_id: str
    platform_number: str
    latitude: float
    longitude: float
    time: str
    mld_m: Optional[float]           # MLD in metres (≈ dbar for upper ocean)
    sigma0_surface: Optional[float]  # sigma0 at reference depth (kg/m³)
    sigma0_at_mld: Optional[float]   # sigma0 at MLD (kg/m³)
    n_levels: int                    # number of valid levels in profile
    provenance: str = "DERIVED"
    source: str = "Argo — Ifremer ERDDAP (DOI 10.17882/42182)"
    method: str = f"Density threshold {DELTA_SIGMA} kg/m³ at {REF_PRES} dbar ref"
    method_ref: str = METHOD_REF
    flag: str = "OK"                 # OK | SHALLOW | NO_REF | MONOTONE_FAIL


def compute_mld_profile(
    pres: np.ndarray,
    sigma0: np.ndarray,
    profile_id: str = "",
    platform_number: str = "",
    latitude: float = float("nan"),
    longitude: float = float("nan"),
    time: str = "",
    delta_sigma: float = DELTA_SIGMA,
    ref_pres: float = REF_PRES,
) -> MLDResult:
    """
    Compute MLD for a single Argo profile using the density threshold criterion.

    Parameters
    ----------
    pres    : pressure array (dbar), need not be sorted
    sigma0  : potential density anomaly (kg/m³), same length as pres
    delta_sigma : threshold density difference (default 0.03 kg/m³)
    ref_pres    : reference pressure level (default 10 dbar)

    Returns MLDResult with mld_m in metres (dbar ≈ m for upper ocean).
    """
    # Sort by pressure ascending
    sort_idx = np.argsort(pres)
    p = pres[sort_idx].astype(float)
    s = sigma0[sort_idx].astype(float)

    # Remove NaN
    valid = np.isfinite(p) & np.isfinite(s)
    p, s = p[valid], s[valid]

    meta = dict(profile_id=profile_id, platform_number=platform_number,
                latitude=latitude, longitude=longitude, time=time,
                n_levels=int(valid.sum()))

    if len(p) < 3:
        return MLDResult(**meta, mld_m=None, sigma0_surface=None,
                         sigma0_at_mld=None, flag="SHALLOW")

    # Interpolate sigma0 at reference pressure
    if ref_pres < p.min() or ref_pres > p.max():
        # Use shallowest available level as reference
        sigma_ref = float(s[0])
        ref_used = float(p[0])
        flag = "NO_REF"
    else:
        sigma_ref = float(np.interp(ref_pres, p, s))
        ref_used = ref_pres
        flag = "OK"

    threshold = sigma_ref + delta_sigma

    # Find first depth where sigma0 >= threshold
    exceed = np.where(s >= threshold)[0]
    if len(exceed) == 0:
        # Density never exceeds threshold — deep mixed layer or bad profile
        mld = float(p[-1])
        flag = "MONOTONE_FAIL" if flag == "OK" else flag
        return MLDResult(**meta, mld_m=mld, sigma0_surface=round(sigma_ref, 4),
                         sigma0_at_mld=round(float(s[-1]), 4), flag="MONOTONE_FAIL")

    i = exceed[0]
    if i == 0:
        mld = float(p[0])
    else:
        # Linear interpolation between level i-1 and i
        p0, p1 = p[i - 1], p[i]
        s0, s1 = s[i - 1], s[i]
        if s1 > s0:
            frac = (threshold - s0) / (s1 - s0)
            mld = float(p0 + frac * (p1 - p0))
        else:
            mld = float(p[i])

    return MLDResult(
        **meta,
        mld_m=round(mld, 1),
        sigma0_surface=round(sigma_ref, 4),
        sigma0_at_mld=round(float(np.interp(mld, p, s)), 4),
        flag=flag,
    )


def compute_mld_dataframe(
    df: pd.DataFrame,
    profile_col: str = "PROFILE_ID",
    pres_col: str = "PRES",
    sigma0_col: str = "SIGMA0",
    lat_col: str = "LATITUDE",
    lon_col: str = "LONGITUDE",
    time_col: str = "TIME",
    platform_col: str = "PLATFORM_NUMBER",
    delta_sigma: float = DELTA_SIGMA,
) -> pd.DataFrame:
    """
    Compute MLD for all profiles in a standardized Argo DataFrame.

    Input DataFrame must have SIGMA0 column (from compute_teos10).
    Returns a per-profile DataFrame with columns:
      profile_id, platform_number, latitude, longitude, time,
      mld_m, sigma0_surface, sigma0_at_mld, n_levels,
      provenance, source, method, flag
    """
    if sigma0_col not in df.columns:
        raise ValueError(
            f"Column '{sigma0_col}' not found. Run compute_teos10() first to add SIGMA0."
        )

    results = []
    for pid, grp in df.groupby(profile_col, sort=True):
        pres = grp[pres_col].to_numpy(dtype=float)
        sigma0 = grp[sigma0_col].to_numpy(dtype=float)
        lat = float(grp[lat_col].iloc[0]) if lat_col in grp else float("nan")
        lon = float(grp[lon_col].iloc[0]) if lon_col in grp else float("nan")
        t = str(grp[time_col].iloc[0]) if time_col in grp else ""
        plat = str(grp[platform_col].iloc[0]) if platform_col in grp else ""

        result = compute_mld_profile(
            pres=pres, sigma0=sigma0,
            profile_id=str(pid), platform_number=plat,
            latitude=lat, longitude=lon, time=t,
            delta_sigma=delta_sigma,
        )
        results.append(result.__dict__)

    out = pd.DataFrame(results)
    logger.info(
        f"MLD computed for {len(out)} profiles. "
        f"Median MLD={out['mld_m'].median():.1f} m, "
        f"Flag counts: {out['flag'].value_counts().to_dict()}"
    )
    return out


def mld_summary(mld_df: pd.DataFrame) -> dict:
    """Return a provenance-tagged summary dict for API responses."""
    valid = mld_df.dropna(subset=["mld_m"])
    return {
        "n_profiles": len(mld_df),
        "n_valid": len(valid),
        "mld_median_m": round(float(valid["mld_m"].median()), 1) if len(valid) else None,
        "mld_mean_m": round(float(valid["mld_m"].mean()), 1) if len(valid) else None,
        "mld_min_m": round(float(valid["mld_m"].min()), 1) if len(valid) else None,
        "mld_max_m": round(float(valid["mld_m"].max()), 1) if len(valid) else None,
        "provenance": "DERIVED",
        "source": "Argo — Ifremer ERDDAP (DOI 10.17882/42182)",
        "method": f"Density threshold {DELTA_SIGMA} kg/m³ at {REF_PRES} dbar ref",
        "method_ref": METHOD_REF,
    }
