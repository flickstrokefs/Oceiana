from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query
from app.core.regions import resolve_region, validate_region
from app.schemas.ocean import (
    OceanSliceResponse,
    CurrentsSliceResponse,
    UnderwaterRegionDataResponse,
    OceanPointSample,
    OceanTimeSeriesResponse,
)
from app.services.ocean_service import ocean_field_service

router = APIRouter(tags=["Ocean Fields & Slices"])


@router.get("/ocean/depth-slice", response_model=OceanSliceResponse, summary="Horizontal ocean field slice")
def get_depth_slice(
    parameter: str = Query("temperature", description="Ocean variable: temperature, salinity, currents, chlorophyll"),
    depth: float = Query(0.0, ge=0, le=5000, description="Target depth in meters"),
    time: Optional[str] = None,
    lat_min: Optional[float] = Query(None, ge=-90, le=90),
    lat_max: Optional[float] = Query(None, ge=-90, le=90),
    lon_min: Optional[float] = Query(None, ge=-180, le=180),
    lon_max: Optional[float] = Query(None, ge=-180, le=180),
    resolution: int = Query(25, ge=5, le=100, description="Grid resolution step"),
    region: Optional[str] = Query(None, description="Regional scope: bay_of_bengal, arabian_sea, southern_ocean"),
):
    """Retrieve structured 2D horizontal field slice at target depth for 3D Cesium visualization."""
    if region:
        canon = resolve_region(region)
        if not canon:
            raise HTTPException(
                status_code=400,
                detail=f"Region '{region}' is outside the authorized project scope. Supported regions are: bay_of_bengal, arabian_sea, southern_ocean."
            )
    return ocean_field_service.get_parameter_slice(
        parameter=parameter,
        depth=depth,
        time=time,
        lat_min=lat_min,
        lat_max=lat_max,
        lon_min=lon_min,
        lon_max=lon_max,
        resolution=resolution,
        region=region,
    )


@router.get("/ocean/currents", response_model=CurrentsSliceResponse, summary="Ocean current vectors")
def get_current_vectors(
    depth: float = Query(0.0, ge=0, le=5000),
    time: Optional[str] = None,
    lat_min: Optional[float] = Query(None, ge=-90, le=90),
    lat_max: Optional[float] = Query(None, ge=-90, le=90),
    lon_min: Optional[float] = Query(None, ge=-180, le=180),
    lon_max: Optional[float] = Query(None, ge=-180, le=180),
    step: float = Query(2.0, ge=0.5, le=5.0, description="Vector spacing in degrees"),
    region: Optional[str] = Query(None, description="Regional scope: bay_of_bengal, arabian_sea, southern_ocean"),
):
    """Retrieve velocity vectors (u, v, speed, angle) for Cesium particle flow animation."""
    if region:
        canon = resolve_region(region)
        if not canon:
            raise HTTPException(
                status_code=400,
                detail=f"Region '{region}' is outside the authorized project scope. Supported regions are: bay_of_bengal, arabian_sea, southern_ocean."
            )
    return ocean_field_service.get_current_vectors(
        depth=depth,
        time=time,
        lat_min=lat_min,
        lat_max=lat_max,
        lon_min=lon_min,
        lon_max=lon_max,
        step=step,
        region=region,
    )


@router.get("/ocean/profile", response_model=OceanPointSample, summary="Point ocean vertical sounding")
def get_point_sample(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    depth: float = Query(0.0, ge=0, le=5000),
):
    """Sample physical ocean properties at single geographic coordinate and depth."""
    if not validate_region(lat, lon):
        raise HTTPException(
            status_code=400,
            detail=f"Coordinate ({lat}, {lon}) lies outside authorized project regions (Bay of Bengal, Arabian Sea, Southern Ocean)."
        )
    return ocean_field_service.get_point_sample(lat, lon, depth)


@router.get("/ocean/timeseries", response_model=OceanTimeSeriesResponse, summary="Point temporal evolution")
def get_timeseries(
    parameter: str = Query("temperature", description="Target parameter"),
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    depth: float = Query(0.0, ge=0, le=5000),
):
    """Retrieve 5-day temporal evolution for bottom timeline scrubber."""
    if not validate_region(lat, lon):
        raise HTTPException(
            status_code=400,
            detail=f"Coordinate ({lat}, {lon}) lies outside authorized project regions."
        )
    return ocean_field_service.get_timeseries(parameter=parameter, lat=lat, lon=lon, depth=depth)


@router.get("/regions/{region_id}/slice", response_model=UnderwaterRegionDataResponse, summary="Region depth slice")
def get_region_slice(
    region_id: str,
    depth: float = Query(0.0, ge=0, le=5000),
    var: str = Query("temperature", description="Variable: temperature, salinity, chlorophyll, current"),
):
    """Endpoint specifically matching frontend UnderwaterRegionDataProvider.ts."""
    canon = resolve_region(region_id)
    if not canon:
        raise HTTPException(
            status_code=400,
            detail=f"Region '{region_id}' is outside authorized scope. Permitted: bay-of-bengal, arabian-sea, southern-ocean."
        )
    return ocean_field_service.get_regional_slice(region_id=region_id, depth=depth, variable=var)


@router.get("/ocean-depth-points", summary="Underwater 3D point cloud")
def get_ocean_depth_points():
    """Endpoint specifically matching frontend oceanDepthData.ts for 3D depth stratum point clouds."""
    pts = []
    depth_bands = [0, 50, 100, 200, 500, 750, 1000, 1500, 2000]
    coords = [
        (15.0, 68.0),  # Arabian Sea
        (12.0, 72.0),  # Arabian Sea
        (14.0, 85.0),  # Bay of Bengal
        (18.0, 88.0),  # Bay of Bengal
        (-55.0, 65.0), # Southern Ocean
    ]
    pt_id = 1
    for lat, lon in coords:
        for d in depth_bands:
            sample = ocean_field_service.get_point_sample(lat, lon, float(d))
            pts.append({
                "id": f"pt-{pt_id}",
                "latitude": lat,
                "longitude": lon,
                "depth": d,
                "temperature": sample.temperature,
                "salinity": sample.salinity,
            })
            pt_id += 1
    return pts


@router.get("/ocean/{parameter}", response_model=OceanSliceResponse, summary="Generic parameter slice")
def get_generic_parameter(
    parameter: str,
    depth: float = Query(0.0, ge=0, le=5000),
    time: Optional[str] = None,
    lat_min: Optional[float] = Query(None, ge=-90, le=90),
    lat_max: Optional[float] = Query(None, ge=-90, le=90),
    lon_min: Optional[float] = Query(None, ge=-180, le=180),
    lon_max: Optional[float] = Query(None, ge=-180, le=180),
    resolution: int = Query(25, ge=5, le=100),
    region: Optional[str] = Query(None),
):
    """Query ocean parameter slice (temperature, salinity, currents, chlorophyll)."""
    if region:
        canon = resolve_region(region)
        if not canon:
            raise HTTPException(
                status_code=400,
                detail=f"Region '{region}' is outside the authorized project scope."
            )
    return ocean_field_service.get_parameter_slice(
        parameter=parameter,
        depth=depth,
        time=time,
        lat_min=lat_min,
        lat_max=lat_max,
        lon_min=lon_min,
        lon_max=lon_max,
        resolution=resolution,
        region=region,
    )
