from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query
from app.core.regions import resolve_region
from app.services.glider_service import glider_service

router = APIRouter(prefix="/gliders", tags=["Autonomous Gliders"])


@router.get("", summary="List active glider missions")
def list_gliders(region: Optional[str] = Query(None, description="Regional scope: bay_of_bengal, arabian_sea, southern_ocean")):
    """Retrieve operational underwater glider missions strictly within authorized regions."""
    if region:
        canon = resolve_region(region)
        if not canon:
            raise HTTPException(
                status_code=400,
                detail=f"Region '{region}' is outside authorized scope. Permitted: bay_of_bengal, arabian_sea, southern_ocean."
            )
    return glider_service.list_gliders(region=region)


@router.get("/{id}", summary="Get glider mission details")
def get_glider(id: str):
    """Retrieve mission trajectory, battery level, and platform metadata for a glider."""
    g = glider_service.get_glider(id)
    if not g:
        raise HTTPException(status_code=404, detail=f"Glider '{id}' not found.")
    return g


@router.get("/{id}/track", summary="Get glider 3D trajectory track")
def get_glider_track(id: str):
    """Retrieve 3D waypoints (lat, lon, depth, time) for Cesium track rendering."""
    track = glider_service.get_glider_track(id)
    if not track:
        raise HTTPException(status_code=404, detail=f"No track available for glider '{id}'.")
    return track


@router.get("/{id}/profile", summary="Get glider vertical depth profile")
def get_glider_profile(id: str):
    """Retrieve dive/climb depth soundings across standard ocean strata."""
    depths = [0.0, 50.0, 100.0, 200.0, 250.0, 500.0, 750.0, 1000.0, 1500.0, 2000.0]
    profile = glider_service.get_glider_profile(id, depths)
    if not profile:
        raise HTTPException(status_code=404, detail=f"No profile available for glider '{id}'.")
    return profile
