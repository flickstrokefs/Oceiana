from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


class GeoJSONGeometry(BaseModel):
    """GeoJSON Polygon geometry."""

    type: Literal["Polygon"]

    coordinates: List[
        List[
            List[float]
        ]
    ]


class ArabianSeaSector(BaseModel):
    """Lightweight Arabian Sea internal sector."""

    id: str
    name: str
    type: str
    description: str
    source: str
    geometry: GeoJSONGeometry
    crs: str = "EPSG:4326"
    vertex_count: Optional[int] = None
    bbox: Optional[Dict[str, float]] = None
    centroid: Optional[List[float]] = None
    provenance: str = "ARIEL_DEFINED"


class ArabianSeaSectorList(BaseModel):
    """Response containing all Arabian Sea sectors."""

    dataset: str
    version: str
    classification: str
    sectors: List[ArabianSeaSector]


class ArabianSeaSectorAssignment(BaseModel):
    """Result of assigning a coordinate to an Arabian Sea sector."""

    latitude: float = Field(
        ...,
        ge=-90,
        le=90,
    )

    longitude: float = Field(
        ...,
        ge=-180,
        le=180,
    )

    region_id: str = "arabian_sea"

    sector_id: Optional[str] = None


class ArabianSeaObservation(BaseModel):
    """Lightweight observation marker for the Arabian Sea overview."""

    id: str

    type: Literal["glider", "argo"]

    latitude: float = Field(
        ...,
        ge=-90,
        le=90,
    )

    longitude: float = Field(
        ...,
        ge=-180,
        le=180,
    )

    timestamp: Optional[str] = None

    sector_id: Optional[str] = None

    region_id: str = "arabian_sea"

    source: str

    metadata: Dict[str, Any] = Field(
        default_factory=dict
    )


class ArabianSeaObservationList(BaseModel):
    """Combined lightweight Argo + Glider observation response."""

    region_id: str = "arabian_sea"

    count: int

    glider_count: int

    argo_count: int

    observations: List[ArabianSeaObservation]