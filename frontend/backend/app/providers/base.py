from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from app.core.regions import resolve_region, OCEAN_REGIONS, VALID_REGIONS
from app.core.errors import InvalidCoordinateError


class BaseOceanProvider(ABC):
    """
    Abstract Base Class for Oceanographic Data Providers.
    All providers must strictly enforce geographic filtering before returning data,
    limiting queries solely to Bay of Bengal, Arabian Sea, and Southern Ocean.
    """

    def __init__(self, provider_name: str, institution: str):
        self.provider_name = provider_name
        self.institution = institution

    def validate_region_scope(self, region: str) -> str:
        """
        Validate and resolve canonical region identifier.
        Raises InvalidCoordinateError if the region is outside the 3 allowed basins.
        """
        canonical = resolve_region(region)
        if not canonical or canonical not in VALID_REGIONS:
            raise InvalidCoordinateError(
                f"Region '{region}' is outside the authorized project scope. "
                f"Strictly permitted regions: {', '.join(sorted(VALID_REGIONS))}."
            )
        return canonical

    @abstractmethod
    def fetch_observations(
        self,
        region: str,
        start_time: Optional[str] = None,
        end_time: Optional[str] = None,
        variables: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        """Fetch in-situ profile or waypoint observations within strict regional bounds."""
        pass

    @abstractmethod
    def fetch_grid(
        self,
        region: str,
        depth: float = 0.0,
        time: Optional[str] = None,
        variable: str = "temperature",
    ) -> Dict[str, Any]:
        """Fetch spatial grid slice within strict regional bounds."""
        pass

    @abstractmethod
    def get_provider_status(self) -> Dict[str, Any]:
        """Return operational metadata and availability status."""
        pass
