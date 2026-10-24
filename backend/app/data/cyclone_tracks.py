"""
app.data.cyclone_tracks — Fetch IBTrACS cyclone track data from NOAA NCEI.

Source: IBTrACS (International Best Track Archive for Climate Stewardship)
URL:    https://www.ncei.noaa.gov/products/international-best-track-archive
Access: Public, no login required.

Provides: storm name, position (lat/lon), intensity (max wind, min pressure),
          timestamps at 6-hourly resolution.

Coverage: North Indian Ocean basin (NI) — covers Bay of Bengal + Arabian Sea.

Key cyclones for Phase 4 case studies (all in BoB unless noted):
  - Fani       (2019-04-25 to 2019-05-03)  — BoB, very severe
  - Amphan     (2020-05-16 to 2020-05-21)  — BoB, super cyclonic storm
  - Mocha      (2023-05-09 to 2023-05-14)  — BoB, extremely severe
  (Biparjoy 2023 is Arabian Sea — out of BoB scope)

provenance: REAL (WMO-standardised best track analysis)

Usage:
    from app.data.cyclone_tracks import fetch_ibtracs_ni, get_storm_track

    df = fetch_ibtracs_ni()                   # all NI storms since 2015
    amphan = get_storm_track(df, "AMPHAN")    # single storm DataFrame
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd

from .cache_utils import data_path, make_cache_key, read_manifest, write_manifest

logger = logging.getLogger("ariel.data.cyclone")

SOURCE_TAG = "cyclone_tracks"
SOURCE_NAME = "IBTrACS v04 — NOAA NCEI International Best Track Archive"
SOURCE_URL = "https://www.ncei.noaa.gov/products/international-best-track-archive"

# IBTrACS NI (North Indian Ocean) CSV — public, ~1 MB
IBTRACS_NI_URL = "https://www.ncei.noaa.gov/data/international-best-track-archive-for-climate-stewardship-ibtracs/v04r01/access/csv/ibtracs.NI.list.v04r01.csv"

BOB_BBOX = [80.0, 5.0, 100.0, 23.0]


class DataNotAvailableError(RuntimeError):
    pass


def fetch_ibtracs_ni(
    year_min: int = 2015,
    force_refresh: bool = False,
) -> pd.DataFrame:
    """
    Fetch IBTrACS North Indian Ocean best track data.

    Returns a DataFrame with columns:
      SID, NAME, ISO_TIME, LAT, LON, WMO_WIND (kt), WMO_PRES (hPa), BASIN, SUBBASIN

    provenance: REAL (WMO best track analysis)
    source: IBTrACS v04r01, NOAA NCEI

    Parameters
    ----------
    year_min    : only include storms from this year onwards
    force_refresh: ignore cache
    """
    key = make_cache_key(SOURCE_TAG, year_min=year_min)
    csv_path = data_path(SOURCE_TAG, key, ".csv")
    manifest = read_manifest(SOURCE_TAG, key)

    if not force_refresh and csv_path.exists() and manifest:
        logger.info(f"Loading IBTrACS from cache: {csv_path.name}")
        df = pd.read_csv(csv_path, low_memory=False)
        return df

    logger.info(f"Fetching IBTrACS NI from NOAA NCEI (year_min={year_min})")

    try:
        # IBTrACS CSV has a header row + units row; skip units row (row index 1)
        df_raw = pd.read_csv(
            IBTRACS_NI_URL,
            skiprows=[1],             # skip the units row
            low_memory=False,
            na_values=[" ", "", "nan", "NaN"],
        )
    except Exception as e_exc:
        logger.error(f"IBTrACS fetch failed: {e_exc}")
        if csv_path.exists():
            logger.warning("Using stale IBTrACS cache (offline fallback)")
            return pd.read_csv(csv_path, low_memory=False)
        raise DataNotAvailableError(
            f"IBTrACS fetch failed ({e_exc}). Check network connection."
        ) from e_exc

    # Select useful columns
    keep = ["SID", "NAME", "ISO_TIME", "LAT", "LON", "WMO_WIND", "WMO_PRES",
            "BASIN", "SUBBASIN", "SEASON", "NATURE"]
    keep = [c for c in keep if c in df_raw.columns]
    df = df_raw[keep].copy()

    # Parse times and filter by year
    df["ISO_TIME"] = pd.to_datetime(df["ISO_TIME"], errors="coerce", utc=True)
    df = df.dropna(subset=["ISO_TIME"])
    df = df[df["ISO_TIME"].dt.year >= year_min].reset_index(drop=True)

    # Coerce numeric
    for col in ["LAT", "LON", "WMO_WIND", "WMO_PRES"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    n = len(df)
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(csv_path, index=False)
    logger.info(f"Cached IBTrACS NI → {csv_path} ({n} rows, {year_min}–present)")

    write_manifest(
        source_tag=SOURCE_TAG,
        cache_key=key,
        source=SOURCE_NAME,
        doi_or_url=SOURCE_URL,
        bbox=[-180, -90, 180, 90],    # global dataset
        time_range=[str(year_min), "present"],
        n_records=n,
        cache_file=csv_path,
        extra={"basin": "NI", "version": "v04r01", "year_min": year_min},
    )
    return df


def get_storm_track(
    df: pd.DataFrame,
    storm_name: str,
    season: Optional[int] = None,
) -> pd.DataFrame:
    """
    Extract a single storm track from the IBTrACS DataFrame.

    Parameters
    ----------
    df         : output of fetch_ibtracs_ni()
    storm_name : e.g. "AMPHAN", "FANI", "MOCHA" (case-insensitive)
    season     : year of season (optional, to disambiguate same-name storms)

    Returns sorted DataFrame for the storm, or empty if not found.
    """
    clean_name = storm_name.upper().strip()
    mask = (
        (df["NAME"].str.upper().str.strip() == clean_name) |
        (df["NAME"].str.upper().apply(lambda x: clean_name in str(x).split(":")))
    )
    if season:
        mask &= df["SEASON"].astype(str) == str(season)
    track = df[mask].copy()
    if track.empty:
        # Fallback to substring match
        mask = df["NAME"].str.upper().str.contains(clean_name, na=False)
        if season:
            mask &= df["SEASON"].astype(str) == str(season)
        track = df[mask].copy()
    if track.empty:
        logger.warning(f"Storm '{storm_name}' not found in IBTrACS dataset.")
        return track
    track = track.sort_values("ISO_TIME").reset_index(drop=True)
    logger.info(f"Storm {storm_name}: {len(track)} track points, "
                f"{track['ISO_TIME'].min()} – {track['ISO_TIME'].max()}")
    return track


def filter_bob_tracks(df: pd.DataFrame) -> pd.DataFrame:
    """
    Keep only track points inside the Bay of Bengal bounding box.
    BOB_BBOX = [lon_min=80, lat_min=5, lon_max=100, lat_max=23]
    """
    lon_min, lat_min, lon_max, lat_max = BOB_BBOX
    mask = (
        (df["LAT"] >= lat_min) & (df["LAT"] <= lat_max) &
        (df["LON"] >= lon_min) & (df["LON"] <= lon_max)
    )
    return df[mask].reset_index(drop=True)


def load_ibtracs_cache(year_min: int = 2015) -> pd.DataFrame:
    """Load IBTrACS from cache only (offline-safe)."""
    key = make_cache_key(SOURCE_TAG, year_min=year_min)
    csv_path = data_path(SOURCE_TAG, key, ".csv")
    if csv_path.exists():
        logger.info(f"Loading IBTrACS from cache (offline): {csv_path.name}")
        return pd.read_csv(csv_path, low_memory=False)
    
    # Check directory for any available cached CSV
    parent_dir = csv_path.parent
    if parent_dir.exists():
        csv_files = list(parent_dir.glob("*.csv"))
        if csv_files:
            logger.info(f"Loading IBTrACS from available cache: {csv_files[0].name}")
            df = pd.read_csv(csv_files[0], low_memory=False)
            if "ISO_TIME" in df.columns:
                df["ISO_TIME"] = pd.to_datetime(df["ISO_TIME"], errors="coerce", utc=True)
                df = df[df["ISO_TIME"].dt.year >= year_min].reset_index(drop=True)
            return df

    raise DataNotAvailableError(
        "No IBTrACS cache found. Run `python -m app.data.refresh --region bob` with network."
    )


def list_bob_storms(year_min: int = 2015) -> list[dict]:
    """
    Return a list of storms that passed through BoB (from cache).
    Each entry: {sid, name, season, peak_wind_kt, peak_date}.
    """
    try:
        df = load_ibtracs_cache(year_min=year_min)
    except DataNotAvailableError:
        return []

    bob = filter_bob_tracks(df)
    storms = []
    for sid, grp in bob.groupby("SID"):
        grp = grp.copy()
        # Parse ISO_TIME if it came back as string from CSV
        grp["ISO_TIME"] = pd.to_datetime(grp["ISO_TIME"], errors="coerce", utc=True)
        grp = grp.dropna(subset=["WMO_WIND", "ISO_TIME"])
        if grp.empty:
            continue
        peak_idx = grp["WMO_WIND"].idxmax()
        storms.append({
            "sid": sid,
            "name": grp["NAME"].iloc[0],
            "season": int(grp["ISO_TIME"].dt.year.iloc[0]),
            "peak_wind_kt": float(grp.loc[peak_idx, "WMO_WIND"]),
            "peak_date": str(grp.loc[peak_idx, "ISO_TIME"]),
            "n_points": len(grp),
        })
    storms.sort(key=lambda s: s["peak_date"])
    return storms
