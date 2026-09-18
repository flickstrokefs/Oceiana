from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from app.core.regions import resolve_region
from app.schemas.hazard import HazardAnalysisRequest, HazardAnalysisResponse, HazardGridData
from app.services.hazard_service import hazard_service
from app.providers.copernicus_physics_provider import copernicus_physics_provider
from app.providers.copernicus_waves_provider import copernicus_waves_provider

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


@router.get("/grid", response_model=HazardGridData, summary="Retrieve spatial hazard raster grid")
def get_hazard_grid(
    variable: str = Query("Current Speed (m/s)", description="Hazard variable name"),
    region: str = Query("Arabian Sea", description="Target basin"),
    threshold: float = Query(1.5, description="Physical threshold limit"),
    time: Optional[str] = Query(None, description="Analysis timestamp (ISO 8601 UTC)"),
):
    """Retrieve full geospatial grid with boolean exceedance mask and geodesic cell areas."""
    if region and region.lower() not in ["all", "all regions", "indian ocean"]:
        canon = resolve_region(region)
        if not canon:
            raise HTTPException(
                status_code=400,
                detail=f"Region '{region}' is outside authorized scope. Strictly permitted: bay_of_bengal, arabian_sea, southern_ocean."
            )
    return hazard_service.get_hazard_grid(variable=variable, region=region, threshold=threshold, time=time)


@router.get("/layers", summary="List available hazard variables")
def get_hazard_layers():
    """List variables eligible for marine hazard assessment with physical defaults."""
    return {
        "variables": [
            {
                "id": "current_speed",
                "label": "Current Speed (m/s)",
                "default_threshold": 1.5,
                "unit": "m/s",
                "step": 0.1,
                "min": 0.1,
                "max": 5.0,
                "source": "Copernicus Marine Physics Analysis & Forecast / INCOIS ERDDAP",
                "provenance": "MODEL",
            },
            {
                "id": "wave_height",
                "label": "Significant Wave Height (m)",
                "default_threshold": 2.5,
                "unit": "m",
                "step": 0.2,
                "min": 0.5,
                "max": 10.0,
                "source": "Copernicus Marine Global Waves (VHM0)",
                "provenance": "MODEL",
            },
            {
                "id": "ssha",
                "label": "Sea Surface Height Anomaly (m)",
                "default_threshold": 0.2,
                "unit": "m",
                "step": 0.05,
                "min": -1.0,
                "max": 1.0,
                "source": "Copernicus Sea Level Anomaly (zos)",
                "provenance": "MODEL",
            },
            {
                "id": "thermal_stress",
                "label": "Thermal Stress Index",
                "default_threshold": 1.0,
                "unit": "index",
                "step": 0.2,
                "min": 0.0,
                "max": 5.0,
                "source": "Copernicus Marine SST / Climatological Baseline Anomaly",
                "provenance": "DERIVED",
            },
        ],
        "authorized_regions": ["bay_of_bengal", "arabian_sea", "southern_ocean"],
    }


@router.get("/sources", summary="Hazard data provider status")
def get_hazard_sources():
    """Return operational status of hazard data providers."""
    return {
        "physics_provider": copernicus_physics_provider.get_provider_status(),
        "wave_provider": copernicus_waves_provider.get_provider_status(),
    }
