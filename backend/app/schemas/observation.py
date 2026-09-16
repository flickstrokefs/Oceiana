from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field
from .common import ProvenanceType

ProfileVariable = Literal["temperature", "salinity", "currentSpeed", "chlorophyll", "oxygen"]


class SurfaceValues(BaseModel):
    temperature: Optional[float] = None
    salinity: Optional[float] = None
    currentSpeed: Optional[float] = None
    chlorophyll: Optional[float] = None
    oxygen: Optional[float] = None


class ObservationSourceCard(BaseModel):
    id: str
    label: str
    sourceType: Literal["model", "glider", "argo", "mooring", "ctd"]
    latitude: float
    longitude: float
    timestamp: str
    depth: Optional[float] = None
    status: Optional[str] = "Active"
    metadata: Optional[Dict[str, Any]] = None
    surfaceValues: SurfaceValues
    provenance: ProvenanceType = "REAL"


class ProfileDepthSample(BaseModel):
    depth: float
    temperature: Optional[float] = None
    salinity: Optional[float] = None
    currentSpeed: Optional[float] = None
    chlorophyll: Optional[float] = None
    oxygen: Optional[float] = None


class ProfileSeries(BaseModel):
    depths: List[float]
    model: List[ProfileDepthSample]
    glider: List[ProfileDepthSample]
    argo: List[ProfileDepthSample]


class ObservationProfilePayload(BaseModel):
    selectedId: str
    selectedType: Literal["argo", "glider", "model"]
    model: ObservationSourceCard
    glider: Optional[ObservationSourceCard] = None
    argo: Optional[ObservationSourceCard] = None
    profile: ProfileSeries
    availableVariables: List[ProfileVariable] = [
        "temperature",
        "salinity",
        "currentSpeed",
        "chlorophyll",
        "oxygen",
    ]
    provenance: ProvenanceType = "REAL"


class ObservationListItem(BaseModel):
    id: str
    type: Literal["argo", "glider", "mooring", "ctd"]
    name: str
    stationCode: str
    latitude: float
    longitude: float
    depth: Optional[float] = None
    status: str
    timestamp: str
    provenance: ProvenanceType = "REAL"
