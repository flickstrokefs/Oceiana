from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field
from .common import ProvenanceType


class HazardRegionResult(BaseModel):
    name: str
    area: str = Field(..., description="Area in km² formatted string e.g. '125,000'")
    area_km2: float
    maxValue: str = Field(..., description="Max recorded value formatted string e.g. '2.4'")
    max_value_raw: Optional[float] = None
    risk_level: Literal["NOT_EXPOSED", "LOW", "MODERATE", "HIGH", "CRITICAL"]
    impactSummary: Optional[str] = None
    recommendedAction: Optional[str] = None


class HazardAnalysisRequest(BaseModel):
    variable: str = Field("Current Speed (m/s)", description="Hazard variable")
    threshold: float = Field(1.5, description="Physical threshold limit")
    region: Optional[str] = "Indian Ocean"
    storm_name: Optional[str] = "AMPHAN"
    time: Optional[str] = None


class HazardAnalysisResponse(BaseModel):
    variable: str
    threshold: float
    unit: str
    total_exceedance_area_km2: float
    max_value: float
    timestamp: str
    regions: List[HazardRegionResult]
    provenance: ProvenanceType = "REAL"
    storm_name: Optional[str] = None
    available_storms: Optional[List[Dict[str, Any]]] = None
    cyclone_track: Optional[List[Dict[str, Any]]] = None
    storm_meta: Optional[Dict[str, Any]] = None
    regional_cyclones: Optional[List[Dict[str, Any]]] = None

