from fastapi import APIRouter, HTTPException
from app.core.regions import resolve_region
from app.data.cmems_fetch import DataNotAvailableError
from app.schemas.hazard import HazardAnalysisRequest, HazardAnalysisResponse
from app.services.hazard_service import hazard_service, AVAILABLE_CYCLONES

router = APIRouter(prefix="/hazard", tags=["Hazard Assessment"])


@router.post("/analyze", response_model=HazardAnalysisResponse, summary="Run marine hazard analysis")
def analyze_hazard(req: HazardAnalysisRequest):
    """
    Run spatial threshold exceedance calculation strictly within authorized basins:
    Bay of Bengal, Arabian Sea, and Southern Ocean.
    Supports Current Speed (m/s) and Tropical Cyclone Wind (kt).
    """
    if req.region and req.region.lower() not in ["all", "all regions", "indian ocean"]:
        canon = resolve_region(req.region)
        if not canon:
            raise HTTPException(
                status_code=400,
                detail=f"Region '{req.region}' is outside the authorized project scope. Strictly permitted: bay_of_bengal, arabian_sea, southern_ocean."
            )
    try:
        return hazard_service.analyze_hazard(req)
    except DataNotAvailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.get("/layers", summary="List available hazard variables")
def get_hazard_layers():
    """List variables eligible for marine hazard assessment."""
    return {
        "variables": [
            {
                "id": "current_speed",
                "label": "Current Speed (m/s)",
                "default_threshold": 1.5,
                "unit": "m/s",
                "provenance": "SIMULATED",
                "source": "Copernicus Marine GLORYS12/NEMO",
            },
            {
                "id": "cyclone_wind",
                "label": "Tropical Cyclone Wind (kt)",
                "default_threshold": 64.0,
                "unit": "kt",
                "provenance": "REAL",
                "source": "NOAA NCEI IBTrACS v04r01 (WMO)",
            },
        ],
        "authorized_regions": ["bay_of_bengal", "arabian_sea", "southern_ocean"],
    }


@router.get("/cyclones", summary="List available historical Bay of Bengal cyclones")
def get_available_cyclones():
    """Return verified historical cyclones with best-track records from NOAA IBTrACS."""
    return {
        "provenance": "REAL",
        "source": "NOAA NCEI IBTrACS v04r01 (WMO)",
        "cyclones": AVAILABLE_CYCLONES,
    }
