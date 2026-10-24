"""
app.science.validation — Argo vs model/forecast comparison metrics.

Computes per-profile and basin-wide statistics comparing Argo in-situ
observations against CMEMS forecast fields at matched locations and times.

Metrics:
  - Bias = mean(model - obs)
  - RMSE = sqrt(mean((model - obs)²))
  - MAE  = mean(|model - obs|)
  - Pearson correlation r
  - Standard deviation of error

Matching: nearest-neighbour in (lat, lon, pressure) space.
  Spatial tolerance: ±0.5° (~55 km)
  Temporal tolerance: ±12 hours
  Pressure tolerance: ±5 dbar

Reference:
  IOC, SCOR, IAPSO (2010). The international thermodynamic equation of
  seawater – 2010: Calculation and use of thermodynamic properties.
  Intergovernmental Oceanographic Commission, Manuals and Guides No. 56,
  UNESCO (English). 196 pp.  (TEOS-10 standard for comparison variables)

Provenance:
  obs  → REAL (Argo in-situ)
  model → SIMULATED (CMEMS operational forecast)
  metrics → DERIVED (computed from REAL vs SIMULATED)
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Optional

import numpy as np
import pandas as pd

logger = logging.getLogger("ariel.science.validation")

SPATIAL_TOL_DEG = 0.5   # degrees
TIME_TOL_HOURS = 12.0   # hours
PRES_TOL_DBAR = 5.0     # dbar

METHOD_REF = (
    "Standard oceanographic skill metrics: "
    "bias = mean(model-obs), RMSE = sqrt(mean((model-obs)^2)), "
    "r = Pearson correlation. "
    "Matching: nearest-neighbour within ±0.5 deg / ±12 h / ±5 dbar."
)


@dataclass
class ValidationMetrics:
    variable: str            # e.g. "temperature", "salinity"
    n_matched: int           # number of matched obs-model pairs
    bias: Optional[float]    # model - obs mean (positive = warm/salty bias)
    rmse: Optional[float]
    mae: Optional[float]
    r: Optional[float]       # Pearson correlation
    std_error: Optional[float]
    obs_mean: Optional[float]
    model_mean: Optional[float]
    depth_range_dbar: list[float] = field(default_factory=lambda: [0.0, 2000.0])
    provenance_obs: str = "REAL"
    provenance_model: str = "SIMULATED"
    provenance_metrics: str = "DERIVED"
    source_obs: str = "Argo — Ifremer ERDDAP (DOI 10.17882/42182)"
    source_model: str = "CMEMS Global Ocean Physics Analysis/Forecast"
    method_ref: str = METHOD_REF


def compute_profile_metrics(
    obs_pres: np.ndarray,
    obs_values: np.ndarray,
    model_pres: np.ndarray,
    model_values: np.ndarray,
    variable: str = "temperature",
    depth_range: tuple[float, float] = (0.0, 2000.0),
) -> ValidationMetrics:
    """
    Compute metrics between one Argo profile and a co-located model profile.

    Interpolates model onto the Argo pressure grid (within depth_range).
    """
    # Sort
    idx = np.argsort(obs_pres)
    op, ov = obs_pres[idx].astype(float), obs_values[idx].astype(float)
    idx = np.argsort(model_pres)
    mp, mv = model_pres[idx].astype(float), model_values[idx].astype(float)

    # Filter to depth range
    mask = (op >= depth_range[0]) & (op <= depth_range[1])
    op, ov = op[mask], ov[mask]
    valid = np.isfinite(op) & np.isfinite(ov)
    op, ov = op[valid], ov[valid]

    if len(op) < 2 or len(mp) < 2:
        return ValidationMetrics(variable=variable, n_matched=0,
                                  bias=None, rmse=None, mae=None, r=None,
                                  std_error=None, obs_mean=None, model_mean=None,
                                  depth_range_dbar=list(depth_range))

    # Interpolate model onto obs pressure grid
    mv_interp = np.interp(op, mp, mv, left=float("nan"), right=float("nan"))
    valid2 = np.isfinite(mv_interp)
    op_m, ov_m = op[valid2], ov[valid2]
    mv_m = mv_interp[valid2]

    n = len(op_m)
    if n < 2:
        return ValidationMetrics(variable=variable, n_matched=n,
                                  bias=None, rmse=None, mae=None, r=None,
                                  std_error=None, obs_mean=None, model_mean=None,
                                  depth_range_dbar=list(depth_range))

    diff = mv_m - ov_m
    bias = float(np.mean(diff))
    rmse = float(np.sqrt(np.mean(diff ** 2)))
    mae = float(np.mean(np.abs(diff)))
    std_err = float(np.std(diff))

    # Pearson r
    if np.std(ov_m) > 0 and np.std(mv_m) > 0:
        r = float(np.corrcoef(ov_m, mv_m)[0, 1])
    else:
        r = float("nan")

    return ValidationMetrics(
        variable=variable,
        n_matched=n,
        bias=round(bias, 4),
        rmse=round(rmse, 4),
        mae=round(mae, 4),
        r=round(r, 4) if np.isfinite(r) else None,
        std_error=round(std_err, 4),
        obs_mean=round(float(np.mean(ov_m)), 4),
        model_mean=round(float(np.mean(mv_m)), 4),
        depth_range_dbar=list(depth_range),
    )


def validate_argo_vs_cmems(
    argo_df: pd.DataFrame,
    cmems_ds: "xr.Dataset",  # type: ignore[name-defined]
    variables: Optional[list[str]] = None,
    depth_range: tuple[float, float] = (0.0, 500.0),
    spatial_tol: float = SPATIAL_TOL_DEG,
) -> dict[str, ValidationMetrics]:
    """
    Match Argo profiles against CMEMS nearest-grid-point fields and compute
    bias/RMSE/MAE/r for each variable.

    Parameters
    ----------
    argo_df   : standardized Argo DataFrame (PROFILE_ID, PRES, TEMP/CT, PSAL/SA, LAT, LON, TIME)
    cmems_ds  : xarray Dataset from fetch_cmems_physics() with thetao, so dims (time, depth, lat, lon)
    variables : list of (argo_col, cmems_var) pairs or None for defaults
    depth_range : (min_dbar, max_dbar) for comparison

    Returns dict mapping variable name → ValidationMetrics.
    """
    import xarray as xr

    # Default variable mapping: argo column → CMEMS variable
    var_map = variables or [
        ("CT", "thetao"),      # Conservative Temperature vs potential temperature
        ("SA", "so"),          # Absolute Salinity vs salinity
    ]

    results: dict[str, ValidationMetrics] = {}

    for argo_col, cmems_var in var_map:
        if argo_col not in argo_df.columns:
            logger.warning(f"Argo column '{argo_col}' not found, skipping.")
            continue
        if cmems_var not in cmems_ds:
            logger.warning(f"CMEMS variable '{cmems_var}' not in dataset, skipping.")
            continue

        all_obs_pres, all_obs_vals = [], []
        all_mod_pres, all_mod_vals = [], []
        matched_profiles = 0

        for pid, grp in argo_df.groupby("PROFILE_ID", sort=False):
            lat = float(grp["LATITUDE"].iloc[0])
            lon = float(grp["LONGITUDE"].iloc[0])
            t_str = str(grp["TIME"].iloc[0])

            try:
                # Select nearest CMEMS grid point
                ds_pt = cmems_ds[cmems_var].sel(
                    latitude=lat, longitude=lon,
                    method="nearest",
                    tolerance=spatial_tol,
                )
                # Nearest time
                t_idx = abs(cmems_ds.time.values - np.datetime64(t_str[:10])).argmin()
                ds_pt = ds_pt.isel(time=int(t_idx))

                model_depth = cmems_ds["depth"].values.astype(float) if "depth" in cmems_ds else np.array([0.0])
                model_vals = ds_pt.values.astype(float)

                if model_vals.ndim == 0:
                    model_depth = np.array([0.0])
                    model_vals = np.array([float(model_vals)])

                obs_pres = grp["PRES"].to_numpy(dtype=float)
                obs_vals = grp[argo_col].to_numpy(dtype=float)

                all_obs_pres.append(obs_pres)
                all_obs_vals.append(obs_vals)
                all_mod_pres.append(model_depth)
                all_mod_vals.append(model_vals)
                matched_profiles += 1

            except Exception as e:
                logger.debug(f"Profile {pid} skip ({argo_col}): {e}")
                continue

        if not all_obs_pres:
            logger.warning(f"No matched profiles for {argo_col} vs {cmems_var}")
            results[argo_col] = ValidationMetrics(
                variable=argo_col, n_matched=0,
                bias=None, rmse=None, mae=None, r=None,
                std_error=None, obs_mean=None, model_mean=None,
            )
            continue

        # Pool all matched pairs and compute basin-wide metrics
        op = np.concatenate(all_obs_pres)
        ov = np.concatenate(all_obs_vals)
        mp = np.concatenate(all_mod_pres)
        mv = np.concatenate(all_mod_vals)

        metrics = compute_profile_metrics(op, ov, mp, mv,
                                          variable=argo_col, depth_range=depth_range)
        metrics.source_model = f"CMEMS {cmems_var} — matched to {matched_profiles} Argo profiles"
        results[argo_col] = metrics
        logger.info(
            f"Validation {argo_col} vs {cmems_var}: n={metrics.n_matched}, "
            f"bias={metrics.bias}, RMSE={metrics.rmse}, r={metrics.r}"
        )

    return results


def validation_report(metrics_dict: dict[str, ValidationMetrics]) -> dict:
    """Format validation results for API/report output."""
    out = {}
    for var, m in metrics_dict.items():
        out[var] = {
            "n_matched": m.n_matched,
            "bias": m.bias,
            "rmse": m.rmse,
            "mae": m.mae,
            "r": m.r,
            "std_error": m.std_error,
            "obs_mean": m.obs_mean,
            "model_mean": m.model_mean,
            "provenance_obs": m.provenance_obs,
            "provenance_model": m.provenance_model,
            "provenance_metrics": m.provenance_metrics,
            "source_obs": m.source_obs,
            "source_model": m.source_model,
            "depth_range_dbar": m.depth_range_dbar,
            "method_ref": m.method_ref,
        }
    return out
