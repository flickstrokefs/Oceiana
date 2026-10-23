"""
app.science.barrier_layer — Barrier Layer Thickness (BLT) from Argo profiles.

Definitions:
  - Isothermal Layer Depth (ILD): Depth where Temperature = T(10 dbar) - delta_T
    where delta_T = 0.2 °C (de Boyer Montégut et al. 2004, 2007).
  - Mixed Layer Depth (MLD): Depth where Potential Density sigma0 = sigma0(10 dbar) + delta_sigma
    where delta_sigma = 0.03 kg/m³.
  - Barrier Layer Thickness (BLT) = max(0, ILD - MLD).

Oceanographic significance:
  In the Bay of Bengal, heavy monsoon precipitation and river runoff (Ganges-Brahmaputra)
  create a thin, fresh, low-density surface layer (halocline shallower than thermocline).
  This traps a warm isothermal layer beneath the mixed layer (a "barrier layer"),
  inhibiting turbulent vertical heat exchange and fostering rapid cyclone intensification.

References:
  - Sprintall, J., & Tomczak, M. (1992). Evidence of the barrier layer in the surface layer
    of the tropics. J. Geophys. Res., 97(C5), 7305–7316. https://doi.org/10.1029/92JC00407
  - de Boyer Montégut, C., et al. (2007). Barrier layer in the tropical Indian Ocean:
    Seasonal cycle and forcing mechanisms. J. Geophys. Res., 112(C4), C04015.
    https://doi.org/10.1029/2006JC003554
  - Vinayachandran, P. N., et al. (2002). Observations of large barrier layer after
    summer monsoon in the Bay of Bengal. Tellus A, 54(5), 542–548.

Provenance: DERIVED from REAL Argo profiles (TEOS-10 / in-situ CTD).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Optional

import numpy as np
import pandas as pd

from app.science.mld import compute_mld_profile, DELTA_SIGMA, REF_PRES

logger = logging.getLogger("ariel.science.barrier_layer")

DELTA_T = 0.2  # °C temperature threshold criterion
MIN_BLT = 5.0  # m — minimum threshold to avoid spurious thin barrier layers (de Boyer Montégut et al. 2007 Sec 2.1)
METHOD_REF = (
    "Sprintall & Tomczak (1992), JGR, 97(C5); "
    "de Boyer Montégut et al. (2007), JGR, 112(C4). https://doi.org/10.1029/2006JC003554"
)


@dataclass
class BarrierLayerResult:
    profile_id: str
    platform_number: str
    latitude: float
    longitude: float
    time: str
    ild_m: Optional[float]           # Isothermal Layer Depth (m)
    mld_m: Optional[float]           # Mixed Layer Depth (m)
    blt_m: Optional[float]           # Barrier Layer Thickness = max(0, ILD - MLD) (m)
    temp_surface: Optional[float]    # Temperature at reference depth (°C)
    n_levels: int
    provenance: str = "DERIVED"
    source: str = "Argo — Ifremer ERDDAP (DOI 10.17882/42182)"
    method: str = f"BLT = max(0, ILD - MLD) with {MIN_BLT}m threshold; ILD (ΔT={DELTA_T}°C), MLD (Δσ={DELTA_SIGMA} kg/m³)"
    method_ref: str = METHOD_REF
    flag: str = "OK"                 # OK | NO_BARRIER | SHALLOW | NO_REF


def compute_ild_profile(
    pres: np.ndarray,
    temp: np.ndarray,
    delta_t: float = DELTA_T,
    ref_pres: float = REF_PRES,
) -> tuple[Optional[float], Optional[float], str]:
    """
    Compute Isothermal Layer Depth (ILD) as depth where temp = temp(ref_pres) - delta_t.
    Returns (ild_m, temp_ref, flag).
    """
    valid = np.isfinite(pres) & np.isfinite(temp)
    p = pres[valid].astype(float)
    t = temp[valid].astype(float)

    if len(p) < 3:
        return None, None, "SHALLOW"

    sort_idx = np.argsort(p)
    p, t = p[sort_idx], t[sort_idx]

    if ref_pres < p.min() or ref_pres > p.max():
        t_ref = float(t[0])
        flag = "NO_REF"
    else:
        t_ref = float(np.interp(ref_pres, p, t))
        flag = "OK"

    target_t = t_ref - delta_t

    # Find first depth below ref_pres where temperature <= target_t
    ref_idx = int(np.searchsorted(p, ref_pres))
    p_sub = p[ref_idx:]
    t_sub = t[ref_idx:]

    drop_indices = np.where(t_sub <= target_t)[0]
    if len(drop_indices) == 0:
        # Temperature never drops by delta_t in profile
        return float(p[-1]), t_ref, "DEEP_ISOTHERMAL"

    k = drop_indices[0]
    global_k = ref_idx + k
    if global_k == 0:
        ild = float(p[0])
    else:
        p0, p1 = p[global_k - 1], p[global_k]
        t0, t1 = t[global_k - 1], t[global_k]
        if abs(t1 - t0) > 1e-6:
            frac = (target_t - t0) / (t1 - t0)
            ild = float(p0 + frac * (p1 - p0))
        else:
            ild = float(p1)

    return round(float(ild), 1), round(t_ref, 3), flag


def compute_barrier_layer_profile(
    pres: np.ndarray,
    temp: np.ndarray,
    sigma0: np.ndarray,
    profile_id: str = "",
    platform_number: str = "",
    latitude: float = float("nan"),
    longitude: float = float("nan"),
    time: str = "",
    delta_t: float = DELTA_T,
    delta_sigma: float = DELTA_SIGMA,
    ref_pres: float = REF_PRES,
    min_blt: float = MIN_BLT,
) -> BarrierLayerResult:
    """
    Compute Barrier Layer Thickness (BLT) for a single Argo profile.
    Applies min_blt (default 5.0 m) significance threshold (de Boyer Montégut et al. 2007).
    """
    ild, t_ref, ild_flag = compute_ild_profile(pres, temp, delta_t=delta_t, ref_pres=ref_pres)
    mld_res = compute_mld_profile(pres, sigma0, delta_sigma=delta_sigma, ref_pres=ref_pres)
    mld = mld_res.mld_m

    n_levels = int((np.isfinite(pres) & np.isfinite(temp) & np.isfinite(sigma0)).sum())
    meta = dict(
        profile_id=profile_id,
        platform_number=platform_number,
        latitude=latitude,
        longitude=longitude,
        time=time,
        n_levels=n_levels,
        temp_surface=t_ref,
    )

    if ild is None or mld is None:
        flag = ild_flag if ild is None else mld_res.flag
        return BarrierLayerResult(**meta, ild_m=ild, mld_m=mld, blt_m=None, flag=flag)

    diff = ild - mld
    if diff >= min_blt:
        blt = round(float(diff), 1)
        flag = "OK"
    else:
        blt = 0.0
        flag = "NO_BARRIER"

    return BarrierLayerResult(
        **meta,
        ild_m=ild,
        mld_m=mld,
        blt_m=blt,
        flag=flag,
    )


def compute_barrier_layer_dataframe(
    df: pd.DataFrame,
    pres_col: str = "PRES",
    temp_col: str = "TEMP",
    sigma0_col: str = "SIGMA0",
    profile_id_col: str = "PROFILE_ID",
    platform_col: str = "PLATFORM_NUMBER",
    lat_col: str = "LATITUDE",
    lon_col: str = "LONGITUDE",
    time_col: str = "TIME",
) -> pd.DataFrame:
    """
    Compute BLT for all profiles in an Argo DataFrame.
    """
    if df.empty:
        return pd.DataFrame()

    rows = []
    for pid, grp in df.groupby(profile_id_col, sort=False):
        row0 = grp.iloc[0]
        pres = grp[pres_col].values
        temp = grp[temp_col].values
        sigma0 = grp[sigma0_col].values if sigma0_col in grp.columns else grp["sigma0"].values

        res = compute_barrier_layer_profile(
            pres=pres,
            temp=temp,
            sigma0=sigma0,
            profile_id=str(pid),
            platform_number=str(row0.get(platform_col, "")),
            latitude=float(row0.get(lat_col, float("nan"))),
            longitude=float(row0.get(lon_col, float("nan"))),
            time=str(row0.get(time_col, "")),
        )
        rows.append(res.__dict__)

    return pd.DataFrame(rows)


def barrier_layer_summary(df_blt: pd.DataFrame) -> dict:
    """Aggregate statistics for BLT analysis."""
    if df_blt.empty:
        return {"n_profiles": 0, "blt_median_m": None}

    valid_blt = df_blt["blt_m"].dropna()
    valid_ild = df_blt["ild_m"].dropna()
    valid_mld = df_blt["mld_m"].dropna()

    positive_blt = valid_blt[valid_blt > 0]

    return {
        "n_profiles_total": len(df_blt),
        "n_profiles_valid": len(valid_blt),
        "n_profiles_with_barrier_layer": len(positive_blt),
        "barrier_layer_prevalence_pct": round(100.0 * len(positive_blt) / len(valid_blt), 1) if len(valid_blt) > 0 else 0.0,
        "blt_median_m": round(float(valid_blt.median()), 1) if not valid_blt.empty else None,
        "blt_mean_m": round(float(valid_blt.mean()), 1) if not valid_blt.empty else None,
        "blt_max_m": round(float(valid_blt.max()), 1) if not valid_blt.empty else None,
        "ild_median_m": round(float(valid_ild.median()), 1) if not valid_ild.empty else None,
        "mld_median_m": round(float(valid_mld.median()), 1) if not valid_mld.empty else None,
        "provenance": "DERIVED",
        "method": f"BLT = max(0, ILD - MLD); Sprintall & Tomczak (1992), de Boyer Montégut et al. (2007)",
    }
