from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from .common import ProvenanceType


class ArgoObservationRecord(BaseModel):
    profile_id: int
    latitude: float
    longitude: float
    time: str
    pres: float = Field(..., description="Pressure in dbar / depth approximation in meters")
    temp: Optional[float] = Field(None, description="In-situ Temperature in °C")
    psal: Optional[float] = Field(None, description="Practical Salinity in PSU")
    sa: Optional[float] = Field(None, description="Absolute Salinity in g/kg (TEOS-10)")
    ct: Optional[float] = Field(None, description="Conservative Temperature in °C (TEOS-10)")
    sigma0: Optional[float] = Field(None, description="Potential Density Anomaly in kg/m³")
    temp_gradient: Optional[float] = None
    psal_gradient: Optional[float] = None
    sigma0_gradient: Optional[float] = None
    platform_number: Optional[int] = None
    cycle_number: Optional[int] = None
    provenance: ProvenanceType = "REAL"


class ArgoObservationsResponse(BaseModel):
    count: int
    standardized: bool
    filters: Dict[str, Any]
    observations: List[ArgoObservationRecord]


class ArgoProfileSummary(BaseModel):
    profile_id: int
    platform_number: Optional[int] = None
    station_code: str
    latitude: float
    longitude: float
    time: str
    min_pressure: float
    max_pressure: float
    levels_count: int
    provenance: ProvenanceType = "REAL"


class ArgoProfilesListResponse(BaseModel):
    count: int
    profiles: List[ArgoProfileSummary]


class ArgoDepthResponse(BaseModel):
    levels_count: int
    standard_pressures: List[float]
    unit: str = "dbar"
