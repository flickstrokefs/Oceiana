"""
app.science.tchp — Tropical Cyclone Heat Potential (TCHP) and D26 from Argo profiles.

D26: Depth of the 26°C isotherm.
  The 26°C threshold is the empirical minimum SST for tropical cyclone
  intensification (Gray 1968; Emanuel 1986).

TCHP: Tropical Cyclone Heat Potential (kJ/cm²).
  Defined as the heat content between the surface and D26:
      TCHP = ρ·Cp · ∫₀^D26  max(T(z) - 26, 0) dz
  Units: kJ/cm²  (multiply by 1e-7 to convert from J/m² to kJ/cm²)

References:
  Leipper, D. F., & Volgenau, D. (1972). Hurricane heat potential of the
    Gulf of Mexico. Journal of Physical Oceanography, 2(3), 218–224.
    https://doi.org/10.1175/1520-0485(1972)002<0218:HHPOTG>2.0.CO;2

  Shay, L. K., Goni, G. J., & Black, P. G. (2000). Effects of a warm
    oceanic feature on Hurricane Opal. Monthly Weather Review, 128(5), 1366–1383.
    https://doi.org/10.1175/1520-0493(2000)128<1366:EOAWOF>2.0.CO;2

Constants:
  rho = 1025 kg/m³  (reference seawater density, upper ocean)
  Cp  = 3985 J/(kg·K) (specific heat of seawater at constant pressure)
  T_crit = 26°C

Provenance: DERIVED from REAL Argo Conservative Temperature (CT) profiles.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Optional

import numpy as np
import pandas as pd

logger = logging.getLogger("ariel.science.tchp")

# Physical constants
RHO_SW = 1025.0          # kg/m³  — reference seawater density
CP_SW = 3985.0           # J/(kg·K) — specific heat of seawater
T_CRIT = 26.0            # °C — cyclone intensification threshold
RHO_CP = RHO_SW * CP_SW  # J/(m³·K)

METHOD_REF_D26 = (
    "Gray, W. M. (1968). Global view of the origin of tropical disturbances "
    "and storms. Monthly Weather Review, 96(10), 669–700."
)
METHOD_REF_TCHP = (
    "Shay, L. K., Goni, G. J., & Black, P. G. (2000). Effects of a warm "
    "oceanic feature on Hurricane Opal. Monthly Weather Review, 128(5), 1366–1383. "
    "https://doi.org/10.1175/1520-0493(2000)128<1366:EOAWOF>2.0.CO;2"
)


@dataclass
class TCHPResult:
    profile_id: str
    platform_number: str
    latitude: float
    longitude: float
    time: str
    d26_m: Optional[float]       # Depth of 26°C isotherm (m ≈ dbar)
    tchp_kj_cm2: Optional[float] # Tropical Cyclone Heat Potential (kJ/cm²)
    sst_ct: Optional[float]      # Conservative Temperature at shallowest level (°C)
    t_at_d26: Optional[float]    # CT at D26 (should be ≈26°C if interpolated)
    n_levels: int
    provenance: str = "DERIVED"
    source: str = "Argo — Ifremer ERDDAP (DOI 10.17882/42182)"
    method_d26: str = f"Depth of {T_CRIT}°C isotherm (conservative temperature)"
    method_tchp: str = f"rho*Cp * integral(max(CT-{T_CRIT},0) dz) from 0 to D26"
    method_ref: str = METHOD_REF_TCHP
    flag: str = "OK"   # OK | NO_D26 | SHALLOW | SURFACE_BELOW_26


def compute_tchp_profile(
    pres: np.ndarray,
    ct: np.ndarray,
    profile_id: str = "",
    platform_number: str = "",
    latitude: float = float("nan"),
    longitude: float = float("nan"),
    time: str = "",
    t_crit: float = T_CRIT,
) -> TCHPResult:
    """
    Compute D26 and TCHP for a single Argo profile.

    Parameters
    ----------
    pres : pressure array (dbar; treated as depth in metres for upper ocean)
    ct   : Conservative Temperature array (°C), from gsw; same length as pres
    t_crit : isotherm threshold temperature (default 26°C)

    Returns TCHPResult.  tchp_kj_cm2 is None if surface CT < 26°C.
    """
    sort_idx = np.argsort(pres)
    p = pres[sort_idx].astype(float)
    t = ct[sort_idx].astype(float)

    valid = np.isfinite(p) & np.isfinite(t)
    p, t = p[valid], t[valid]

    meta = dict(profile_id=profile_id, platform_number=platform_number,
                latitude=latitude, longitude=longitude, time=time,
                n_levels=int(valid.sum()))

    if len(p) < 2:
        return TCHPResult(**meta, d26_m=None, tchp_kj_cm2=None,
                          sst_ct=None, t_at_d26=None, flag="SHALLOW")

    sst_ct = float(t[0])

    if sst_ct < t_crit:
        # Surface already below threshold — TCHP=0 by definition
        return TCHPResult(**meta, d26_m=0.0, tchp_kj_cm2=0.0,
                          sst_ct=round(sst_ct, 3), t_at_d26=round(sst_ct, 3),
                          flag="SURFACE_BELOW_26")

    # Find D26: first depth where CT drops below t_crit
    below = np.where(t <= t_crit)[0]
    if len(below) == 0:
        # CT stays above 26°C throughout profile — D26 deeper than max depth
        d26 = float(p[-1])
        flag = "NO_D26"
    else:
        i = below[0]
        if i == 0:
            d26 = float(p[0])
            flag = "SURFACE_BELOW_26"
        else:
            # Linear interpolation between levels i-1 and i
            p0, p1 = p[i - 1], p[i]
            t0, t1 = t[i - 1], t[i]
            if t0 > t1:
                frac = (t0 - t_crit) / (t0 - t1)
                d26 = float(p0 + frac * (p1 - p0))
            else:
                d26 = float(p[i])
            flag = "OK"

    # Integrate TCHP from surface to D26
    # Clip profile to [0, D26] and compute ∫ max(CT-26,0) dz using trapz
    p_int = np.append(p[p <= d26], d26)
    t_int = np.append(t[p <= d26], float(np.interp(d26, p, t)))

    integrand = np.maximum(t_int - t_crit, 0.0)
    # dz in metres (pressure in dbar, 1 dbar ≈ 1 m in upper ocean)
    heat_j_m2 = float(np.trapezoid(integrand, p_int)) * RHO_CP
    tchp = heat_j_m2 * 1e-7    # J/m² → kJ/cm²

    return TCHPResult(
        **meta,
        d26_m=round(d26, 1),
        tchp_kj_cm2=round(tchp, 2),
        sst_ct=round(sst_ct, 3),
        t_at_d26=round(float(np.interp(d26, p, t)), 3),
        flag=flag,
    )


def compute_tchp_dataframe(
    df: pd.DataFrame,
    profile_col: str = "PROFILE_ID",
    pres_col: str = "PRES",
    ct_col: str = "CT",
    lat_col: str = "LATITUDE",
    lon_col: str = "LONGITUDE",
    time_col: str = "TIME",
    platform_col: str = "PLATFORM_NUMBER",
) -> pd.DataFrame:
    """
    Compute D26 and TCHP for all profiles in a standardized Argo DataFrame.

    Requires CT column (Conservative Temperature from TEOS-10).
    Returns per-profile DataFrame.
    """
    if ct_col not in df.columns:
        raise ValueError(
            f"Column '{ct_col}' not found. Run compute_teos10() to add CT first."
        )

    results = []
    for pid, grp in df.groupby(profile_col, sort=True):
        pres = grp[pres_col].to_numpy(dtype=float)
        ct = grp[ct_col].to_numpy(dtype=float)
        lat = float(grp[lat_col].iloc[0]) if lat_col in grp else float("nan")
        lon = float(grp[lon_col].iloc[0]) if lon_col in grp else float("nan")
        t = str(grp[time_col].iloc[0]) if time_col in grp else ""
        plat = str(grp[platform_col].iloc[0]) if platform_col in grp else ""

        result = compute_tchp_profile(
            pres=pres, ct=ct,
            profile_id=str(pid), platform_number=plat,
            latitude=lat, longitude=lon, time=t,
        )
        results.append(result.__dict__)

    out = pd.DataFrame(results)
    valid = out.dropna(subset=["d26_m"])
    logger.info(
        f"TCHP computed for {len(out)} profiles. "
        f"Median D26={valid['d26_m'].median():.1f} m, "
        f"Median TCHP={valid['tchp_kj_cm2'].median():.2f} kJ/cm². "
        f"Flags: {out['flag'].value_counts().to_dict()}"
    )
    return out


def tchp_summary(tchp_df: pd.DataFrame) -> dict:
    """Return a provenance-tagged summary dict for API responses."""
    valid = tchp_df.dropna(subset=["tchp_kj_cm2"])
    return {
        "n_profiles": len(tchp_df),
        "n_valid": len(valid),
        "d26_median_m": round(float(valid["d26_m"].median()), 1) if len(valid) else None,
        "d26_mean_m": round(float(valid["d26_m"].mean()), 1) if len(valid) else None,
        "tchp_median_kj_cm2": round(float(valid["tchp_kj_cm2"].median()), 2) if len(valid) else None,
        "tchp_max_kj_cm2": round(float(valid["tchp_kj_cm2"].max()), 2) if len(valid) else None,
        "sst_mean_ct": round(float(tchp_df["sst_ct"].mean()), 2) if "sst_ct" in tchp_df else None,
        "provenance": "DERIVED",
        "source": "Argo — Ifremer ERDDAP (DOI 10.17882/42182)",
        "method_d26": f"Depth of {T_CRIT}°C Conservative Temperature isotherm",
        "method_tchp": "rho*Cp * trapz(max(CT-26,0), dz), Shay et al. 2000",
        "method_ref": METHOD_REF_TCHP,
        "constants": {"rho_kg_m3": RHO_SW, "Cp_J_kgK": CP_SW, "T_crit_C": T_CRIT},
    }
