"""
app.data.cmems_fetch — Fetch operational ocean forecast/analysis from Copernicus Marine.

Source: Copernicus Marine Service (CMEMS)
URL:    https://marine.copernicus.eu/
Access: FREE login required. Set CMEMS_USERNAME and CMEMS_PASSWORD in .env

Products used (Bay of Bengal):
  - Global Ocean Physics Analysis/Forecast (GLORYS12/NEMO):
      Product: GLOBAL_ANALYSISFORECAST_PHY_001_024
      Variables: thetao (temperature), so (salinity), uo/vo (currents),
                 zos (sea surface height), mlotst (mixed layer depth)
  - Global Ocean Biogeochemistry:
      Product: GLOBAL_ANALYSISFORECAST_BGC_001_028
      Variables: chl (chlorophyll), o2 (dissolved oxygen)

IMPORTANT: We present CMEMS forecasts — we do not produce our own.
Every response is tagged provenance="SIMULATED" (external operational model).

Usage:
    from app.data.cmems_fetch import fetch_cmems_physics, load_cmems_cache

    ds = fetch_cmems_physics(
        start="2020-01-01", end="2020-01-07",
        bbox=[80.0, 5.0, 100.0, 23.0]  # Bay of Bengal
    )

Cache layout:
    data/cache/cmems/<key>.nc
    data/cache/manifests/cmems_<key>.json
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Optional

from .cache_utils import (
    cache_exists,
    data_path,
    make_cache_key,
    read_manifest,
    write_manifest,
)

logger = logging.getLogger("ariel.data.cmems")

SOURCE_TAG = "cmems"
SOURCE_NAME = "Copernicus Marine Service (CMEMS) — Global Ocean Physics Analysis/Forecast"
SOURCE_URL = "https://marine.copernicus.eu"

# Current product IDs (verified from live CMEMS catalogue, Oct 2025)
# ANFC = near-real-time analysis/forecast (~last 5 years)
# MY   = multi-year reanalysis (historical, up to ~1 year ago)
PRODUCT_PHY = "GLOBAL_ANALYSISFORECAST_PHY_001_024"
DATASET_PHY_ANFC = "cmems_mod_glo_phy_anfc_0.083deg_P1D-m"   # near-real-time
DATASET_PHY_MY   = "cmems_mod_glo_phy_my_0.083deg_P1D-m"     # multi-year reanalysis
DATASET_CUR_ANFC = "cmems_mod_glo_phy-cur_anfc_0.083deg_P1D-m"
DATASET_CUR_MY = "cmems_mod_glo_phy-cur_my_0.083deg_P1D-m"
# Legacy alias kept for backward-compat (was removed from catalogue)
DATASET_PHY = DATASET_PHY_ANFC

PRODUCT_BGC = "GLOBAL_ANALYSISFORECAST_BGC_001_028"
DATASET_BGC = "cmems_mod_glo_bgc_anfc_0.25deg_P1D-m"

PHY_VARIABLES = ["thetao", "so", "uo", "vo", "zos", "mlotst"]
BGC_VARIABLES = ["chl", "o2"]

# Cutoff: dates older than this use MY (reanalysis); newer use ANFC
import datetime as _dt
_MY_CUTOFF = _dt.date.today() - _dt.timedelta(days=365)


class CMEMSCredentialError(RuntimeError):
    """Raised when CMEMS credentials are not configured."""
    pass


class DataNotAvailableError(RuntimeError):
    """Raised when offline and no cache exists."""
    pass


def _get_credentials() -> tuple[str, str]:
    try:
        from dotenv import load_dotenv
        load_dotenv(Path(__file__).resolve().parents[3] / ".env")
    except ImportError:
        pass
    username = os.environ.get("CMEMS_USERNAME", "")
    password = os.environ.get("CMEMS_PASSWORD", "")
    if not username or not password:
        raise CMEMSCredentialError(
            "CMEMS credentials not found. Set CMEMS_USERNAME and CMEMS_PASSWORD "
            "in your .env file. Free registration at https://marine.copernicus.eu"
        )
    return username, password


def fetch_cmems_surface_currents(start: str, end: str, bbox: list[float]) -> "xr.Dataset":  # type: ignore[name-defined]
    """Fetch operational CMEMS surface currents; never substitute formulas."""
    import datetime as _dt
    import copernicusmarine as cm

    username, password = _get_credentials()
    start_date = _dt.date.fromisoformat(start[:10])
    dataset_id = DATASET_CUR_MY if start_date < _MY_CUTOFF else DATASET_CUR_ANFC
    try:
        return cm.open_dataset(
            dataset_id=dataset_id,
            variables=["uo", "vo"],
            minimum_longitude=bbox[0], maximum_longitude=bbox[2],
            minimum_latitude=bbox[1], maximum_latitude=bbox[3],
            start_datetime=start, end_datetime=end,
            minimum_depth=0.0, maximum_depth=1.0,
            username=username, password=password,
        )
    except Exception as exc:
        raise DataNotAvailableError(f"CMEMS current fields unavailable: {exc}") from exc


def _cache_key(product: str, start: str, end: str, bbox: list[float], variables: list[str]) -> str:
    return make_cache_key(SOURCE_TAG, product=product, start=start, end=end,
                          bbox=bbox, vars=sorted(variables))


def fetch_cmems_physics(
    start: str,
    end: str,
    bbox: Optional[list[float]] = None,
    variables: Optional[list[str]] = None,
    depth_min: float = 0.5,
    depth_max: float = 500.0,
    force_refresh: bool = False,
) -> "xr.Dataset":  # type: ignore[name-defined]
    """
    Fetch CMEMS Global Ocean Physics Analysis/Forecast for the given region/time.

    This is an EXTERNAL OPERATIONAL MODEL output, NOT produced by this project.
    provenance = "SIMULATED" (CMEMS GLORYS12/NEMO model)

    Parameters
    ----------
    start, end   : ISO date strings
    bbox         : [lon_min, lat_min, lon_max, lat_max]; defaults to Bay of Bengal
    variables    : subset of PHY_VARIABLES; defaults to all
    depth_min/max: depth range in metres
    force_refresh: ignore cache and re-fetch

    Returns xr.Dataset with provenance="SIMULATED" attribute.
    Raises CMEMSCredentialError if credentials missing.
    Raises DataNotAvailableError if offline and no cache.
    """
    import xarray as xr

    bbox = bbox or [80.0, 5.0, 100.0, 23.0]
    variables = variables or PHY_VARIABLES
    key = _cache_key(PRODUCT_PHY, start, end, bbox, variables)
    nc_path = data_path(SOURCE_TAG, key, ".nc")
    manifest = read_manifest(SOURCE_TAG, key)

    if not force_refresh and nc_path.exists() and manifest:
        logger.info(f"Loading CMEMS physics from cache: {nc_path.name}")
        ds = xr.open_dataset(nc_path)
        return ds

    username, password = _get_credentials()

    # Choose dataset: MY (reanalysis) for historical dates, ANFC for recent/future
    import datetime as _dt
    _start_date = _dt.date.fromisoformat(start[:10])
    _dataset_id = DATASET_PHY_MY if _start_date < _MY_CUTOFF else DATASET_PHY_ANFC
    logger.info(f"Fetching CMEMS {_dataset_id}: {start}–{end}, bbox={bbox}")

    try:
        import copernicusmarine as cm
        ds = cm.open_dataset(
            dataset_id=_dataset_id,
            variables=variables,
            minimum_longitude=bbox[0],
            maximum_longitude=bbox[2],
            minimum_latitude=bbox[1],
            maximum_latitude=bbox[3],
            start_datetime=start,
            end_datetime=end,
            minimum_depth=depth_min,
            maximum_depth=depth_max,
            username=username,
            password=password,
        )
    except Exception as e:
        logger.error(f"CMEMS physics fetch failed: {e}")
        if nc_path.exists():
            logger.warning("Using stale CMEMS cache (offline fallback)")
            return xr.open_dataset(nc_path)
        raise DataNotAvailableError(
            f"CMEMS fetch failed ({e}). Run with network + credentials to populate cache."
        ) from e

    # Tag provenance
    ds.attrs["provenance"] = "SIMULATED"
    ds.attrs["source"] = SOURCE_NAME
    ds.attrs["product_id"] = PRODUCT_PHY
    ds.attrs["fetched_at"] = __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat()

    nc_path.parent.mkdir(parents=True, exist_ok=True)
    ds.to_netcdf(nc_path)
    logger.info(f"Cached CMEMS physics → {nc_path}")

    write_manifest(
        source_tag=SOURCE_TAG,
        cache_key=key,
        source=SOURCE_NAME,
        doi_or_url=SOURCE_URL,
        bbox=bbox,
        time_range=[start, end],
        n_records=int(ds.dims.get("time", 0)),
        cache_file=nc_path,
        extra={
            "product_id": PRODUCT_PHY,
            "dataset_id": DATASET_PHY,
            "variables": variables,
            "depth_range_m": [depth_min, depth_max],
            "provenance": "SIMULATED",
            "note": "External CMEMS operational forecast — not produced by this project",
        },
    )
    return ds


def fetch_cmems_bgc(
    start: str,
    end: str,
    bbox: Optional[list[float]] = None,
    variables: Optional[list[str]] = None,
    force_refresh: bool = False,
) -> "xr.Dataset":  # type: ignore[name-defined]
    """
    Fetch CMEMS BGC (chlorophyll, oxygen) for the given region/time.
    provenance = "SIMULATED" (external CMEMS operational model).
    """
    import xarray as xr

    bbox = bbox or [80.0, 5.0, 100.0, 23.0]
    variables = variables or BGC_VARIABLES
    key = _cache_key(PRODUCT_BGC, start, end, bbox, variables)
    nc_path = data_path(SOURCE_TAG + "_bgc", key, ".nc")
    manifest = read_manifest(SOURCE_TAG + "_bgc", key)

    if not force_refresh and nc_path.exists() and manifest:
        logger.info(f"Loading CMEMS BGC from cache: {nc_path.name}")
        return xr.open_dataset(nc_path)

    username, password = _get_credentials()
    logger.info(f"Fetching CMEMS {PRODUCT_BGC}: {start}–{end}")

    try:
        import copernicusmarine as cm
        ds = cm.open_dataset(
            dataset_id=DATASET_BGC,
            variables=variables,
            minimum_longitude=bbox[0],
            maximum_longitude=bbox[2],
            minimum_latitude=bbox[1],
            maximum_latitude=bbox[3],
            start_datetime=start,
            end_datetime=end,
            username=username,
            password=password,
        )
    except Exception as e:
        logger.error(f"CMEMS BGC fetch failed: {e}")
        if nc_path.exists():
            logger.warning("Using stale CMEMS BGC cache (offline fallback)")
            return xr.open_dataset(nc_path)
        raise DataNotAvailableError(
            f"CMEMS BGC fetch failed ({e}). Run with network + credentials to populate cache."
        ) from e

    ds.attrs["provenance"] = "SIMULATED"
    ds.attrs["source"] = "CMEMS Global Ocean BGC Analysis/Forecast"
    ds.attrs["product_id"] = PRODUCT_BGC
    nc_path.parent.mkdir(parents=True, exist_ok=True)
    ds.to_netcdf(nc_path)

    write_manifest(
        source_tag=SOURCE_TAG + "_bgc",
        cache_key=key,
        source="Copernicus Marine — Global Ocean BGC Analysis/Forecast",
        doi_or_url=SOURCE_URL,
        bbox=bbox,
        time_range=[start, end],
        n_records=int(ds.dims.get("time", 0)),
        cache_file=nc_path,
        extra={"product_id": PRODUCT_BGC, "variables": variables, "provenance": "SIMULATED"},
    )
    return ds


def load_cmems_cache(
    start: str,
    end: str,
    bbox: Optional[list[float]] = None,
    bgc: bool = False,
) -> "xr.Dataset":  # type: ignore[name-defined]
    """Load CMEMS data from cache only. Safe for offline use."""
    import xarray as xr

    bbox = bbox or [80.0, 5.0, 100.0, 23.0]
    tag = SOURCE_TAG + ("_bgc" if bgc else "")
    product = PRODUCT_BGC if bgc else PRODUCT_PHY
    variables = BGC_VARIABLES if bgc else PHY_VARIABLES
    key = _cache_key(product, start, end, bbox, variables)
    nc_path = data_path(tag, key, ".nc")

    if nc_path.exists():
        logger.info(f"Loading CMEMS from cache (offline): {nc_path.name}")
        return xr.open_dataset(nc_path)

    raise DataNotAvailableError(
        f"No CMEMS cache found for {start}–{end}. "
        "Set CMEMS_USERNAME/PASSWORD in .env and run refresh with network access."
    )
