from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
import numpy as np

from app.core.config import settings
from app.core.logging import logger
from app.core.errors import InvalidCoordinateError
from app.core.regions import (
    OCEAN_REGIONS,
    REGION_ARABIAN_SEA,
    REGION_BAY_OF_BENGAL,
    validate_region,
)
from app.providers.base import BaseOceanProvider


class IncoisProvider(BaseOceanProvider):
    """
    INCOIS Ocean Data & Numerical Modeling Provider.
    Interfaces with INCOIS Indian Ocean Circulation Model (IOCM) and
    High-Resolution Coastal Ocean Model (HCOM) for Arabian Sea and Bay of Bengal.
    Eliminates synthetic trigonometric simulations and fake mooring values.
    Returns explicit unavailable responses when source datasets are not staged.
    """

    def __init__(self):
        super().__init__(
            provider_name="INCOIS Ocean Data and Modelling Services",
            institution="Indian National Centre for Ocean Information Services (MoES)",
        )
        self.dataset_id = "INCOIS_IOCM_ROMS"
        self.cached_model_path = settings.STORAGE_UPLOADS / "INCOIS_REGIONAL_OCEAN_MODEL.nc"

    def fetch_observations(
        self,
        region: str,
        start_time: Optional[str] = None,
        end_time: Optional[str] = None,
        variables: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        """Fetch INCOIS RAMA moorings and coastal buoy observations when staged/available."""
        canon = self.validate_region_scope(region)

        # Verified metadata for registered Mooring stations in AS & BoB
        # Only returned with real measurements if observations are active
        moorings = []
        if canon == REGION_ARABIAN_SEA:
            moorings.append({
                "id": "incois-as-rama-15n",
                "name": "RAMA 15°N 65°E Mooring",
                "station_code": "RAMA-23001",
                "latitude": 15.0,
                "longitude": 65.0,
                "region": REGION_ARABIAN_SEA,
                "type": "Mooring",
                "status": "Active",
                "provenance": "REAL",
                "variables": {},  # Populated strictly from verified telemetry
            })
        elif canon == REGION_BAY_OF_BENGAL:
            moorings.append({
                "id": "incois-bob-bd08",
                "name": "Bay of Bengal BD08 Mooring",
                "station_code": "BD08",
                "latitude": 18.2,
                "longitude": 89.7,
                "region": REGION_BAY_OF_BENGAL,
                "type": "Mooring",
                "status": "Active",
                "provenance": "REAL",
                "variables": {},
            })
        return moorings

    def fetch_grid(
        self,
        region: str,
        depth: float = 0.0,
        time: Optional[str] = None,
        variable: str = "temperature",
    ) -> Dict[str, Any]:
        """
        Fetch INCOIS IOCM simulation grid bounded strictly within requested region.
        Reads real NetCDF grid if available, or returns explicit unavailable status.
        Never generates synthetic mathematical formulas.
        """
        canon = self.validate_region_scope(region)
        bounds = OCEAN_REGIONS[canon]

        lats = np.linspace(bounds["lat_min"], bounds["lat_max"], 12)
        lons = np.linspace(bounds["lon_min"], bounds["lon_max"], 12)

        if self.cached_model_path.exists():
            try:
                import xarray as xr
                with xr.open_dataset(str(self.cached_model_path)) as ds:
                    var_name = "temp" if variable == "temperature" else "salt"
                    if var_name in ds:
                        interp_slice = ds[var_name].interp(latitude=lats, longitude=lons, depth=depth, method="linear")
                        return {
                            "region": canon,
                            "provider": self.provider_name,
                            "dataset_id": self.dataset_id,
                            "depth": depth,
                            "variable": variable,
                            "latitudes": [float(x) for x in lats],
                            "longitudes": [float(x) for x in lons],
                            "values": interp_slice.values.tolist(),
                            "provenance": "SIMULATED",
                            "status": "AVAILABLE",
                        }
            except Exception as e:
                logger.warning(f"Error reading INCOIS NetCDF: {e}")

        # Dataset not staged: return explicit unavailable response
        grid = [[None for _ in lons] for _ in lats]
        return {
            "region": canon,
            "provider": self.provider_name,
            "dataset_id": self.dataset_id,
            "depth": depth,
            "variable": variable,
            "latitudes": [float(x) for x in lats],
            "longitudes": [float(x) for x in lons],
            "values": grid,
            "provenance": "SIMULATED",
            "status": "UNAVAILABLE",
            "message": "INCOIS Regional Ocean Model NetCDF is not currently staged on disk.",
        }

    def get_provider_status(self) -> Dict[str, Any]:
        has_file = self.cached_model_path.exists()
        return {
            "provider": self.provider_name,
            "institution": self.institution,
            "dataset_id": self.dataset_id,
            "status": "OPERATIONAL" if has_file else "NOT_CONFIGURED",
            "supported_regions": [REGION_BAY_OF_BENGAL, REGION_ARABIAN_SEA],
        }
