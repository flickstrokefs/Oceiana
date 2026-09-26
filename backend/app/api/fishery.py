from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from app.core.regions import resolve_region
from app.schemas.fishery import FisheryAdvisoryResponse, PFZResponse, PFZCoordinate, FisheryGridData
from app.services.fishery_service import fishery_service
from app.providers.incois_pfz_provider import incois_pfz_provider
from app.providers.copernicus_bgc_provider import copernicus_bgc_provider

router = APIRouter(prefix="/fishery", tags=["Fishery Advisories"])


@router.get("/advisory", response_model=FisheryAdvisoryResponse, summary="Generate fishery advisory")
def get_fishery_advisory(
    region: str = Query("Arabian Sea", description="Region: Arabian Sea, Bay of Bengal, Southern Ocean"),
    variable: str = Query("Chlorophyll (mg/m³)", description="Target biological variable"),
    time_range: str = Query("Next 7 days", description="Forecast period: Current 24h, Next 3 days, Next 7 days"),
):
    """Generate comprehensive fishery advisory strictly within authorized regions."""
    if region and region.lower() not in ["all", "all regions", "indian ocean"]:
        canon = resolve_region(region)
        if not canon:
            raise HTTPException(
                status_code=400,
                detail=f"Region '{region}' is outside the authorized project scope. Strictly permitted: bay_of_bengal, arabian_sea, southern_ocean."
            )
    return fishery_service.get_advisory(region=region, variable=variable, time_range=time_range)


@router.get("/pfz", response_model=PFZResponse, summary="Potential Fishing Zones coordinates")
def get_pfz_coordinates(region: str = Query("Arabian Sea", description="Surveyed basin")):
    """Retrieve georeferenced coordinates of official INCOIS PFZs and Ocean-X derived candidate zones."""
    if region and region.lower() not in ["all", "all regions", "indian ocean"]:
        canon = resolve_region(region)
        if not canon:
            raise HTTPException(
                status_code=400,
                detail=f"Region '{region}' is outside authorized scope. Strictly permitted: bay_of_bengal, arabian_sea, southern_ocean."
            )
    return fishery_service.get_pfz_coordinates(region=region)


@router.get("/grid", response_model=FisheryGridData, summary="Retrieve spatial fishery background raster")
def get_fishery_grid(
    region: str = Query("Arabian Sea", description="Target basin"),
    variable: str = Query("Chlorophyll (mg/m³)", description="Variable: Chlorophyll, SST, Fronts, Productivity"),
):
    """Retrieve spatial grid raster for the selected fishery variable."""
    if region and region.lower() not in ["all", "all regions", "indian ocean"]:
        canon = resolve_region(region)
        if not canon:
            raise HTTPException(
                status_code=400,
                detail=f"Region '{region}' is outside authorized scope. Strictly permitted: bay_of_bengal, arabian_sea, southern_ocean."
            )
    return fishery_service.get_fishery_grid(region=region, variable=variable)


@router.get("/pfz/{pfz_id}", response_model=PFZCoordinate, summary="Individual PFZ zone details")
def get_pfz_detail(pfz_id: str):
    """Retrieve detailed scientific parameters and advisory notes for an individual PFZ."""
    # Search across all authorized basins
    all_points = fishery_service.get_pfz_coordinates("Indian Ocean").points
    matched = next((p for p in all_points if p.id == pfz_id), None)
    if not matched:
        # Check Southern Ocean as well
        so_points = fishery_service.get_pfz_coordinates("Southern Ocean").points
        matched = next((p for p in so_points if p.id == pfz_id), None)
    if not matched:
        raise HTTPException(status_code=404, detail=f"Potential Fishing Zone '{pfz_id}' not found.")
    return matched


@router.get("/sources", summary="Fishery and PFZ data provider status")
def get_fishery_sources():
    """Return operational status of fishery and PFZ data providers."""
    return {
        "incois_pfz_provider": incois_pfz_provider.get_provider_status(),
        "bgc_provider": copernicus_bgc_provider.get_provider_status(),
    }
