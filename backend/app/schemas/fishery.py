from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field
from .provenance import ProvenanceType, ProvenanceMetadata


class RecommendedFishingZone(BaseModel):
    id: str = Field(..., description="Unique PFZ or advisory zone identifier")
    name: str = Field(..., description="Descriptive zone or sector name")
    status: str = Field(..., description="Condition or oceanographic summary description")
    rating: Literal["FAVOURABLE", "GOOD", "MODERATE", "POOR"] = Field(..., description="Suitability rating")
    latitude: float = Field(..., description="Centroid or landing-referenced latitude")
    longitude: float = Field(..., description="Centroid or landing-referenced longitude")
    chlorophyll_mean: float = Field(..., description="Mean chlorophyll concentration (mg/m³)")
    sst_mean: float = Field(..., description="Mean sea surface temperature (°C)")
    current_speed: Optional[float] = Field(None, description="Local current velocity magnitude (m/s)")
    wave_height: Optional[float] = Field(None, description="Significant wave height (m)")
    front_strength: Optional[float] = Field(None, description="Thermal front gradient magnitude (°C/km)")
    score: float = Field(0.0, description="Productivity / suitability index score (0-100)")
    confidence: float = Field(0.0, description="Scientific detection confidence (0.0 - 1.0)")
    is_official: bool = Field(False, description="True if issued directly by INCOIS Marine Fisheries Advisory Service")
    advisory_type: str = Field("Ocean-X Derived PFZ", description="'Official INCOIS PFZ' or 'Ocean-X Derived PFZ'")
    sector: Optional[str] = Field(None, description="Official coastal sector name (e.g. Karnataka Sector, Odisha Sector)")
    landing_center: Optional[str] = Field(None, description="Reference fish landing center / harbor")
    distance_km: Optional[float] = Field(None, description="Distance from reference landing center in kilometers")
    bearing_deg: Optional[float] = Field(None, description="Compass bearing direction from landing center in degrees")
    valid_until: str = Field(..., description="Advisory expiry timestamp (ISO 8601 UTC)")
    source: str = Field(..., description="Issuing organization or input model")
    provenance: ProvenanceType = Field("DERIVED", description="OFFICIAL or DERIVED")
    source_datasets: List[str] = Field(default_factory=list, description="Input datasets used in calculation")


class FisheryConditions(BaseModel):
    status: str = Field("Favourable Conditions", description="High-level condition statement")
    chlorophyll_range: str = Field("0.3 – 2.5 mg/m³", description="Observed chlorophyll range in region")
    sst_range: str = Field("26 – 29 °C", description="Observed SST range in region")
    current_state: str = Field("Moderate (0.4 – 0.8 m/s)", description="Dominant current circulation state")
    wave_state: str = Field("Slight (0.8 – 1.4 m)", description="Observed sea wave conditions")
    pfz_count: int = Field(0, description="Number of active PFZ candidate zones identified")
    mean_productivity_score: float = Field(0.0, description="Mean regional productivity index (0-100)")
    chlorophyll_mean: Optional[float] = Field(None, description="Regional mean chlorophyll (mg/m³)")
    sst_mean: Optional[float] = Field(None, description="Regional mean SST (°C)")
    current_mean: Optional[float] = Field(None, description="Regional mean current speed (m/s)")
    wave_mean: Optional[float] = Field(None, description="Regional mean wave height (m)")


class FisheryGridData(BaseModel):
    """2D gridded raster data for fishery variable visualization."""
    variable: str = Field(..., description="Target variable (Chlorophyll, SST, Productivity, Thermal Fronts)")
    unit: str = Field(..., description="Physical measurement unit")
    latitudes: List[float] = Field(..., description="Grid cell latitudes")
    longitudes: List[float] = Field(..., description="Grid cell longitudes")
    values: List[List[Optional[float]]] = Field(..., description="2D gridded scalar field")
    min_value: float = Field(..., description="Minimum value in field")
    max_value: float = Field(..., description="Maximum value in field")
    provenance_meta: ProvenanceMetadata = Field(..., description="Source dataset provenance descriptor")


class FisheryAdvisoryResponse(BaseModel):
    region: str = Field(..., description="Target oceanographic basin or coastal sector")
    generated_date: str = Field(..., description="Generation date (e.g. 18 Sep 2026)")
    valid_until: str = Field(..., description="Advisory expiry date (e.g. 21 Sep 2026 23:59 UTC)")
    conditions: FisheryConditions = Field(..., description="Dynamic regional physical-biological conditions")
    recommended_zones: List[RecommendedFishingZone] = Field(..., description="List of detected and official PFZ zones")
    grid: Optional[FisheryGridData] = Field(None, description="Spatial raster field for map background")
    provenance: ProvenanceType = Field("DERIVED", description="OFFICIAL or DERIVED")
    provenance_meta: Optional[ProvenanceMetadata] = Field(None, description="Extended provenance metadata")


class PFZCoordinate(BaseModel):
    id: str = Field(..., description="Unique zone identifier")
    latitude: float = Field(..., description="Centroid latitude")
    longitude: float = Field(..., description="Centroid longitude")
    zone_name: str = Field(..., description="Zone name or sector description")
    confidence: float = Field(..., description="Scientific confidence metric (0.0 to 1.0)")
    chlorophyll: float = Field(..., description="Chlorophyll-a concentration (mg/m³)")
    sst: float = Field(..., description="Sea Surface Temperature (°C)")
    front_strength: float = Field(..., description="Thermal front gradient (°C/km)")
    current_speed: Optional[float] = Field(None, description="Current velocity magnitude (m/s)")
    wave_height: Optional[float] = Field(None, description="Significant wave height (m)")
    score: Optional[float] = Field(None, description="Composite suitability score (0-100)")
    is_official: bool = Field(False, description="Whether this is an official INCOIS advisory point")
    sector: Optional[str] = Field(None, description="Official coastal sector")
    landing_center: Optional[str] = Field(None, description="Nearest landing center")
    source: str = Field("INCOIS / Ocean-X", description="Source provider")
    provenance: ProvenanceType = Field("DERIVED", description="Scientific provenance")
    valid_time: Optional[str] = Field(None, description="Advisory valid timestamp")


class PFZResponse(BaseModel):
    region: str = Field(..., description="Surveyed ocean basin")
    timestamp: str = Field(..., description="Extraction timestamp (ISO 8601 UTC)")
    count: int = Field(..., description="Number of georeferenced PFZ points")
    points: List[PFZCoordinate] = Field(..., description="Array of PFZ points")
    provenance: ProvenanceType = Field("DERIVED", description="OFFICIAL or DERIVED")
    provenance_meta: Optional[ProvenanceMetadata] = Field(None, description="Extended provenance metadata")
