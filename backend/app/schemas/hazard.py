from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field
from .provenance import ProvenanceType, ProvenanceMetadata


class HazardRegionResult(BaseModel):
    name: str = Field(..., description="Region or sub-basin name")
    region_id: Optional[str] = Field(None, description="Unique slug/identifier for sub-basin")
    area: str = Field(..., description="Exceedance area in km² formatted string e.g. '125,000'")
    area_km2: float = Field(..., description="Calculated geodesic exceedance area in km²")
    area_exceeded_km2: Optional[float] = Field(None, description="Calculated geodesic exceedance area in km² (frontend alias)")
    total_area_km2: Optional[float] = Field(None, description="Total surveyed geographic area in km²")
    maxValue: str = Field(..., description="Max recorded value formatted string e.g. '2.4'")
    max_value_raw: float = Field(..., description="Numeric maximum value in physical units")
    max_value: Optional[float] = Field(None, description="Numeric maximum value in physical units (frontend alias)")
    mean_value: Optional[float] = Field(None, description="Spatial mean value in surveyed cells")
    threshold: Optional[float] = Field(None, description="Applied physical threshold limit")
    exceedance_fraction: Optional[float] = Field(None, description="Fraction of surveyed area exceeding threshold")
    exceedance_pct: Optional[float] = Field(None, description="Percentage of surveyed area exceeding threshold (0-100)")
    risk_level: Literal["LOW", "MODERATE", "HIGH", "CRITICAL"] = Field(..., description="Documented risk tier")
    status: Optional[str] = Field("Active Alert", description="Operational alert status text")
    provenance: Optional[ProvenanceType] = Field("MODEL", description="Scientific provenance classification")
    source: Optional[str] = Field("Copernicus Marine", description="Data source organization")


class HazardGridData(BaseModel):
    """2D gridded raster data for geospatial client visualization."""
    variable: str = Field(..., description="Analyzed physical variable name")
    unit: str = Field(..., description="Physical measurement unit")
    latitudes: List[float] = Field(..., description="Grid cell center latitudes")
    longitudes: List[float] = Field(..., description="Grid cell center longitudes")
    values: List[List[Optional[float]]] = Field(..., description="2D matrix of analyzed scalar field")
    mask: List[List[bool]] = Field(..., description="2D boolean exceedance mask (True if cell >= threshold)")
    min_value: float = Field(..., description="Minimum value in analyzed field")
    max_value: float = Field(..., description="Maximum value in analyzed field")
    threshold: float = Field(..., description="Applied physical threshold limit")
    exceedance_fraction: float = Field(..., description="Area fraction of cells exceeding threshold")
    exceedance_area_km2: float = Field(..., description="Geodesic surface area exceeding threshold in km²")
    total_area_km2: float = Field(..., description="Total analyzed sea surface area in km²")
    provenance_meta: ProvenanceMetadata = Field(..., description="Detailed provenance and dataset metadata")


class HazardAnalysisRequest(BaseModel):
    variable: str = Field("Current Speed (m/s)", description="Hazard variable: Current Speed, Wave Height, SSHA, Thermal Stress")
    threshold: float = Field(1.5, description="Physical threshold limit")
    region: Optional[str] = Field("Indian Ocean", description="Target ocean basin: All Regions, Arabian Sea, Bay of Bengal, Southern Ocean")
    time: Optional[str] = Field(None, description="Target analysis timestamp (ISO 8601 UTC)")


class HazardAnalysisResponse(BaseModel):
    variable: str = Field(..., description="Physical variable name")
    threshold: float = Field(..., description="Physical threshold limit applied")
    unit: str = Field(..., description="Physical measurement unit")
    total_exceedance_area_km2: float = Field(..., description="Calculated total geodesic exceedance area in km²")
    total_area_exceeded_km2: Optional[float] = Field(None, description="Calculated total geodesic exceedance area in km² (frontend alias)")
    max_value: float = Field(..., description="Maximum value detected in regional analysis")
    mean_value: Optional[float] = Field(None, description="Spatial mean value across analyzed region")
    timestamp: str = Field(..., description="Source data generation or analysis timestamp")
    regions: List[HazardRegionResult] = Field(..., description="Regional analytical table breakdown")
    grid: Optional[HazardGridData] = Field(None, description="Full geospatial grid data for map raster")
    provenance: ProvenanceType = Field("MODEL", description="Scientific provenance: MODEL, REAL, DERIVED")
    provenance_meta: Optional[ProvenanceMetadata] = Field(None, description="Extended provenance descriptor")
