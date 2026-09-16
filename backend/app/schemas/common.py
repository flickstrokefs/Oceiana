from typing import Literal, Optional, Dict, Any, List
from pydantic import BaseModel, Field

ProvenanceType = Literal["REAL", "DERIVED", "SIMULATED"]


class SpatialBoundingBox(BaseModel):
    min_lat: float = Field(..., ge=-90, le=90)
    max_lat: float = Field(..., ge=-90, le=90)
    min_lon: float = Field(..., ge=-180, le=180)
    max_lon: float = Field(..., ge=-180, le=180)


class SystemHealthResponse(BaseModel):
    status: str
    service: str
    version: str
    timestamp: str
    datasets_loaded: int
    datasets: List[str]
    provenance_modes: List[str]


class VariableMetadata(BaseModel):
    name: str
    display_name: str
    unit: str
    description: str
    valid_range: List[float]
    source: str
