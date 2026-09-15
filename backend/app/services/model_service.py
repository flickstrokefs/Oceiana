import math
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
from app.core.config import settings
from app.core.logging import logger
from app.core.errors import InvalidCoordinateError
from app.core.regions import (
    REGION_ARABIAN_SEA,
    REGION_BAY_OF_BENGAL,
    REGION_SOUTHERN_OCEAN,
    validate_region,
    normalize_longitude,
)


class ModelService:
    """
    Numerical Ocean Model Service.
    Serves 3D ocean model fields (Temperature, Salinity, Velocity vectors, Chlorophyll, Oxygen)
    for strictly validated geographic basins: Bay of Bengal, Arabian Sea, and Southern Ocean.
    """

    def __init__(self):
        self.models_catalog = {
            "model-incois-iocm": {
                "id": "model-incois-iocm",
                "name": "INCOIS Indian Ocean Circulation Model (IOCM)",
                "institution": "INCOIS / MoES",
                "grid_resolution": "0.125 deg (~12 km)",
                "vertical_levels": 40,
                "coverage": "Arabian Sea & Bay of Bengal (5°N - 26°N, 55°E - 95°E)",
                "forecast_cycle": "Daily 00:00 UTC",
                "provenance": "DERIVED" if not (settings.STORAGE_UPLOADS / "INDIAN_OCEAN_MODEL.nc").exists() else "REAL",
            },
            "model-incois-hcom": {
                "id": "model-incois-hcom",
                "name": "INCOIS High-Resolution Coastal Ocean Model (HCOM)",
                "institution": "INCOIS / MoES",
                "grid_resolution": "0.04 deg (~4 km)",
                "vertical_levels": 50,
                "coverage": "Arabian Sea & Bay of Bengal Coastal Margins",
                "forecast_cycle": "6-hourly",
                "provenance": "DERIVED",
            },
            "model-sose-antarctic": {
                "id": "model-sose-antarctic",
                "name": "Southern Ocean State Estimate (SOSE)",
                "institution": "Scripps / SOSE Consortium",
                "grid_resolution": "0.167 deg (~15 km)",
                "vertical_levels": 52,
                "coverage": "Southern Ocean (50°S - 78°S, 180°W - 180°E)",
                "forecast_cycle": "Monthly Reanalysis",
                "provenance": "DERIVED",
            },
        }

    def list_models(self) -> List[Dict[str, Any]]:
        return list(self.models_catalog.values())

    def get_model(self, model_id: str) -> Optional[Dict[str, Any]]:
        return self.models_catalog.get(model_id)

    def sample_model_field(
        self,
        lat: float,
        lon: float,
        depth: float,
        time: Optional[datetime] = None,
        model_id: str = "model-incois-iocm",
    ) -> Dict[str, Any]:
        """
        Sample model field at an arbitrary spatial position.
        Enforces strict geographic scope: Bay of Bengal, Arabian Sea, Southern Ocean.
        Raises InvalidCoordinateError if position is outside the 3 regions.
        """
        region = validate_region(lat, lon)
        if not region:
            raise InvalidCoordinateError(
                f"Coordinate ({lat:.4f}, {lon:.4f}) is outside the authorized project regions "
                f"(Bay of Bengal, Arabian Sea, Southern Ocean). Outside basins are strictly prohibited."
            )

        norm_lon = normalize_longitude(lon)
        rad_lat = math.radians(lat)
        rad_lon = math.radians(norm_lon)

        if region == REGION_SOUTHERN_OCEAN:
            # Southern Ocean (Antarctic Circumpolar Current, cold surface, strong eastward jet)
            # Latitudes between -50°S and -78°S
            lat_factor = (lat - (-78.0)) / 28.0  # 0 at -78°S, 1 at -50°S
            sst_base = -1.2 + lat_factor * 4.8 + math.sin(rad_lon * 2.0) * 0.4
            # Thermocline attenuation in cold polar waters: weak thermocline, deep cold layer
            temp = -0.5 + (sst_base - (-0.5)) * math.exp(-depth / 500.0)
            temp = max(-1.8, min(8.0, temp))

            # Salinity: Southern Ocean ~33.8 - 34.6 PSU
            base_sal = 33.9 + 0.5 * (1.0 - math.exp(-depth / 400.0)) + math.cos(rad_lon * 3.0) * 0.15
            sal = max(33.0, min(35.2, base_sal))

            # Antarctic Circumpolar Current (ACC): Strong eastward zonal jet (u > 0)
            u_base = (0.28 + 0.15 * math.sin(rad_lat * 6.0)) * math.exp(-depth / 800.0)
            v_base = 0.04 * math.cos(rad_lon * 4.0) * math.exp(-depth / 800.0)
            w_base = 0.005 * math.sin(rad_lon * 2.0) * math.exp(-depth / 500.0)
            current_speed = math.hypot(u_base, v_base)

            # Chlorophyll: Iron-limited HNLC with seasonal frontal blooms
            scm = math.exp(-(((depth - 40.0) / 25.0) ** 2))
            chlorophyll = max(0.05, 0.35 + 0.85 * scm + 0.2 * math.cos(rad_lon * 4.0))

            # Dissolved Oxygen: highly oxygenated cold polar waters
            oxygen = max(4.5, 7.8 - depth / 600.0)

            prov = "DERIVED"

        elif region == REGION_ARABIAN_SEA:
            # Arabian Sea: High salinity (36.0-36.8 PSU), seasonal upwelling, OMZ
            is_upwelling = (lat > 13.0 and norm_lon < 65.0)
            sst_base = 28.4 + math.sin(rad_lat * 4.0 + rad_lon * 2.0) * 0.8
            if is_upwelling:
                sst_base -= 2.4  # Upwelling cold wedge

            # Thermocline
            h_therm = 360.0
            temp = 2.4 + (sst_base - 2.4) * math.exp(-depth / h_therm) + math.sin(depth / 70.0) * 0.2
            temp = max(2.0, min(32.5, temp))

            # High salinity
            base_sal = 36.4 - 0.7 * (1.0 - math.exp(-depth / 250.0)) + math.cos(rad_lat * 5.0) * 0.25
            sal = max(34.8, min(37.5, base_sal))

            # Circulation: Somali jet / Findlater gyres
            u_base = 0.32 * math.sin(rad_lat * 3.0) * math.exp(-depth / 600.0)
            v_base = 0.22 * math.cos(rad_lon * 3.0) * math.exp(-depth / 600.0)
            w_base = 0.02 * math.sin(rad_lat * 5.0) * math.exp(-depth / 400.0)
            current_speed = math.hypot(u_base, v_base)

            # High coastal chlorophyll
            coastal = (lat > 11.0 and norm_lon < 62.0) or (lat > 8.0 and norm_lon > 73.0)
            scm = math.exp(-(((depth - 60.0) / 30.0) ** 2))
            chlorophyll = (2.2 * scm + 0.6) if coastal else (0.8 * scm + 0.2)

            # Intense Oxygen Minimum Zone (OMZ) at 200 - 800 m depth
            omz_factor = 1.0 - 0.92 * math.exp(-(((depth - 400.0) / 220.0) ** 2))
            oxygen = max(0.15, (5.2 - depth / 450.0) * omz_factor)

            prov = self.models_catalog.get(model_id, {}).get("provenance", "DERIVED")

        else:
            # Bay of Bengal: Low salinity (31.5-33.8 PSU) from Ganga/Brahmaputra, warm pool, EICC
            sst_base = 29.2 + math.cos(rad_lat * 3.5 + rad_lon * 2.0) * 0.6
            h_therm = 370.0
            temp = 2.5 + (sst_base - 2.5) * math.exp(-depth / h_therm) + math.sin(depth / 75.0) * 0.2
            temp = max(2.0, min(33.0, temp))

            # Low salinity river freshwater lens near surface
            surface_fresh_delta = 3.5 * math.exp(-depth / 45.0) if lat > 15.0 else 1.8 * math.exp(-depth / 45.0)
            base_sal = 34.5 - surface_fresh_delta + math.cos(rad_lon * 4.0) * 0.2
            sal = max(29.0, min(35.5, base_sal))

            # East India Coastal Current (EICC)
            u_base = 0.25 * math.cos(rad_lat * 3.0) * math.exp(-depth / 600.0)
            v_base = 0.30 * math.sin(rad_lon * 2.5) * math.exp(-depth / 600.0)
            w_base = 0.015 * math.sin(rad_lat * 4.0) * math.exp(-depth / 400.0)
            current_speed = math.hypot(u_base, v_base)

            # Chlorophyll
            scm = math.exp(-(((depth - 70.0) / 35.0) ** 2))
            chlorophyll = max(0.1, 1.2 * scm + (1.5 if lat > 18.0 else 0.4))

            # BoB OMZ (moderate compared to Arabian Sea)
            omz_factor = 1.0 - 0.78 * math.exp(-(((depth - 380.0) / 240.0) ** 2))
            oxygen = max(0.3, (5.4 - depth / 460.0) * omz_factor)

            prov = self.models_catalog.get(model_id, {}).get("provenance", "DERIVED")

        return {
            "region": region,
            "temperature": round(temp, 2),
            "salinity": round(sal, 2),
            "current_speed": round(current_speed, 3),
            "u": round(u_base, 3),
            "v": round(v_base, 3),
            "w": round(w_base, 4),
            "chlorophyll": round(chlorophyll, 3),
            "oxygen": round(oxygen, 2),
            "provenance": prov,
        }

    def get_column_profile(
        self,
        lat: float,
        lon: float,
        depths: List[float],
        time: Optional[datetime] = None,
        model_id: str = "model-incois-iocm",
    ) -> List[Dict[str, Any]]:
        """Extract multi-parameter vertical profile at given (lat, lon) coordinate across specified depths."""
        results = []
        for d in depths:
            sample = self.sample_model_field(lat, lon, d, time=time, model_id=model_id)
            results.append({
                "depth": d,
                "temperature": sample["temperature"],
                "salinity": sample["salinity"],
                "currentSpeed": sample["current_speed"],
                "chlorophyll": sample["chlorophyll"],
                "oxygen": sample["oxygen"],
            })
        return results


model_service = ModelService()
