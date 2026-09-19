from typing import Optional

from fastapi import (
    APIRouter,
    HTTPException,
    Query,
)

from app.core.arabian_sea import (
    get_sector,
    list_sectors,
    resolve_sector,
)

from app.schemas.arabian_sea import (
    ArabianSeaObservation,
    ArabianSeaObservationList,
    ArabianSeaSectorAssignment,
    ArabianSeaSectorList,
)

from app.services.argo_service import argo_service
from app.services.glider_service import glider_service


router = APIRouter(
    prefix="/arabian-sea",
    tags=["Arabian Sea"],
)


@router.get(
    "/regions",
    response_model=ArabianSeaSectorList,
    summary="List lightweight Arabian Sea internal sectors",
)
def get_arabian_sea_regions():
    """
    Return lightweight Arabian Sea sector geometry.

    This endpoint intentionally does NOT load:
    - model grids
    - 3D meshes
    - volumetric data
    - depth layers
    """

    return {
        "dataset": (
            "ARIEL Arabian Sea "
            "Internal Sector Registry"
        ),
        "version": "0.1.0",
        "classification": "ARIEL_DEFINED",
        "sectors": list_sectors(),
    }


@router.get(
    "/regions/{sector_id}",
    summary="Get one Arabian Sea sector",
)
def get_arabian_sea_region(
    sector_id: str,
):
    """Return a single Arabian Sea sector."""

    sector = get_sector(
        sector_id
    )

    if not sector:
        raise HTTPException(
            status_code=404,
            detail=(
                f"Arabian Sea sector "
                f"'{sector_id}' not found"
            ),
        )

    return sector


@router.get(
    "/resolve",
    response_model=ArabianSeaSectorAssignment,
    summary="Resolve a coordinate to an Arabian Sea sector",
)
def resolve_arabian_sea_sector(
    latitude: float = Query(
        ...,
        ge=-90,
        le=90,
    ),
    longitude: float = Query(
        ...,
        ge=-180,
        le=180,
    ),
):
    """
    Resolve latitude/longitude to an Arabian Sea sector.
    """

    sector_id: Optional[str] = resolve_sector(
        latitude,
        longitude,
    )

    return {
        "latitude": latitude,
        "longitude": longitude,
        "region_id": "arabian_sea",
        "sector_id": sector_id,
    }


@router.get(
    "/observations",
    response_model=ArabianSeaObservationList,
    summary="List Arabian Sea Argo and Glider observations",
)
def get_arabian_sea_observations(
    limit: int = Query(
        default=1000,
        ge=1,
        le=10000,
        description="Maximum combined observations to return",
    ),
):
    """
    Return lightweight Arabian Sea observation points.

    Argo and Glider data are obtained from their existing
    services. Each observation is assigned to the ARIEL
    Arabian Sea sector containing its coordinates.

    This endpoint intentionally does NOT return:
    - 3D grids
    - meshes
    - trajectories
    - full Argo profiles
    - volumetric model data
    """

    observations = []

    # ---------------------------------------------------------
    # GLIDERS
    # ---------------------------------------------------------

    gliders = glider_service.list_gliders(
        region="arabian_sea"
    )

    for glider in gliders:
        latitude = glider.get("latitude")
        longitude = glider.get("longitude")

        if latitude is None or longitude is None:
            continue

        try:
            latitude = float(latitude)
            longitude = float(longitude)
        except (TypeError, ValueError):
            continue

        sector_id = resolve_sector(
            latitude,
            longitude,
        )

        observations.append(
            ArabianSeaObservation(
                id=str(
                    glider.get(
                        "id",
                        ""
                    )
                ),
                type="glider",
                latitude=latitude,
                longitude=longitude,
                timestamp=glider.get(
                    "timestamp"
                ),
                sector_id=sector_id,
                region_id="arabian_sea",
                source=glider.get(
                    "source",
                    "IFREMER OceanGliders GDAC",
                ),
                metadata={
                    "name": glider.get("name"),
                    "mission": glider.get("mission"),
                    "status": glider.get("status"),
                    "source_dataset": glider.get(
                        "source_dataset"
                    ),
                    "wmo_id": glider.get(
                        "wmo_id"
                    ),
                },
            )
        )

    # ---------------------------------------------------------
    # ARGO
    # ---------------------------------------------------------

    argo_profiles = argo_service.get_profiles(
        region="arabian_sea"
    )

    for profile in argo_profiles.profiles:
        latitude = profile.latitude
        longitude = profile.longitude

        sector_id = resolve_sector(
            latitude,
            longitude,
        )

        observations.append(
            ArabianSeaObservation(
                id=f"argo-{profile.profile_id}",
                type="argo",
                latitude=latitude,
                longitude=longitude,
                timestamp=profile.time,
                sector_id=sector_id,
                region_id="arabian_sea",
                source="Argo",
                metadata={
                    "profile_id": profile.profile_id,
                    "platform_number": (
                        profile.platform_number
                    ),
                    "station_code": (
                        profile.station_code
                    ),
                    "levels_count": (
                        profile.levels_count
                    ),
                    "min_pressure": (
                        profile.min_pressure
                    ),
                    "max_pressure": (
                        profile.max_pressure
                    ),
                    "provenance": (
                        profile.provenance
                    ),
                },
            )
        )

    # ---------------------------------------------------------
    # Keep only observations successfully assigned to an
    # Arabian Sea internal sector.
    # ---------------------------------------------------------

    observations = [
        observation
        for observation in observations
        if observation.sector_id is not None
    ]

    # Stable ordering:
    # Gliders first, then Argo, then ID.
    observations.sort(
        key=lambda item: (
            0 if item.type == "glider" else 1,
            item.id,
        )
    )

    observations = observations[:limit]

    glider_count = sum(
        1
        for observation in observations
        if observation.type == "glider"
    )

    argo_count = sum(
        1
        for observation in observations
        if observation.type == "argo"
    )

    return ArabianSeaObservationList(
        region_id="arabian_sea",
        count=len(observations),
        glider_count=glider_count,
        argo_count=argo_count,
        observations=observations,
    )