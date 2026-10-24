from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field
from .common import ProvenanceType


class RecommendedFishingZone(BaseModel):
    id: Optional[str] = None
    name: str
    region: str = "Bay of Bengal"
    status: str
    rating: Literal["FAVOURABLE", "GOOD", "MODERATE", "POOR"]
    latitude: float
    longitude: float
    chlorophyll_mean: float
    sst_mean: float
    salinity_mean: Optional[float] = 33.5
    mld_m: Optional[float] = 25.0
    optimal_catch_depth: Optional[int] = 35
    depth_stratum: Optional[str] = "Epipelagic"
    primary_species: Optional[List[str]] = Field(default_factory=list)
    gear_recommendations: Optional[List[str]] = Field(default_factory=list)
    scientific_rationale: Optional[str] = None
    bounds: Optional[Dict[str, float]] = None
    polygon: Optional[List[List[float]]] = None


class FisheryConditions(BaseModel):
    status: str = "Favourable Conditions"
    chlorophyll_range: str = "0.3 – 2.5 mg/m³"
    sst_range: str = "24 – 29 °C"
    current_state: str = "Moderate (0.4 – 0.8 m/s)"


class FisheryAdvisoryResponse(BaseModel):
    region: str
    generated_date: str
    conditions: FisheryConditions
    recommended_zones: List[RecommendedFishingZone]
    provenance: ProvenanceType = "DERIVED"
    active_pfz_count: Optional[int] = None
    peak_chlorophyll: Optional[float] = None
    mean_sst: Optional[float] = None
    depth_strata_summary: Optional[Dict[str, Any]] = None
    regulatory_notice: Optional[str] = None


class PFZCoordinate(BaseModel):
    id: str
    latitude: float
    longitude: float
    zone_name: str
    confidence: float
    chlorophyll: float
    sst: float
    front_strength: float
    mld_m: Optional[float] = None


class PFZResponse(BaseModel):
    region: str
    timestamp: str
    count: int
    points: List[PFZCoordinate]
    provenance: ProvenanceType = "DERIVED"
