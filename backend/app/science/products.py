"""
app.science.products — Orchestrator: compute all science products for a region/time.

Loads real Argo data from cache, runs TEOS-10, then computes:
  MLD, thermocline, TCHP — all from Argo (DERIVED from REAL)
  Front detection         — from SST/chl cache if available (DERIVED from REAL)
  Validation vs CMEMS     — if CMEMS cache exists (DERIVED from REAL+SIMULATED)

All results are tagged with provenance and source.
No synthetic data is ever used.

Usage:
    from app.science.products import compute_all_products

    report = compute_all_products(start="2020-01-01", end="2020-02-01")
    # report["mld"], report["tchp"], report["thermocline"], etc.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd

logger = logging.getLogger("ariel.science.products")

BOB_BBOX = [80.0, 5.0, 100.0, 23.0]


def load_argo_as_dataframe(
    start: str = "2020-01-01",
    end: str = "2020-02-01",
) -> Optional[pd.DataFrame]:
    """
    Load real Argo data (from cache or committed file) as a flat DataFrame
    with PROFILE_ID, PRES, TEMP, PSAL, LATITUDE, LONGITUDE, TIME, PLATFORM_NUMBER,
    SA, CT, SIGMA0 columns.

    Returns None if data is not available.
    """
    try:
        from app.data.argo_fetch import load_argo_cache
        import xarray as xr

        ds = load_argo_cache(start=start, end=end)
    except Exception as e:
        logger.error(f"Could not load Argo data: {e}")
        return None

    try:
        # Build DataFrame from xarray
        dim = list(ds.dims)[0]  # N_POINTS or index

        def _get(var, default=None):
            if var in ds:
                return ds[var].values
            return default

        df = pd.DataFrame({
            "PRES": _get("PRES"),
            "TEMP": _get("TEMP"),
            "PSAL": _get("PSAL"),
            "LATITUDE": _get("LATITUDE"),
            "LONGITUDE": _get("LONGITUDE"),
            "PLATFORM_NUMBER": _get("PLATFORM_NUMBER"),
            "CYCLE_NUMBER": _get("CYCLE_NUMBER"),
        })

        # TIME — may be stored differently by argopy
        if "TIME" in ds:
            df["TIME"] = pd.to_datetime(ds["TIME"].values).astype(str)
        elif "JULD" in ds:
            df["TIME"] = pd.to_datetime(ds["JULD"].values).astype(str)
        else:
            df["TIME"] = "unknown"

        # SA and CT — may be pre-computed by argo_fetch
        if "SA" in ds:
            df["SA"] = _get("SA")
        if "CT" in ds:
            df["CT"] = _get("CT")

        # Build PROFILE_ID from platform + cycle
        plat = df["PLATFORM_NUMBER"].astype(str).str.strip()
        cyc = df["CYCLE_NUMBER"].astype(str).str.strip() if "CYCLE_NUMBER" in df else "0"
        df["PROFILE_ID"] = plat + "_" + cyc

        df = df.dropna(subset=["PRES", "TEMP", "PSAL", "LATITUDE", "LONGITUDE"])
        df = df.sort_values(["PROFILE_ID", "PRES"]).reset_index(drop=True)

        # Compute TEOS-10 if not already done
        if "SA" not in df.columns or "CT" not in df.columns or "SIGMA0" not in df.columns:
            from app.processing.teos10 import compute_teos10
            df = compute_teos10(df)

        logger.info(f"Argo DataFrame ready: {len(df)} rows, {df['PROFILE_ID'].nunique()} profiles")
        return df

    except Exception as e:
        logger.error(f"Error building Argo DataFrame from xarray: {e}")
        return None


def compute_all_products(
    start: str = "2020-01-01",
    end: str = "2020-02-01",
    region: str = "bob",
    include_fronts: bool = True,
    include_validation: bool = False,   # needs CMEMS cache
) -> dict:
    """
    Compute all science products for the given time window.

    Returns a dict:
    {
      "metadata": {...},
      "mld": {summary_dict},
      "tchp": {summary_dict},
      "thermocline": {summary_dict},
      "mld_profiles": [list of per-profile results],
      "tchp_profiles": [list of per-profile results],
      "thermocline_profiles": [list of per-profile results],
      "fronts_sst": {front_summary} or None,
      "fronts_chl": {front_summary} or None,
      "validation": {validation_report} or None,
      "provenance": "DERIVED",
      "source": "Argo — Ifremer ERDDAP (DOI 10.17882/42182)",
    }
    """
    result: dict = {
        "metadata": {
            "start": start,
            "end": end,
            "region": region,
            "bbox": BOB_BBOX,
            "provenance": "DERIVED",
            "source": "Argo — Ifremer ERDDAP (DOI 10.17882/42182)",
        },
        "mld": None,
        "tchp": None,
        "thermocline": None,
        "mld_profiles": [],
        "tchp_profiles": [],
        "thermocline_profiles": [],
        "fronts_sst": None,
        "fronts_chl": None,
        "validation": None,
    }

    # ── 1. Load Argo ────────────────────────────────────────────────────────────
    df = load_argo_as_dataframe(start=start, end=end)
    if df is None or df.empty:
        result["metadata"]["error"] = "No Argo data available. Run app.data.refresh first."
        return result

    result["metadata"]["n_profiles"] = int(df["PROFILE_ID"].nunique())
    result["metadata"]["n_obs"] = int(len(df))

    # ── 2. MLD ──────────────────────────────────────────────────────────────────
    if "SIGMA0" in df.columns:
        try:
            from app.science.mld import compute_mld_dataframe, mld_summary
            mld_df = compute_mld_dataframe(df)
            result["mld"] = mld_summary(mld_df)
            result["mld_profiles"] = mld_df.to_dict(orient="records")
            logger.info(f"MLD: median={result['mld']['mld_median_m']} m")
        except Exception as e:
            logger.error(f"MLD computation failed: {e}")
            result["mld"] = {"error": str(e)}
    else:
        result["mld"] = {"error": "SIGMA0 not in DataFrame. TEOS-10 required."}

    # ── 3. TCHP ─────────────────────────────────────────────────────────────────
    if "CT" in df.columns:
        try:
            from app.science.tchp import compute_tchp_dataframe, tchp_summary
            tchp_df = compute_tchp_dataframe(df)
            result["tchp"] = tchp_summary(tchp_df)
            result["tchp_profiles"] = tchp_df.to_dict(orient="records")
            logger.info(f"TCHP: median D26={result['tchp']['d26_median_m']} m, "
                        f"median TCHP={result['tchp']['tchp_median_kj_cm2']} kJ/cm²")
        except Exception as e:
            logger.error(f"TCHP computation failed: {e}")
            result["tchp"] = {"error": str(e)}
    else:
        result["tchp"] = {"error": "CT not in DataFrame. TEOS-10 required."}

    # ── 4. Thermocline ──────────────────────────────────────────────────────────
    try:
        from app.science.thermocline import compute_thermocline_dataframe, thermocline_summary
        thermo_df = compute_thermocline_dataframe(df)
        result["thermocline"] = thermocline_summary(thermo_df)
        result["thermocline_profiles"] = thermo_df.to_dict(orient="records")
        logger.info(f"Thermocline: median={result['thermocline']['thermocline_depth_median_m']} m")
    except Exception as e:
        logger.error(f"Thermocline computation failed: {e}")
        result["thermocline"] = {"error": str(e)}

    # ── 4b. Barrier Layer ───────────────────────────────────────────────────────
    try:
        from app.science.barrier_layer import compute_barrier_layer_dataframe, barrier_layer_summary
        blt_df = compute_barrier_layer_dataframe(df)
        result["barrier_layer"] = barrier_layer_summary(blt_df)
        result["barrier_layer_profiles"] = blt_df.to_dict(orient="records")
        logger.info(f"Barrier layer: median={result['barrier_layer']['blt_median_m']} m")
    except Exception as e:
        logger.error(f"Barrier layer computation failed: {e}")
        result["barrier_layer"] = {"error": str(e)}

    # ── 5. Front detection (SST/chl) ────────────────────────────────────────────
    if include_fronts:
        try:
            from app.data.sst_chl_fetch import load_sst_cache, load_chl_cache, DataNotAvailableError
            from app.science.fronts import detect_sst_fronts, detect_chl_fronts, front_summary

            try:
                sst_ds = load_sst_cache(start, end)
                sst_var = "analysed_sst"
                if sst_var in sst_ds:
                    lats = sst_ds["latitude"].values
                    lons = sst_ds["longitude"].values
                    # Take first time step
                    sst_2d = sst_ds[sst_var].values
                    if sst_2d.ndim == 3:
                        sst_2d = sst_2d[0]
                    sst_r = detect_sst_fronts(lats, lons, sst_2d)
                    result["fronts_sst"] = front_summary(sst_r)
            except DataNotAvailableError:
                result["fronts_sst"] = {"status": "not_cached", "message": "Run refresh --sst to fetch SST data"}

            try:
                chl_ds = load_chl_cache(start, end)
                chl_var = "chlor_a"
                if chl_var in chl_ds:
                    lats = chl_ds["latitude"].values
                    lons = chl_ds["longitude"].values
                    chl_2d = chl_ds[chl_var].values
                    if chl_2d.ndim == 3:
                        chl_2d = chl_2d[0]
                    chl_r = detect_chl_fronts(lats, lons, chl_2d)
                    result["fronts_chl"] = front_summary(chl_r)
            except DataNotAvailableError:
                result["fronts_chl"] = {"status": "not_cached", "message": "Run refresh --chl to fetch chlorophyll data"}

        except Exception as e:
            logger.error(f"Front detection failed: {e}")
            result["fronts_sst"] = {"error": str(e)}

    # ── 6. Validation vs CMEMS ─────────────────────────────────────────────────
    if include_validation:
        try:
            from app.data.cmems_fetch import load_cmems_cache, DataNotAvailableError
            from app.science.validation import validate_argo_vs_cmems, validation_report

            try:
                cmems_ds = load_cmems_cache(start, end)
                val = validate_argo_vs_cmems(df, cmems_ds)
                result["validation"] = validation_report(val)
            except DataNotAvailableError:
                result["validation"] = {
                    "status": "not_cached",
                    "message": "Set CMEMS_USERNAME/PASSWORD in .env and run refresh --cmems"
                }
        except Exception as e:
            logger.error(f"Validation failed: {e}")
            result["validation"] = {"error": str(e)}

    return result
