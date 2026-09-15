from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field
from .common import ProvenanceType


class RecommendedFishingZone(BaseModel):
    name: str
    status: str
    rating: Literal["FAVOURABLE", "GOOD", "MODERATE", "POOR"]
    latitude: float
    longitude: float
    chlorophyll_mean: float
    sst_mean: float


class FisheryConditions(BaseModel):
    status: str = "Favourable Conditions"
    chlorophyll_range: str = "0.3 – 2.5 mg/m³"
    sst_range: str = "26 – 29 °C"
    current_state: str = "Moderate (0.4 – 0.8 m/s)"


class FisheryAdvisoryResponse(BaseModel):
    region: str
    generated_date: str
    conditions: FisheryConditions
    recommended_zones: List[RecommendedFishingZone]
    provenance: ProvenanceType = "DERIVED"


class PFZCoordinate(BaseModel):
    id: str
    latitude: float
    longitude: float
    zone_name: str
    confidence: float
    chlorophyll: float
    sst: float
    front_strength: float


class PFZResponse(BaseModel):
    region: str
    timestamp: str
    count: int
    points: List[PFZCoordinate]
    provenance: ProvenanceType = "DERIVED"
