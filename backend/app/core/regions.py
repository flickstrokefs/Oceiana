import math
from typing import Any, Dict, List, Optional, Set
from app.core.errors import InvalidCoordinateError

# Canonical Region Identifiers
REGION_BAY_OF_BENGAL = "bay_of_bengal"
REGION_ARABIAN_SEA = "arabian_sea"
REGION_SOUTHERN_OCEAN = "southern_ocean"

VALID_REGIONS: Set[str] = {
    REGION_BAY_OF_BENGAL,
    REGION_ARABIAN_SEA,
    REGION_SOUTHERN_OCEAN,
}

# Regional Scientific Definitions
OCEAN_REGIONS: Dict[str, Dict[str, Any]] = {
    REGION_BAY_OF_BENGAL: {
        "id": REGION_BAY_OF_BENGAL,
        "frontend_id": "bay-of-bengal",
        "name": "Bay of Bengal",
        "label": "Bay of Bengal",
        "lat_min": 5.0,
        "lat_max": 23.5,
        "lon_min": 80.0,
        "lon_max": 95.0,
        "depth_min": 0.0,
        "depth_max": 4000.0,
        "bounds_label": "80°–95°E · 5°–23.5°N",
        "description": "Tropical low-salinity basin influenced by monsoonal precipitation and massive Ganges-Brahmaputra freshwater runoff.",
        "aliases": ["bay_of_bengal", "bay-of-bengal", "bob", "bay of bengal"],
    },
    REGION_ARABIAN_SEA: {
        "id": REGION_ARABIAN_SEA,
        "frontend_id": "arabian-sea",
        "name": "Arabian Sea",
        "label": "Arabian Sea",
        "lat_min": 5.0,
        "lat_max": 26.0,
        "lon_min": 55.0,
        "lon_max": 77.5,
        "depth_min": 0.0,
        "depth_max": 4500.0,
        "bounds_label": "55°–77.5°E · 5°–26°N",
        "description": "High-salinity evaporative basin driven by seasonal monsoon reversals, Findlater jet, and prominent oxygen minimum zones.",
        "aliases": ["arabian_sea", "arabian-sea", "as", "arabian sea"],
    },
    REGION_SOUTHERN_OCEAN: {
        "id": REGION_SOUTHERN_OCEAN,
        "frontend_id": "southern-ocean",
        "name": "Southern Ocean",
        "label": "Southern Ocean",
        "lat_min": -78.0,
        "lat_max": -50.0,
        "lon_min": -180.0,
        "lon_max": 180.0,
        "depth_min": 0.0,
        "depth_max": 5000.0,
        "bounds_label": "180°W–180°E · 78°–50°S",
        "description": "Circumpolar Antarctic basin governed by the Antarctic Circumpolar Current (ACC), subantarctic mode water, and intense cryosphere interactions.",
        "aliases": ["southern_ocean", "southern-ocean", "so", "southern ocean", "antarctic", "antarctic ocean"],
    },
}

ALIAS_MAP: Dict[str, str] = {}
for reg_id, defn in OCEAN_REGIONS.items():
    for alias in defn["aliases"]:
        ALIAS_MAP[alias.lower().strip()] = reg_id


def normalize_longitude(lon: float) -> float:
    """
    Normalize any longitude to standard [-180, +180] degrees.
    Handles 0-360 range as well as wrapped coordinates.
    """
    normalized = ((lon + 180.0) % 360.0) - 180.0
    if normalized == -180.0 and lon > 0:
        return 180.0
    return round(normalized, 6)


def resolve_region(region_input: Optional[str]) -> Optional[str]:
    """
    Resolve and canonicalize a region identifier or alias to one of:
    'bay_of_bengal', 'arabian_sea', 'southern_ocean'.
    Returns None if region_input is unrecognized or out of scope.
    """
    if not region_input:
        return None
    cleaned = region_input.lower().strip()
    return ALIAS_MAP.get(cleaned)


def validate_region(lat: float, lon: float) -> Optional[str]:
    """
    Determine which of the 3 strictly allowed ocean regions a coordinate belongs to.
    Returns:
      - 'southern_ocean' if lat <= -50.0 and lat >= -78.0
      - 'bay_of_bengal' if 5.0 <= lat <= 23.5 and 80.0 <= lon <= 95.0
      - 'arabian_sea' if 5.0 <= lat <= 26.0 and 55.0 <= lon <= 77.5
      - None if outside all three valid regions (e.g. Pacific, Atlantic, Equatorial IO, Med, etc.)
    """
    norm_lon = normalize_longitude(lon)

    # 1. Southern Ocean check (Circumpolar Antarctic latitudes <= -50°S)
    if -78.0 <= lat <= -50.0:
        return REGION_SOUTHERN_OCEAN

    # 2. Arabian Sea check
    if 5.0 <= lat <= 26.0 and 55.0 <= norm_lon <= 77.5:
        # Exclude Indian mainland peninsula interior roughly
        if 8.5 <= lat <= 22.0 and norm_lon >= 75.5:
            return None
        return REGION_ARABIAN_SEA

    # 3. Bay of Bengal check
    if 5.0 <= lat <= 23.5 and 80.0 <= norm_lon <= 95.0:
        # Exclude Eastern Indian mainland peninsula interior roughly
        if 13.0 <= lat <= 22.0 and norm_lon <= 81.5:
            return None
        return REGION_BAY_OF_BENGAL

    return None


def is_valid_coordinate(lat: float, lon: float) -> bool:
    """Return True if coordinate is strictly inside one of the three target ocean regions."""
    return validate_region(lat, lon) is not None


def enforce_region_coordinate(lat: float, lon: float) -> str:
    """
    Validate that coordinate is inside one of the 3 allowed regions.
    Raises InvalidCoordinateError if outside scope.
    """
    reg = validate_region(lat, lon)
    if not reg:
        raise InvalidCoordinateError(
            f"Coordinate ({lat:.4f}, {lon:.4f}) lies outside the strictly permitted ocean regions "
            f"(Bay of Bengal, Arabian Sea, Southern Ocean). All other ocean basins are out of scope."
        )
    return reg


def get_macro_region(lat: float, lon: float) -> Optional[str]:
    """
    Classify coordinate into macro ocean basins:
    - 'Indian Ocean' for Bay of Bengal and Arabian Sea.
    - 'Southern Ocean' for circumpolar Antarctic waters (<= -50°S).
    - None for all out-of-scope basins (Pacific, Atlantic, Mediterranean, Arctic, etc.).
    """
    sub_region = validate_region(lat, lon)
    if sub_region in [REGION_BAY_OF_BENGAL, REGION_ARABIAN_SEA]:
        return "Indian Ocean"
    elif sub_region == REGION_SOUTHERN_OCEAN:
        return "Southern Ocean"
    return None


def filter_dataframe_to_authorized_regions(
    df: Any,
    lat_col: str = "LATITUDE",
    lon_col: str = "LONGITUDE",
) -> Any:
    """
    Mandatory post-fetch geographic validation and filter for DataFrames.
    Normalizes longitude across both [-180..180] and [0..360] formats and
    enforces that every retained observation belongs strictly to the Indian Ocean
    (Bay of Bengal, Arabian Sea) or Southern Ocean.
    """
    if df is None or len(df) == 0:
        return df

    res = df.copy()
    # Normalize longitude in-place to standard [-180, +180]
    res[lon_col] = res[lon_col].astype(float).apply(normalize_longitude)

    def _is_valid(row):
        try:
            lat_val = float(row[lat_col])
            lon_val = float(row[lon_col])
            return validate_region(lat_val, lon_val) is not None
        except (ValueError, TypeError):
            return False

    valid_mask = res.apply(_is_valid, axis=1)
    filtered = res[valid_mask].copy()

    # Annotate region metadata
    filtered["REGION"] = filtered.apply(
        lambda r: validate_region(float(r[lat_col]), float(r[lon_col])),
        axis=1,
    )
    filtered["MACRO_REGION"] = filtered.apply(
        lambda r: get_macro_region(float(r[lat_col]), float(r[lon_col])),
        axis=1,
    )

    return filtered
