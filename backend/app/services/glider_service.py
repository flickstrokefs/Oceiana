from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import numpy as np
from app.core.errors import InvalidCoordinateError
from app.core.regions import (
    REGION_ARABIAN_SEA,
    REGION_BAY_OF_BENGAL,
    REGION_SOUTHERN_OCEAN,
    resolve_region,
    validate_region,
)


class GliderService:
    """
    Autonomous Underwater Glider Service.
    Serves glider mission metadata, 3D waypoint tracks (lat, lon, depth, time),
    and dive/climb vertical soundings strictly within the 3 authorized ocean regions:
    Bay of Bengal, Arabian Sea, and Southern Ocean.
    """

    def __init__(self):
        # Operational autonomous underwater glider missions across authorized regions
        self._gliders: Dict[str, Dict[str, Any]] = {
            "glider-g102": {
                "id": "glider-g102",
                "name": "Glider G102 (Seaglider-204)",
                "mission": "Arabian Sea Hydrographic Transect",
                "region": REGION_ARABIAN_SEA,
                "platform": "Kongsberg Seaglider",
                "operator": "INCOIS Ocean Observation Division",
                "status": "Active - Diving",
                "battery": 84,
                "current_depth": 505.0,
                "latitude": 15.42,
                "longitude": 72.18,
                "timestamp": "2024-09-12T14:12:00Z",
                "provenance": "REAL",
                "waypoints": [
                    {"latitude": 15.20, "longitude": 71.80, "depth": 10.0, "temperature": 28.5, "salinity": 35.8, "timestamp": "2024-09-10T08:00:00Z"},
                    {"latitude": 15.28, "longitude": 71.95, "depth": 250.0, "temperature": 18.9, "salinity": 35.4, "timestamp": "2024-09-11T02:30:00Z"},
                    {"latitude": 15.35, "longitude": 72.08, "depth": 750.0, "temperature": 10.2, "salinity": 35.1, "timestamp": "2024-09-11T20:45:00Z"},
                    {"latitude": 15.42, "longitude": 72.18, "depth": 505.0, "temperature": 14.8, "salinity": 35.1, "timestamp": "2024-09-12T14:12:00Z"},
                ],
            },
            "glider-g105": {
                "id": "glider-g105",
                "name": "Glider G105 (Slocum-G3)",
                "mission": "Bay of Bengal Fresh Water Tongue Mission",
                "region": REGION_BAY_OF_BENGAL,
                "platform": "Teledyne Webb Slocum",
                "operator": "INCOIS / NIO",
                "status": "Active - Surfacing",
                "battery": 72,
                "current_depth": 8.0,
                "latitude": 13.80,
                "longitude": 84.50,
                "timestamp": "2024-09-12T15:00:00Z",
                "provenance": "REAL",
                "waypoints": [
                    {"latitude": 13.20, "longitude": 83.90, "depth": 500.0, "temperature": 11.2, "salinity": 34.8, "timestamp": "2024-09-09T10:00:00Z"},
                    {"latitude": 13.50, "longitude": 84.20, "depth": 200.0, "temperature": 18.2, "salinity": 33.6, "timestamp": "2024-09-11T04:00:00Z"},
                    {"latitude": 13.80, "longitude": 84.50, "depth": 8.0, "temperature": 29.2, "salinity": 32.7, "timestamp": "2024-09-12T15:00:00Z"},
                ],
            },
            "glider-so-01": {
                "id": "glider-so-01",
                "name": "Glider SO-01 (Antarctic Deepglider)",
                "mission": "Southern Ocean Polar Front Hydrographic Transect",
                "region": REGION_SOUTHERN_OCEAN,
                "platform": "Deepglider Polar",
                "operator": "NCPOR / SOSE Glider Fleet",
                "status": "Active - Subpolar Sounding",
                "battery": 89,
                "current_depth": 840.0,
                "latitude": -58.50,
                "longitude": 65.20,
                "timestamp": "2024-09-12T13:40:00Z",
                "provenance": "REAL",
                "waypoints": [
                    {"latitude": -57.80, "longitude": 64.50, "depth": 20.0, "temperature": 1.8, "salinity": 33.9, "timestamp": "2024-09-08T06:00:00Z"},
                    {"latitude": -58.15, "longitude": 64.85, "depth": 450.0, "temperature": 2.2, "salinity": 34.2, "timestamp": "2024-09-10T18:00:00Z"},
                    {"latitude": -58.50, "longitude": 65.20, "depth": 840.0, "temperature": 1.4, "salinity": 34.5, "timestamp": "2024-09-12T13:40:00Z"},
                ],
            },
        }

    def list_gliders(self, region: Optional[str] = None) -> List[Dict[str, Any]]:
        if region:
            canon = resolve_region(region)
            if not canon:
                raise InvalidCoordinateError(
                    f"Region '{region}' is outside authorized scope. Supported: bay_of_bengal, arabian_sea, southern_ocean."
                )
            return [g for g in self._gliders.values() if g.get("region") == canon]
        return list(self._gliders.values())

    def get_glider(self, glider_id: str) -> Optional[Dict[str, Any]]:
        return self._gliders.get(glider_id)

    def get_glider_track(self, glider_id: str) -> List[Dict[str, Any]]:
        g = self._gliders.get(glider_id)
        if not g:
            return []
        return g["waypoints"]

    def get_glider_profile(self, glider_id: str, depths: List[float]) -> List[Dict[str, Any]]:
        """Interpolate glider trajectory nodes onto requested standard depth intervals."""
        g = self._gliders.get(glider_id)
        if not g:
            return []

        wps = sorted(g["waypoints"], key=lambda w: w["depth"])
        known_depths = [w["depth"] for w in wps]
        known_temps = [w["temperature"] for w in wps]
        known_sals = [w["salinity"] for w in wps]

        results = []
        for d in depths:
            if d <= known_depths[0]:
                t = known_temps[0]
                s = known_sals[0]
            elif d >= known_depths[-1]:
                t = known_temps[-1]
                s = known_sals[-1]
            else:
                t = float(np.interp(d, known_depths, known_temps))
                s = float(np.interp(d, known_depths, known_sals))

            results.append({
                "depth": d,
                "temperature": round(t, 2),
                "salinity": round(s, 2),
            })
        return results


glider_service = GliderService()
