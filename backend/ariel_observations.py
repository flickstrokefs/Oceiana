"""
ARIEL Observation Profile API.
Integrated with production services (Argo, Glider, Model).
Provides Model / Glider / Argo comparison payloads for Webpage 2.
"""

from __future__ import annotations
from typing import Any, Literal
from fastapi import APIRouter, HTTPException, Query
from app.services.observation_service import observation_service

router = APIRouter(prefix="/api/observations", tags=["ARIEL Observations"])

ProfileType = Literal["argo", "glider"]


@router.get("")
def list_observations(type: str | None = Query(default=None)):
    """List available observation markers (Argo floats and gliders)."""
    items = observation_service.list_observations(obs_type=type)
    return {"count": len(items), "observations": [item.model_dump() for item in items]}


@router.get("/{observation_id}")
def get_observation(observation_id: str):
    """Retrieve details for a single observation platform."""
    obs_list = observation_service.list_observations()
    for item in obs_list:
        if item.id == observation_id or item.id.replace("argo-", "") == observation_id:
            return item.model_dump()
    raise HTTPException(status_code=404, detail="Observation not found.")


@router.get("/{observation_id}/profile")
def get_observation_profile(
    observation_id: str,
    type: ProfileType | None = Query(default=None),
):
    """
    Return Model vs Glider vs Argo depth profiles for Observation Profile modal.
    Adheres strictly to the frontend TypeScript contract with real data & provenance.
    """
    try:
        payload = observation_service.get_observation_profile(observation_id, type)
        return payload.model_dump()
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))
