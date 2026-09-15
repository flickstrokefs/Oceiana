from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query
from app.core.regions import resolve_region
from app.schemas.observation import ObservationListItem, ObservationProfilePayload
from app.services.observation_service import observation_service

router = APIRouter(prefix="/observations", tags=["Observation Profiles"])


@router.get("", response_model=List[ObservationListItem], summary="List in-situ ocean platforms")
def list_observations(
    type: Optional[str] = Query(None, description="Filter by 'argo' or 'glider'"),
    region: Optional[str] = Query(None, description="Regional scope: bay_of_bengal, arabian_sea, southern_ocean"),
):
    """List deployed in-situ instruments (Argo floats and gliders) strictly within authorized regions."""
    if region:
        canon = resolve_region(region)
        if not canon:
            raise HTTPException(
                status_code=400,
                detail=f"Region '{region}' is outside authorized scope. Permitted: bay_of_bengal, arabian_sea, southern_ocean."
            )
    return observation_service.list_observations(obs_type=type, region=region)


@router.get("/{id}", summary="Get observation platform details")
def get_observation_by_id(id: str):
    """Retrieve details for a specific observation platform."""
    obs_list = observation_service.list_observations()
    for item in obs_list:
        if item.id == id or item.id.replace("argo-", "") == id:
            return item
    raise HTTPException(status_code=404, detail=f"Observation platform '{id}' not found.")


@router.get("/{id}/profile", response_model=ObservationProfilePayload, summary="Get Model vs Glider vs Argo profile comparison")
def get_observation_profile(
    id: str,
    type: Optional[str] = Query(None, description="Instrument type ('argo' or 'glider')"),
):
    """
    Mandatory Webpage 2 endpoint:
    Returns multi-parameter depth profile comparison between numerical model output,
    autonomous gliders, and Argo profiling floats.
    """
    try:
        return observation_service.get_observation_profile(observation_id=id, obs_type=type)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))
