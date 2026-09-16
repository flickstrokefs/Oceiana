from fastapi import APIRouter, HTTPException
from app.core.regions import resolve_region
from app.schemas.hazard import HazardAnalysisRequest, HazardAnalysisResponse
from app.services.hazard_service import hazard_service

router = APIRouter(prefix="/hazard", tags=["Hazard Assessment"])


@router.post("/analyze", response_model=HazardAnalysisResponse, summary="Run marine hazard analysis")
def analyze_hazard(req: HazardAnalysisRequest):
    """
    Run spatial threshold exceedance calculation strictly within authorized basins:
    Bay of Bengal, Arabian Sea, and Southern Ocean.
    """
    if req.region and req.region.lower() not in ["all", "all regions", "indian ocean"]:
        canon = resolve_region(req.region)
        if not canon:
            raise HTTPException(
                status_code=400,
                detail=f"Region '{req.region}' is outside the authorized project scope. Strictly permitted: bay_of_bengal, arabian_sea, southern_ocean."
            )
    return hazard_service.analyze_hazard(req)


@router.get("/layers", summary="List available hazard variables")
def get_hazard_layers():
    """List variables eligible for marine hazard assessment."""
    return {
        "variables": [
            {"id": "current_speed", "label": "Current Speed (m/s)", "default_threshold": 1.5, "unit": "m/s"},
            {"id": "wave_height", "label": "Significant Wave Height (m)", "default_threshold": 2.5, "unit": "m"},
            {"id": "ssha", "label": "Sea Surface Height Anomaly (m)", "default_threshold": 0.2, "unit": "m"},
            {"id": "thermal_stress", "label": "Thermal Stress Index", "default_threshold": 1.0, "unit": "index"},
        ],
        "authorized_regions": ["bay_of_bengal", "arabian_sea", "southern_ocean"],
    }
