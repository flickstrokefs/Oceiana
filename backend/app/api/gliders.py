from typing import Any, Dict, List, Optional
# pyrefly: ignore [missing-import]
from fastapi import APIRouter, HTTPException, Query, Response
from app.core.regions import resolve_region
from app.schemas.glider import (
    GliderItem,
    GliderPoint,
    GliderProfileResponse,
    GliderProfileSounding,
    LiveGliderPayload,
    LiveGliderStatusResponse,
)
from app.services.glider_service import glider_service
from app.services.live_glider_service import live_glider_service

router = APIRouter(prefix="/gliders", tags=["Autonomous Gliders"])


@router.get("", response_model=List[GliderItem], summary="List active glider missions")
def list_gliders(
    region: Optional[str] = Query(None, description="Regional scope: bay_of_bengal, arabian_sea, southern_ocean"),
    start_time: Optional[str] = Query(None, description="ISO UTC timestamp lower bound"),
    end_time: Optional[str] = Query(None, description="ISO UTC timestamp upper bound"),
):
    """
    Retrieve operational underwater glider missions strictly within authorized regions.
    Returns real observations ingested from the IOOS Glider DAC / ERDDAP.
    If a region currently has 0 operational gliders, returns empty list [] (never fabricates).
    """
    if region:
        canon = resolve_region(region)
        if not canon:
            raise HTTPException(
                status_code=400,
                detail=f"Region '{region}' is outside authorized scope. Permitted: bay_of_bengal, arabian_sea, southern_ocean."
            )
        gliders = glider_service.list_gliders(region=canon)
    else:
        gliders = glider_service.list_gliders()

    if start_time or end_time:
        filtered = []
        for g in gliders:
            ts = g.get("timestamp")
            if not ts:
                continue
            if start_time and ts < start_time:
                continue
            if end_time and ts > end_time:
                continue
            filtered.append(g)
        return filtered

    return gliders


@router.post("/live", response_model=LiveGliderStatusResponse, summary="Ingest live physical glider telemetry")
def ingest_live_glider_telemetry(payload: LiveGliderPayload):
    """
    Ingest real-time serial telemetry from the physical glider port reader.
    Stores latest reading and bounded history in memory for local development.
    """
    return live_glider_service.ingest_telemetry(payload)


@router.get("/live", response_model=LiveGliderStatusResponse, summary="Get live physical glider status and latest reading")
def get_live_glider_status(response: Response):
    """
    Retrieve current operational status, latest observation, sensor calibration flags,
    and device warnings for the physical glider.
    """
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return live_glider_service.get_status()


@router.get("/live/history", response_model=List[LiveGliderPayload], summary="Get bounded live physical glider history")
def get_live_glider_history(limit: int = Query(50, ge=1, le=200, description="Max observations to return")):
    """
    Retrieve chronological in-memory history of observations from the physical glider.
    Note: accumulated history resets when the backend restarts.
    """
    return live_glider_service.get_history(limit=limit)


@router.get("/{id}", response_model=GliderItem, summary="Get glider mission details")
def get_glider(id: str):
    """Retrieve mission trajectory, battery level, and platform metadata for a glider."""
    g = glider_service.get_glider(id)
    if not g:
        raise HTTPException(status_code=404, detail=f"Glider '{id}' not found.")
    return g


@router.get("/{id}/track", response_model=List[GliderPoint], summary="Get glider 3D trajectory track")
def get_glider_track(
    id: str,
    downsample: Optional[int] = Query(None, ge=2, le=5000, description="Max number of waypoints to return"),
    start_time: Optional[str] = Query(None, description="Filter waypoints after ISO timestamp"),
    end_time: Optional[str] = Query(None, description="Filter waypoints before ISO timestamp"),
):
    """Retrieve 3D waypoints (lat, lon, depth, time) for Cesium track rendering."""
    g = glider_service.get_glider(id)
    if not g:
        raise HTTPException(status_code=404, detail=f"No glider found for ID '{id}'.")

    track = glider_service.get_glider_track(id, downsample=downsample)
    if not track:
        raise HTTPException(status_code=404, detail=f"No track available for glider '{id}'.")

    if start_time or end_time:
        filtered_track = []
        for pt in track:
            ts = pt.get("timestamp")
            if not ts:
                continue
            if start_time and ts < start_time:
                continue
            if end_time and ts > end_time:
                continue
            filtered_track.append(pt)
        return filtered_track

    return track


@router.get("/{id}/profile", summary="Get glider vertical depth profile")
def get_glider_profile(id: str):
    """Retrieve dive/climb depth soundings across standard ocean strata."""
    g = glider_service.get_glider(id)
    if not g:
        raise HTTPException(status_code=404, detail=f"Glider '{id}' not found.")

    depths = [0.0, 50.0, 100.0, 200.0, 250.0, 500.0, 750.0, 1000.0, 1500.0, 2000.0]
    profile = glider_service.get_glider_profile(id, depths)
    if not profile:
        raise HTTPException(status_code=404, detail=f"No profile available for glider '{id}'.")
    return profile
