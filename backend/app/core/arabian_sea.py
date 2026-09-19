"""Lightweight Arabian Sea internal sector registry.

The existing IHO Arabian Sea macro-boundary remains owned by
app.core.regions.

This module only adds ARIEL's internal interaction sectors and
point-to-sector assignment.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence

from app.core.regions import (
    REGION_ARABIAN_SEA,
    normalize_longitude,
    validate_region,
)


ROOT = Path(__file__).resolve().parents[2]

SECTOR_FILE = (
    ROOT
    / "data"
    / "geography"
    / "arabian_sea_sectors.json"
)


def _load() -> Dict[str, Any]:
    """Load the Arabian Sea sector registry from JSON."""

    with SECTOR_FILE.open("r", encoding="utf-8") as handle:
        return json.load(handle)


_DATA = _load()

SECTORS: List[Dict[str, Any]] = _DATA["sectors"]

SECTOR_MAP = {
    sector["id"]: sector
    for sector in SECTORS
}


def list_sectors() -> List[Dict[str, Any]]:
    """Return all configured Arabian Sea sectors."""

    return SECTORS.copy()


def get_sector(
    sector_id: str,
) -> Optional[Dict[str, Any]]:
    """Return one sector by ID."""

    return SECTOR_MAP.get(sector_id)


def _point_on_segment(
    px: float,
    py: float,
    ax: float,
    ay: float,
    bx: float,
    by: float,
) -> bool:
    """Return True if a point lies on a polygon edge."""

    cross = (
        (py - ay) * (bx - ax)
        - (px - ax) * (by - ay)
    )

    if abs(cross) > 1e-9:
        return False

    return (
        min(ax, bx) - 1e-9 <= px <= max(ax, bx) + 1e-9
        and
        min(ay, by) - 1e-9 <= py <= max(ay, by) + 1e-9
    )


def _point_in_ring(
    lon: float,
    lat: float,
    ring: Sequence[Sequence[float]],
) -> bool:
    """Ray-casting point-in-polygon test."""

    inside = False

    j = len(ring) - 1

    for i in range(len(ring)):
        ax, ay = ring[i]
        bx, by = ring[j]

        if _point_on_segment(
            lon,
            lat,
            ax,
            ay,
            bx,
            by,
        ):
            return True

        intersects = (
            (ay > lat) != (by > lat)
            and
            lon
            < (bx - ax)
            * (lat - ay)
            / (by - ay)
            + ax
        )

        if intersects:
            inside = not inside

        j = i

    return inside


def point_in_sector(
    lon: float,
    lat: float,
    sector: Dict[str, Any],
) -> bool:
    """Return True when a coordinate lies inside a sector polygon."""

    geometry = sector["geometry"]

    if geometry["type"] != "Polygon":
        return False

    rings = geometry["coordinates"]

    if not rings:
        return False

    # Exterior ring.
    if not _point_in_ring(
        lon,
        lat,
        rings[0],
    ):
        return False

    # Interior rings are holes.
    for hole in rings[1:]:
        if _point_in_ring(
            lon,
            lat,
            hole,
        ):
            return False

    return True


def resolve_sector(
    lat: float,
    lon: float,
) -> Optional[str]:
    """Resolve an Arabian Sea coordinate to an ARIEL sector.

    The existing IHO/macro-region validation is performed first.

    Coordinates outside the authorized Arabian Sea macro-region
    are rejected before sector testing.

    The existing macro-region logic is not modified.
    """

    lat = float(lat)

    norm_lon = normalize_longitude(
        float(lon)
    )

    # Preserve the existing IHO/macro-region logic.
    if (
        validate_region(
            lat,
            norm_lon,
        )
        != REGION_ARABIAN_SEA
    ):
        return None

    for sector in SECTORS:
        if point_in_sector(
            norm_lon,
            lat,
            sector,
        ):
            return sector["id"]

    return None