"""
app.data.argo_fetch — Fetch real Argo profiles from Ifremer ERDDAP via argopy.

Source: Ifremer ERDDAP (https://erddap.ifremer.fr/erddap/)
DOI:    10.17882/42182
Access: No login required.

Usage:
    from app.data.argo_fetch import fetch_argo_bob, load_argo_cache

    # Fetch (network required first time; cached after)
    ds = fetch_argo_bob(start="2020-01-01", end="2020-02-01")

    # Load from cache only (offline-safe)
    ds = load_argo_cache(start="2020-01-01", end="2020-02-01")

Cache layout:
    data/cache/argo/<key>.nc          — xarray Dataset (NetCDF)
    data/cache/manifests/argo_<key>.json
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import numpy as np

from .cache_utils import (
    cache_exists,
    data_path,
    make_cache_key,
    read_manifest,
    write_manifest,
)

logger = logging.getLogger("ariel.data.argo")

# Bay of Bengal bounding box (master prompt: 5–23°N, 80–100°E)
BOB_BBOX = [80.0, 5.0, 100.0, 23.0]   # [lon_min, lat_min, lon_max, lat_max]
BOB_QC_FLAGS = [1]                       # Only accept QC=1 (good data)

SOURCE_TAG = "argo"
SOURCE_NAME = "Ifremer ERDDAP Argo GDAC"
SOURCE_DOI = "https://doi.org/10.17882/42182"


class ArgoFetchError(RuntimeError):
    pass


class DataNotAvailableError(RuntimeError):
    """Raised when offline and no cache exists for the requested parameters."""
    pass


def _cache_key(start: str, end: str, bbox: list[float]) -> str:
    return make_cache_key(SOURCE_TAG, start=start, end=end, bbox=bbox)


def fetch_argo_bob(
    start: str = "2020-01-01",
    end: str = "2020-02-01",
    bbox: Optional[list[float]] = None,
    qc_flags: Optional[list[int]] = None,
    force_refresh: bool = False,
) -> "xr.Dataset":  # type: ignore[name-defined]
    """
    Fetch Argo profiles from Ifremer ERDDAP for the Bay of Bengal.

    Parameters
    ----------
    start, end : ISO date strings (YYYY-MM-DD)
    bbox       : [lon_min, lat_min, lon_max, lat_max]; defaults to BOB_BBOX
    qc_flags   : list of accepted QC flags; defaults to [1]
    force_refresh : ignore cache and re-fetch

    Returns
    -------
    xr.Dataset with dimensions N_POINTS and variables
    PRES, TEMP, PSAL, LATITUDE, LONGITUDE, TIME, PLATFORM_NUMBER, CYCLE_NUMBER,
    TEMP_QC, PSAL_QC, SA (Absolute Salinity), CT (Conservative Temperature).

    provenance: REAL — measured Argo float profiles
    source: Ifremer ERDDAP DOI 10.17882/42182
    """
    import xarray as xr

    bbox = bbox or BOB_BBOX
    qc_flags = qc_flags or BOB_QC_FLAGS
    key = _cache_key(start, end, bbox)
    nc_path = data_path(SOURCE_TAG, key, ".nc")
    manifest = read_manifest(SOURCE_TAG, key)

    if not force_refresh and nc_path.exists() and manifest:
        logger.info(f"Loading Argo from cache: {nc_path.name} (n={manifest.get('n_records', '?')})")
        return xr.open_dataset(nc_path)

    logger.info(f"Fetching Argo from Ifremer ERDDAP: {start} – {end}, bbox={bbox}")

    try:
        import argopy
        from argopy import DataFetcher as ArgoDataFetcher

        # argopy DataFetcher: region(lon_min, lon_max, lat_min, lat_max, pres_min, pres_max, date_min, date_max)
        fetcher = ArgoDataFetcher(src="erddap").region(
            [bbox[0], bbox[2], bbox[1], bbox[3], 0, 2000, start, end]
        )
        ds_raw = fetcher.to_xarray()
    except Exception as e:
        logger.error(f"Argo fetch failed: {e}")
        # Try falling back to the committed real file
        committed = Path(__file__).parent.parent.parent.parent / "data" / "raw" / \
            "argo_bay_of_bengal_2020-01-01_2020-02-01.nc"
        if committed.exists():
            logger.warning(f"Using committed real file: {committed}")
            ds_raw = xr.open_dataset(committed)
        else:
            raise DataNotAvailableError(
                f"Argo fetch failed ({e}) and no committed cache exists. "
                "Run with network access first to populate cache."
            ) from e

    # Apply QC filter
    ds_raw = _apply_qc(ds_raw, qc_flags)

    # Add TEOS-10 derived variables (provenance=DERIVED)
    ds_raw = _add_teos10(ds_raw)

    # Save to cache
    nc_path.parent.mkdir(parents=True, exist_ok=True)
    # Drop object-dtype variables that NetCDF can't handle
    ds_to_save = _prepare_for_netcdf(ds_raw)
    ds_to_save.to_netcdf(nc_path)
    logger.info(f"Cached Argo → {nc_path}")

    n_points = int(ds_raw.sizes.get("N_POINTS", ds_raw.sizes.get("index", len(list(ds_raw.coords.get("LATITUDE", []))))))

    write_manifest(
        source_tag=SOURCE_TAG,
        cache_key=key,
        source=SOURCE_NAME,
        doi_or_url=SOURCE_DOI,
        bbox=bbox,
        time_range=[start, end],
        n_records=n_points,
        cache_file=nc_path,
        extra={"qc_flags_accepted": qc_flags, "variables": ["PRES", "TEMP", "PSAL", "SA", "CT"]},
    )
    return ds_raw


def load_argo_cache(
    start: str = "2020-01-01",
    end: str = "2020-02-01",
    bbox: Optional[list[float]] = None,
) -> "xr.Dataset":  # type: ignore[name-defined]
    """
    Load Argo data from cache only. Raises DataNotAvailableError if not cached.
    Safe to call with no network.
    """
    import xarray as xr

    bbox = bbox or BOB_BBOX
    key = _cache_key(start, end, bbox)
    nc_path = data_path(SOURCE_TAG, key, ".nc")

    if nc_path.exists():
        logger.info(f"Loading Argo from cache (offline mode): {nc_path.name}")
        return xr.open_dataset(nc_path)

    # Fallback: try committed real file
    committed = Path(__file__).parent.parent.parent.parent / "data" / "raw" / \
        "argo_bay_of_bengal_2020-01-01_2020-02-01.nc"
    if committed.exists():
        logger.info(f"Loading Argo from committed file: {committed}")
        return xr.open_dataset(committed)

    raise DataNotAvailableError(
        f"No Argo cache found for {start}–{end}. "
        "Run `python -m app.data.refresh --region bob --start {start} --end {end}` with network access."
    )


def get_argo_manifest(
    start: str = "2020-01-01",
    end: str = "2020-02-01",
    bbox: Optional[list[float]] = None,
) -> Optional[dict]:
    """Return the manifest dict for a cached fetch, or None if not cached."""
    bbox = bbox or BOB_BBOX
    key = _cache_key(start, end, bbox)
    return read_manifest(SOURCE_TAG, key)


# ─── Internal helpers ──────────────────────────────────────────────────────────

def _apply_qc(ds: "xr.Dataset", qc_flags: list[int]) -> "xr.Dataset":  # type: ignore[name-defined]
    """Keep only rows where TEMP_QC and PSAL_QC are in qc_flags."""
    import numpy as np

    if "TEMP_QC" not in ds and "PSAL_QC" not in ds:
        logger.warning("No QC variables found; skipping QC filter.")
        return ds

    mask = None
    for qc_var in ["TEMP_QC", "PSAL_QC"]:
        if qc_var in ds:
            qc_vals = ds[qc_var].values
            # argopy may return byte strings like b'1'
            try:
                qc_int = qc_vals.astype(int)
            except (ValueError, TypeError):
                qc_int = np.array([int(str(v).strip("b'\" ")) if v is not None else 9 for v in qc_vals.flat]).reshape(qc_vals.shape)
            var_mask = np.isin(qc_int, qc_flags)
            mask = var_mask if mask is None else (mask & var_mask)

    if mask is not None and mask.any():
        dim = list(ds.dims)[0]
        idx = np.where(mask)[0]
        ds = ds.isel({dim: idx})
        logger.info(f"QC filter: kept {int(mask.sum())} / {len(mask)} points (flags={qc_flags})")
    return ds


def _add_teos10(ds: "xr.Dataset") -> "xr.Dataset":  # type: ignore[name-defined]
    """Add SA (Absolute Salinity) and CT (Conservative Temperature) via gsw."""
    try:
        import gsw
        import numpy as np

        sp = ds["PSAL"].values.astype(float)
        t = ds["TEMP"].values.astype(float)
        p = ds["PRES"].values.astype(float)
        lat = ds["LATITUDE"].values.astype(float)
        lon = ds["LONGITUDE"].values.astype(float)

        sa = gsw.SA_from_SP(sp, p, lon, lat)
        ct = gsw.CT_from_t(sa, t, p)

        ds = ds.assign(
            SA=(list(ds["PSAL"].dims), sa.astype("float32")),
            CT=(list(ds["TEMP"].dims), ct.astype("float32")),
        )
        ds["SA"].attrs = {"long_name": "Absolute Salinity", "units": "g/kg",
                          "provenance": "DERIVED", "method_ref": "McDougall & Barker 2011 (TEOS-10)"}
        ds["CT"].attrs = {"long_name": "Conservative Temperature", "units": "deg_C",
                          "provenance": "DERIVED", "method_ref": "McDougall & Barker 2011 (TEOS-10)"}
        logger.info("Added TEOS-10 SA and CT (DERIVED from REAL Argo)")
    except Exception as e:
        logger.warning(f"TEOS-10 computation skipped: {e}")
    return ds


def _prepare_for_netcdf(ds: "xr.Dataset") -> "xr.Dataset":  # type: ignore[name-defined]
    """Drop or encode variables that can't be written to NetCDF4."""
    drop = [v for v in ds.data_vars if ds[v].dtype == object]
    if drop:
        logger.debug(f"Dropping object-dtype vars before NetCDF save: {drop}")
        ds = ds.drop_vars(drop)
    return ds
