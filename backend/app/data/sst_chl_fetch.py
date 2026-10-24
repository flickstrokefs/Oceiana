"""
app.data.sst_chl_fetch — Fetch satellite SST and chlorophyll from NOAA CoastWatch ERDDAP.

Sources:
  SST:  MUR (Multi-scale Ultra-high Resolution) SST — NOAA JPL
        Dataset: jplMURSST41   (0.01°, daily, 2002–present)
        URL: https://coastwatch.pfeg.noaa.gov/erddap/
        Access: No login required.

  Chl:  VIIRS-SNPP OC (Ocean Color) — NASA/NOAA
        Dataset: nesdisVHNSQchlaMonthly  (0.1°, monthly)
        URL: https://coastwatch.pfeg.noaa.gov/erddap/
        Access: No login required.

provenance: REAL (satellite-measured / retrieved Level-3)

Usage:
    from app.data.sst_chl_fetch import fetch_mur_sst, fetch_viirs_chl

    sst_ds = fetch_mur_sst(start="2020-01-01", end="2020-01-31",
                            bbox=[80.0, 5.0, 100.0, 23.0])
    chl_ds = fetch_viirs_chl(start="2020-01-01", end="2020-01-31",
                              bbox=[80.0, 5.0, 100.0, 23.0])

Cache layout:
    data/cache/sst_chl/sst_<key>.nc
    data/cache/sst_chl/chl_<key>.nc
    data/cache/manifests/sst_<key>.json / chl_<key>.json
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

from .cache_utils import data_path, make_cache_key, read_manifest, write_manifest

logger = logging.getLogger("ariel.data.sst_chl")

ERDDAP_BASE = "https://coastwatch.pfeg.noaa.gov/erddap"

# MUR SST — ~11 km (0.01 deg), daily
SST_DATASET = "jplMURSST41"
SST_VARIABLE = "analysed_sst"

# VIIRS monthly chlorophyll — 0.1 deg
# NOTE: griddap time constraints on this dataset require exact monthly timestamp snapping.
# Use fetch_viirs_chl() which handles this automatically.
CHL_DATASET = "nesdisVHNSQchlaMonthly"
CHL_VARIABLE = "chlor_a"
# Altitude dimension is required for this dataset (surface = 0.0 m)
_CHL_ALTITUDE = 0.0

BOB_BBOX = [80.0, 5.0, 100.0, 23.0]


class DataNotAvailableError(RuntimeError):
    pass


def fetch_mur_sst(
    start: str,
    end: str,
    bbox: Optional[list[float]] = None,
    stride: int = 10,           # spatial stride to reduce size (10 → ~0.1 deg)
    force_refresh: bool = False,
) -> "xr.Dataset":              # type: ignore[name-defined]
    """
    Fetch NOAA MUR SST (analysed_sst) for the Bay of Bengal.

    provenance: REAL (L4 analysed satellite SST)
    source: NOAA JPL MUR SST 41, CoastWatch ERDDAP
    method_ref: https://podaac.jpl.nasa.gov/MEaSUREs-MUR?sections=about

    Parameters
    ----------
    start, end : ISO date strings
    bbox       : [lon_min, lat_min, lon_max, lat_max]
    stride     : spatial decimation (1 = full ~0.01° resolution, 10 = ~0.1°)
    """
    import xarray as xr

    bbox = bbox or BOB_BBOX
    key = make_cache_key("sst", start=start, end=end, bbox=bbox, stride=stride)
    nc_path = data_path("sst_chl", key, "_sst.nc")
    manifest = read_manifest("sst", key)

    if not force_refresh and nc_path.exists() and manifest:
        logger.info(f"Loading MUR SST from cache: {nc_path.name} (n={manifest.get('n_records','?')})")
        return xr.open_dataset(nc_path)

    logger.info(f"Fetching MUR SST from ERDDAP: {start}–{end}, bbox={bbox}, stride={stride}")

    try:
        # Download via requests and save directly to nc_path (avoids Windows file-lock on unlink)
        import requests
        lon_min, lat_min, lon_max, lat_max = bbox
        s = stride
        url = (
            f"{ERDDAP_BASE}/griddap/{SST_DATASET}.nc"
            f"?{SST_VARIABLE}"
            f"[({start}T09:00:00Z):1:({end}T09:00:00Z)]"
            f"[({lat_min}):{s}:({lat_max})]"
            f"[({lon_min}):{s}:({lon_max})]"
        )
        logger.info(f"MUR SST URL: {url}")
        resp = requests.get(url, timeout=120)
        resp.raise_for_status()
        nc_path.parent.mkdir(parents=True, exist_ok=True)
        nc_path.write_bytes(resp.content)
        ds = xr.open_dataset(nc_path)
    except Exception as e_exc:
        logger.error(f"MUR SST fetch failed: {e_exc}")
        if nc_path.exists():
            logger.warning("Using stale SST cache (offline fallback)")
            return xr.open_dataset(nc_path)
        raise DataNotAvailableError(
            f"MUR SST fetch failed ({e_exc}). Connect to network and retry."
        ) from e_exc

    # Convert K → °C if needed
    if SST_VARIABLE in ds:
        sst = ds[SST_VARIABLE]
        if sst.attrs.get("units", "").startswith("K") or float(sst.min()) > 200:
            ds[SST_VARIABLE] = sst - 273.15
            ds[SST_VARIABLE].attrs["units"] = "degrees_C"

    ds.attrs["provenance"] = "REAL"
    ds.attrs["source"] = "NOAA JPL MUR SST v4.1 (L4 analysed)"
    ds.attrs["dataset_id"] = SST_DATASET

    # nc_path already written by the download step above
    logger.info(f"Cached MUR SST → {nc_path}")

    import numpy as np
    n_rec = int(np.count_nonzero(~np.isnan(ds[SST_VARIABLE].values))) if SST_VARIABLE in ds else 0

    write_manifest(
        source_tag="sst",
        cache_key=key,
        source="NOAA JPL MUR SST v4.1 (L4 analysed satellite SST)",
        doi_or_url="https://podaac.jpl.nasa.gov/MEaSUREs-MUR",
        bbox=bbox,
        time_range=[start, end],
        n_records=n_rec,
        cache_file=nc_path,
        extra={"dataset_id": SST_DATASET, "spatial_stride": stride, "variable": SST_VARIABLE},
    )
    return ds


def fetch_viirs_chl(
    start: str,
    end: str,
    bbox: Optional[list[float]] = None,
    force_refresh: bool = False,
) -> "xr.Dataset":              # type: ignore[name-defined]
    """
    Fetch VIIRS-SNPP monthly chlorophyll-a for the Bay of Bengal.

    provenance: REAL (satellite ocean colour L3 monthly composite)
    source: VIIRS-SNPP OC, NOAA CoastWatch ERDDAP
    """
    import xarray as xr

    bbox = bbox or BOB_BBOX
    key = make_cache_key("chl", start=start, end=end, bbox=bbox)
    nc_path = data_path("sst_chl", key, "_chl.nc")
    manifest = read_manifest("chl", key)

    if not force_refresh and nc_path.exists() and manifest:
        logger.info(f"Loading VIIRS chl from cache: {nc_path.name}")
        return xr.open_dataset(nc_path)

    logger.info(f"Fetching VIIRS chlorophyll from ERDDAP: {start}–{end}, bbox={bbox}")

    try:
        # Download via requests.
        # This dataset requires exact monthly timestamps from the time axis.
        # We snap to the 1st of the month and include the altitude dimension.
        import requests
        lon_min, lat_min, lon_max, lat_max = bbox
        from datetime import datetime
        dt_start = datetime.strptime(start[:10], "%Y-%m-%d")
        dt_end = datetime.strptime(end[:10], "%Y-%m-%d")
        # Use middle-of-month (16th) at noon UTC — ERDDAP snaps to nearest
        t_start = f"{dt_start.year}-{dt_start.month:02d}-16T12:00:00Z"
        # End: use last day of end month
        import calendar
        last_day = calendar.monthrange(dt_end.year, dt_end.month)[1]
        t_end = f"{dt_end.year}-{dt_end.month:02d}-{last_day}T12:00:00Z"
        url = (
            f"{ERDDAP_BASE}/griddap/{CHL_DATASET}.nc"
            f"?{CHL_VARIABLE}"
            f"[({t_start}):1:({t_end})]"
            f"[({_CHL_ALTITUDE}):1:({_CHL_ALTITUDE})]"
            f"[({lat_min}):1:({lat_max})]"
            f"[({lon_min}):1:({lon_max})]"
        )
        logger.info(f"VIIRS chl URL: {url}")
        resp = requests.get(url, timeout=120)
        if resp.status_code == 404:
            # ERDDAP may require exact time axis values; try alternate endpoints
            raise DataNotAvailableError(
                f"VIIRS chl griddap returned 404 for {start}\u2013{end}. "
                "The ERDDAP server may require exact monthly timestamps. "
                "UNVERIFIED for this time range — run refresh with network to re-attempt."
            )
        resp.raise_for_status()
        nc_path.parent.mkdir(parents=True, exist_ok=True)
        nc_path.write_bytes(resp.content)
        ds = xr.open_dataset(nc_path)
    except Exception as e_exc:
        logger.error(f"VIIRS chlorophyll fetch failed: {e_exc}")
        if nc_path.exists():
            logger.warning("Using stale chl cache (offline fallback)")
            return xr.open_dataset(nc_path)
        raise DataNotAvailableError(
            f"VIIRS chl fetch failed ({e_exc}). Connect to network and retry."
        ) from e_exc

    ds.attrs["provenance"] = "REAL"
    ds.attrs["source"] = "VIIRS-SNPP OC, NOAA CoastWatch ERDDAP"
    ds.attrs["dataset_id"] = CHL_DATASET

    # nc_path already written by the download step above
    logger.info(f"Cached VIIRS chl → {nc_path}")

    import numpy as np
    n_rec = int(np.count_nonzero(~np.isnan(ds[CHL_VARIABLE].values))) if CHL_VARIABLE in ds else 0

    write_manifest(
        source_tag="chl",
        cache_key=key,
        source="VIIRS-SNPP Ocean Colour (chlorophyll-a, L3 monthly), NOAA CoastWatch",
        doi_or_url="https://coastwatch.pfeg.noaa.gov/erddap/griddap/" + CHL_DATASET,
        bbox=bbox,
        time_range=[start, end],
        n_records=n_rec,
        cache_file=nc_path,
        extra={"dataset_id": CHL_DATASET, "variable": CHL_VARIABLE, "resolution_deg": 0.1},
    )
    return ds


def load_sst_cache(start: str, end: str, bbox: Optional[list[float]] = None) -> "xr.Dataset":  # type: ignore[name-defined]
    """Load SST from cache only. Safe for offline use."""
    import xarray as xr
    bbox = bbox or BOB_BBOX
    key = make_cache_key("sst", start=start, end=end, bbox=bbox, stride=10)
    nc_path = data_path("sst_chl", key, "_sst.nc")
    if nc_path.exists():
        return xr.open_dataset(nc_path)
    raise DataNotAvailableError(f"No SST cache for {start}–{end}. Run refresh with network.")


def load_chl_cache(start: str, end: str, bbox: Optional[list[float]] = None) -> "xr.Dataset":  # type: ignore[name-defined]
    """Load chlorophyll from cache only. Safe for offline use."""
    import xarray as xr
    bbox = bbox or BOB_BBOX
    key = make_cache_key("chl", start=start, end=end, bbox=bbox)
    nc_path = data_path("sst_chl", key, "_chl.nc")
    if nc_path.exists():
        return xr.open_dataset(nc_path)
    raise DataNotAvailableError(f"No chl cache for {start}–{end}. Run refresh with network.")
