from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from app.schemas.common import ProvenanceType


class GliderMeasurement(BaseModel):
    temperature: Optional[float] = Field(default=None, description="Water temperature in degrees Celsius")
    salinity: Optional[float] = Field(default=None, description="Practical salinity (PSU)")
    density: Optional[float] = Field(default=None, description="Water density (kg/m3)")


class GliderPoint(BaseModel):
    latitude: float = Field(..., description="WGS84 latitude")
    longitude: float = Field(..., description="WGS84 normalized longitude [-180, 180]")
    depth: float = Field(default=0.0, description="Sounding depth in meters")
    timestamp: str = Field(..., description="ISO 8601 UTC timestamp")
    temperature: Optional[float] = Field(default=None, description="In-situ water temperature in °C")
    salinity: Optional[float] = Field(default=None, description="Practical salinity in PSU")


class GliderItem(BaseModel):
    id: str = Field(..., description="Unique glider platform identifier")
    name: str = Field(..., description="Descriptive platform/mission name")
    mission: Optional[str] = Field(default=None, description="Glider scientific mission name")
    latitude: float = Field(..., description="Latest latitude")
    longitude: float = Field(..., description="Latest normalized longitude")
    timestamp: str = Field(..., description="Latest observation UTC timestamp")
    depth: Optional[float] = Field(default=None, description="Latest sounding depth (m)")
    status: str = Field(default="Active", description="Platform operational status")
    source: str = Field(default="IOOS Glider DAC / ERDDAP", description="Data provider provenance")
    source_dataset: str = Field(..., description="Authoritative ERDDAP dataset ID")
    region: Optional[str] = Field(default=None, description="Authorized region (bay_of_bengal, arabian_sea, southern_ocean)")
    macro_region: Optional[str] = Field(default=None, description="Macro ocean basin")
    platform: Optional[str] = Field(default=None, description="Platform vehicle model")
    operator: Optional[str] = Field(default=None, description="Deploying research institute/institution")
    wmo_id: Optional[str] = Field(default=None, description="WMO GTS platform number if assigned")
    battery: Optional[int] = Field(default=None, description="Estimated battery level percent if reported")
    measurements: Optional[GliderMeasurement] = Field(default=None, description="Latest surface/in-situ measurements")
    metadata: Optional[Dict[str, Any]] = Field(default=None, description="Full platform/mission metadata from ERDDAP")
    waypoints_count: int = Field(default=0, description="Total verified historical waypoints in mission track")
    waypoints: List[GliderPoint] = Field(default_factory=list, description="Chronological track waypoints")
    provenance: ProvenanceType = Field(default="REAL", description="Data provenance standard")


class GliderListResponse(BaseModel):
    data: List[GliderItem] = Field(..., description="List of authorized operational gliders")
    count: int = Field(..., description="Total count of active gliders matching query")
    latest_observation: Optional[str] = Field(default=None, description="Timestamp of the most recent observation")
    source: str = Field(default="IOOS Glider DAC / ERDDAP", description="Primary data authority")
    source_datasets: List[str] = Field(default_factory=list, description="ERDDAP datasets ingested")
    regions_included: List[str] = Field(default_factory=list, description="Authorized regions covered")


class GliderTrackResponse(BaseModel):
    glider_id: str = Field(..., description="Glider identifier")
    name: str = Field(..., description="Glider name")
    source_dataset: str = Field(..., description="Authoritative ERDDAP dataset ID")
    count: int = Field(..., description="Number of trajectory points")
    points: List[GliderPoint] = Field(..., description="Chronological trajectory waypoints")


class GliderProfileSounding(BaseModel):
    depth: float = Field(..., description="Standard depth in meters")
    temperature: Optional[float] = Field(default=None, description="Interpolated in-situ temperature (°C)")
    salinity: Optional[float] = Field(default=None, description="Interpolated salinity (PSU)")


class GliderProfileResponse(BaseModel):
    glider_id: str = Field(..., description="Glider identifier")
    name: str = Field(..., description="Glider name")
    soundings: List[GliderProfileSounding] = Field(..., description="Soundings at standard depths")
