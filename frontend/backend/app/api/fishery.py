from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from app.core.regions import resolve_region
from app.schemas.fishery import FisheryAdvisoryResponse, PFZResponse
from app.services.fishery_service import fishery_service

router = APIRouter(prefix="/fishery", tags=["Fishery Advisories"])


@router.get("/advisory", response_model=FisheryAdvisoryResponse, summary="Generate fishery advisory")
def get_fishery_advisory(
    region: str = Query("Arabian Sea", description="Region: Arabian Sea, Bay of Bengal, Southern Ocean"),
    variable: str = Query("Chlorophyll (mg/m³)", description="Target biological variable"),
    time_range: str = Query("Next 7 days", description="Forecast period: Next 7 days, Next 3 days, Current 24h"),
):
    """Generate fishery advisory strictly within authorized regions."""
    if region and region.lower() not in ["all", "all regions", "indian ocean"]:
        canon = resolve_region(region)
        if not canon:
            raise HTTPException(
                status_code=400,
                detail=f"Region '{region}' is outside the authorized project scope. Strictly permitted: bay_of_bengal, arabian_sea, southern_ocean."
            )
    return fishery_service.get_advisory(region=region, variable=variable, time_range=time_range)


@router.get("/pfz", response_model=PFZResponse, summary="Potential Fishing Zones coordinates")
def get_pfz_coordinates(region: str = Query("Arabian Sea")):
    """Retrieve georeferenced coordinates of high biological productivity thermal fronts."""
    if region and region.lower() not in ["all", "all regions", "indian ocean"]:
        canon = resolve_region(region)
        if not canon:
            raise HTTPException(
                status_code=400,
                detail=f"Region '{region}' is outside authorized scope. Strictly permitted: bay_of_bengal, arabian_sea, southern_ocean."
            )
    return fishery_service.get_pfz_coordinates(region=region)
