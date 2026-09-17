from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Query
from app.services.search_service import search_service

router = APIRouter(prefix="/search", tags=["Search & Resources"])


@router.get("", summary="Search oceanographic resources and datasets")
def search_resources(
    q: Optional[str] = Query(None, description="Search query string"),
    type: Optional[str] = Query(None, description="Filter by type: Model, Argo, Glider, Mooring"),
    region: Optional[str] = Query(None, description="Region filter"),
    depth_min: Optional[float] = Query(None, ge=0),
    depth_max: Optional[float] = Query(None, ge=0),
):
    """Multi-entity scientific discovery across numerical models, Argo floats, gliders, and moorings."""
    return search_service.search(
        query=q,
        item_type=type,
        region=region,
        depth_min=depth_min,
        depth_max=depth_max,
    )
