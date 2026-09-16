from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query
from app.core.regions import resolve_region
from app.schemas.argo import (
    ArgoObservationsResponse,
    ArgoProfilesListResponse,
    ArgoObservationRecord,
    ArgoDepthResponse,
)
from app.services.argo_service import argo_service

router = APIRouter(prefix="/argo", tags=["Argo Profiling Floats"])


@router.get("", summary="Argo dataset summary")
def argo_summary(region: Optional[str] = Query(None, description="Regional scope")):
    """Return scientific metadata, geographic extent, and range limits for loaded Argo observations."""
    if region:
        canon = resolve_region(region)
        if not canon:
            raise HTTPException(
                status_code=400,
                detail=f"Region '{region}' is outside the authorized project scope (bay_of_bengal, arabian_sea, southern_ocean)."
            )
    try:
        return argo_service.get_summary(region=region)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/observations", response_model=ArgoObservationsResponse, summary="Filter Argo observations")
def argo_observations(
    limit: int = Query(default=1000, ge=1, le=10000, description="Max records to return"),
    region: Optional[str] = Query(None, description="Regional scope: bay_of_bengal, arabian_sea, southern_ocean"),
    min_lat: Optional[float] = Query(default=None, ge=-90, le=90),
    max_lat: Optional[float] = Query(default=None, ge=-90, le=90),
    min_lon: Optional[float] = Query(default=None, ge=-180, le=180),
    max_lon: Optional[float] = Query(default=None, ge=-180, le=180),
    min_pressure: Optional[float] = Query(default=None, ge=0),
    max_pressure: Optional[float] = Query(default=None, ge=0),
    start_time: Optional[str] = None,
    end_time: Optional[str] = None,
    min_temperature: Optional[float] = None,
    max_temperature: Optional[float] = None,
    min_salinity: Optional[float] = None,
    max_salinity: Optional[float] = None,
    standardized: bool = Query(default=False, description="Interpolate onto standard 10 dbar grid"),
    platform_number: Optional[int] = None,
):
    """Retrieve spatial/temporal filtered Argo observations with strict regional enforcement."""
    if region:
        canon = resolve_region(region)
        if not canon:
            raise HTTPException(
                status_code=400,
                detail=f"Region '{region}' is outside authorized scope. Permitted: bay_of_bengal, arabian_sea, southern_ocean."
            )
    try:
        return argo_service.get_observations(
            limit=limit,
            region=region,
            min_lat=min_lat,
            max_lat=max_lat,
            min_lon=min_lon,
            max_lon=max_lon,
            min_pressure=min_pressure,
            max_pressure=max_pressure,
            start_time=start_time,
            end_time=end_time,
            min_temperature=min_temperature,
            max_temperature=max_temperature,
            min_salinity=min_salinity,
            max_salinity=max_salinity,
            standardized=standardized,
            platform_number=platform_number,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/profiles", response_model=ArgoProfilesListResponse, summary="List Argo profile soundings")
def argo_profiles(region: Optional[str] = Query(None, description="Regional scope: bay_of_bengal, arabian_sea, southern_ocean")):
    """List unique Argo profiles with platform identifiers and vertical extents."""
    if region:
        canon = resolve_region(region)
        if not canon:
            raise HTTPException(
                status_code=400,
                detail=f"Region '{region}' is outside authorized scope. Permitted: bay_of_bengal, arabian_sea, southern_ocean."
            )
    return argo_service.get_profiles(region=region)


@router.get("/profiles/{profile_id}", response_model=List[ArgoObservationRecord], summary="Get Argo profile soundings")
def get_argo_profile_by_id(profile_id: int):
    """Retrieve discrete vertical depth readings for a single profile."""
    try:
        return argo_service.get_profile_by_id(profile_id)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


# Backward compatibility alias
@router.get("/profile/{profile_id}", response_model=List[ArgoObservationRecord], include_in_schema=False)
def get_argo_profile_alias(profile_id: int):
    return get_argo_profile_by_id(profile_id)


@router.get("/depth", response_model=ArgoDepthResponse, summary="Standard pressure grid levels")
def argo_depth_levels():
    """Return standard pressure grid intervals used for vertical interpolation."""
    return argo_service.get_standard_depths()
