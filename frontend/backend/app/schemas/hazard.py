from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field
from .common import ProvenanceType


class HazardRegionResult(BaseModel):
    name: str
    area: str = Field(..., description="Area in km² formatted string e.g. '125,000'")
    area_km2: float
    maxValue: str = Field(..., description="Max recorded value formatted string e.g. '2.4'")
    max_value_raw: float
    risk_level: Literal["LOW", "MODERATE", "HIGH", "CRITICAL"]


class HazardAnalysisRequest(BaseModel):
    variable: str = Field("Current Speed (m/s)", description="Hazard variable")
    threshold: float = Field(1.5, description="Physical threshold limit")
    region: Optional[str] = "Indian Ocean"
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
