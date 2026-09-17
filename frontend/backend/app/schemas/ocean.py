from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field
from .common import ProvenanceType


class OceanDataPoint(BaseModel):
    id: str
    latitude: float
    longitude: float
    depth: float
    value: float
    temperature: float
    salinity: float
    chlorophyll: Optional[float] = None
    velocity: Optional[Dict[str, float]] = None


class CurrentVector(BaseModel):
    latitude: float
    longitude: float
    depth: float
    u: float
    v: float
    speed: float
    angle: float


class OceanSliceResponse(BaseModel):
    parameter: str
    unit: str
    depth: float
    time: str
    latitudes: List[float]
    longitudes: List[float]
    values: List[List[Optional[float]]]
    min_val: float
    max_val: float
    provenance: ProvenanceType = "REAL"


class CurrentsSliceResponse(BaseModel):
    depth: float
    time: str
    count: int
    vectors: List[CurrentVector]
    provenance: ProvenanceType = "REAL"


class UnderwaterRegionDataResponse(BaseModel):
    regionId: str
    depth: float
    variable: str
    timestamp: str
    points: List[OceanDataPoint]
    currents: List[CurrentVector]
    provenance: ProvenanceType = "REAL"


class OceanPointSample(BaseModel):
    latitude: float
    longitude: float
    depth: float
    time: str
    temperature: float
    salinity: float
    chlorophyll: float
    velocity: Dict[str, float]
    provenance: ProvenanceType = "REAL"


class OceanTimeSeriesPoint(BaseModel):
    timestamp: str
    value: float
    unit: str
    provenance: ProvenanceType = "REAL"


class OceanTimeSeriesResponse(BaseModel):
    parameter: str
    latitude: float
    longitude: float
    depth: float
    unit: str
    points: List[OceanTimeSeriesPoint]
