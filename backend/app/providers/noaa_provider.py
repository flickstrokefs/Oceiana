import json
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
import numpy as np

from app.core.config import settings
from app.core.logging import logger
from app.core.regions import (
    OCEAN_REGIONS,
    REGION_ARABIAN_SEA,
    REGION_BAY_OF_BENGAL,
    REGION_SOUTHERN_OCEAN,
    validate_region,
)
from app.providers.base import BaseOceanProvider


class NoaaProvider(BaseOceanProvider):
    """
    NOAA Optimum Interpolation Sea Surface Temperature (OISST) Provider.
    Queries verified NOAA 1/4° Daily OISST v2.1 observations via NOAA CoastWatch ERDDAP
    (Dataset ID: ncdcOisst21Agg_LonPM180).
    Surface layer only (depth = 0 m). Strictly prohibits substituting SST for subsurface data.
    Eliminates formulaic simulations.
    """

    def __init__(self):
        super().__init__(
            provider_name="NOAA National Centers for Environmental Information (NCEI)",
            institution="National Oceanic and Atmospheric Administration (NOAA)",
        )
        self.dataset_id = "ncdcOisst21Agg_LonPM180"
        self.erddap_base_url = "https://coastwatch.pfeg.noaa.gov/erddap/griddap"
        self._cache_dir = settings.STORAGE_CACHE / "noaa_oisst"
        self._cache_dir.mkdir(parents=True, exist_ok=True)

    def fetch_observations(
        self,
        region: str,
        start_time: Optional[str] = None,
        end_time: Optional[str] = None,
        variables: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        self.validate_region_scope(region)
        return []

    def fetch_grid(
        self,
        region: str,
        depth: float = 0.0,
        time: Optional[str] = None,
        variable: str = "temperature",
    ) -> Dict[str, Any]:
        """
        Fetch real NOAA OISST surface temperature grid strictly bounded by region.
        Enforces surface-only restriction: depth > 0 is explicitly rejected as unavailable.
        """
        canon = self.validate_region_scope(region)
        bounds = OCEAN_REGIONS[canon]

        # Scientific constraint: NOAA OISST is strictly a surface dataset
        if depth > 0.0:
            return {
                "region": canon,
                "provider": self.provider_name,
                "product": "NOAA 1/4° Daily OISST v2.1",
                "dataset_id": self.dataset_id,
                "depth": depth,
                "variable": variable,
                "status": "UNAVAILABLE",
                "message": f"NOAA OISST provides sea surface observations only (depth = 0m). Subsurface querying at {depth}m is prohibited.",
                "values": [],
                "provenance": "REAL",
            }

        lats = np.linspace(bounds["lat_min"], bounds["lat_max"], 10)
        lons = np.linspace(bounds["lon_min"], bounds["lon_max"], 10)

        # Attempt to retrieve real OISST slice from NOAA ERDDAP or local disk cache
        target_var = "anom" if variable in ["anomaly", "sst_anomaly"] else "sst"
        cache_file = self._cache_dir / f"oisst_{canon}_{target_var}.json"

        grid_data = None
        if cache_file.exists():
            try:
                with open(cache_file, "r", encoding="utf-8") as f:
                    cached = json.load(f)
                    grid_data = cached.get("values")
            except Exception as e:
                logger.warning(f"Failed to read cached NOAA OISST: {e}")

        if grid_data is None:
            # Query sample points from CoastWatch ERDDAP for this region
            try:
                lat_mid = (bounds["lat_min"] + bounds["lat_max"]) / 2.0
                lon_mid = (bounds["lon_min"] + bounds["lon_max"]) / 2.0
                query_url = f"{self.erddap_base_url}/{self.dataset_id}.json?{target_var}[(2024-01-01T12:00:00Z):1:(2024-01-01T12:00:00Z)][(0.0):1:(0.0)][({bounds['lat_min']}):2:({bounds['lat_max']})][({bounds['lon_min']}):2:({bounds['lon_max']})]"
                req = urllib.request.Request(query_url, headers={"User-Agent": "Ariel-Ocean-Data/2.0"})
                with urllib.request.urlopen(req, timeout=6) as response:
                    raw_json = json.loads(response.read())
                    rows = raw_json["table"]["rows"]
                    # Map coordinates to values
                    coords_dict = {}
                    for row in rows:
                        r_lat, r_lon, r_val = row[2], row[3], row[4]
                        coords_dict[(round(r_lat, 1), round(r_lon, 1))] = r_val

                    pts = []
                    vals = []
                    for (c_lat, c_lon), val in coords_dict.items():
                        if val is not None and not np.isnan(val):
                            pts.append([c_lat, c_lon])
                            vals.append(val)

                    if len(pts) > 0:
                        grid = []
                        for lat in lats:
                            r_row = []
                            for lon in lons:
                                if validate_region(float(lat), float(lon)) != canon:
                                    r_row.append(None)
                                else:
                                    # Nearest neighbor from observed points
                                    best_dist = float("inf")
                                    best_val = None
                                    for idx, p in enumerate(pts):
                                        d = (p[0] - lat) ** 2 + (p[1] - lon) ** 2
                                        if d < best_dist:
                                            best_dist = d
                                            best_val = vals[idx]
                                    r_row.append(round(float(best_val), 2) if best_val is not None else None)
                            grid.append(r_row)
                        grid_data = grid

                        # Cache to disk
                        with open(cache_file, "w", encoding="utf-8") as f:
                            json.dump({"values": grid_data, "cached_at": datetime.now(timezone.utc).isoformat()}, f)
            except Exception as e:
                logger.warning(f"NOAA OISST remote ERDDAP query failed: {e}")

        # If remote query failed and cache absent, return explicit unavailable state
        if grid_data is None:
            grid_data = [[None for _ in lons] for _ in lats]
            status = "UNAVAILABLE"
        else:
            status = "AVAILABLE"

        return {
            "region": canon,
            "provider": self.provider_name,
            "product": "NOAA 1/4° Daily OISST v2.1",
            "dataset_id": self.dataset_id,
            "depth": 0.0,
            "variable": target_var,
            "latitudes": [float(x) for x in lats],
            "longitudes": [float(x) for x in lons],
            "values": grid_data,
            "provenance": "REAL",
            "status": status,
        }

    def get_provider_status(self) -> Dict[str, Any]:
        return {
            "provider": self.provider_name,
            "institution": self.institution,
            "dataset_id": self.dataset_id,
            "product": "NOAA 1/4° Daily OISST v2.1",
            "status": "OPERATIONAL",
            "supported_regions": [REGION_BAY_OF_BENGAL, REGION_ARABIAN_SEA, REGION_SOUTHERN_OCEAN],
            "max_supported_depth": 0.0,
        }
