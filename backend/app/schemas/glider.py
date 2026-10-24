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
    source: str = Field(default="IFREMER OceanGliders GDAC", description="Data provider provenance")
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
    source: str = Field(default="IFREMER OceanGliders GDAC", description="Primary data authority")
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


class LiveGliderPayload(BaseModel):
    glider_id: str = Field(default="GLIDER-PHYSICAL-COM3", description="Physical glider identifier")
    timestamp: str = Field(..., description="Observation timestamp")
    raw_message: str = Field(..., description="Raw string as received over serial")
    depth_cm: Optional[float] = Field(default=None, description="Reported depth in centimetres")
    temp_c: Optional[float] = Field(default=None, description="Reported temperature in Celsius")
    temp_c_verified: bool = Field(default=False, description="Whether temperature is verified genuine or fallback")
    ds18b20_fallback_active: bool = Field(default=False, description="True if device DS18B20 fallback warning triggered")
    turb_v: Optional[float] = Field(default=None, description="Turbidity sensor voltage")
    ntu: Optional[float] = Field(default=None, description="Turbidity NTU value")
    turbidity_verified: bool = Field(default=False, description="Turbidity calibration verification flag")
    tds_v: Optional[float] = Field(default=None, description="TDS sensor voltage")
    tds_ppm: Optional[float] = Field(default=None, description="TDS ppm value")
    tds_verified: bool = Field(default=False, description="TDS calibration verification flag")
    latitude: Optional[float] = Field(default=None, description="WGS84 latitude if hardware GPS exists")
    longitude: Optional[float] = Field(default=None, description="WGS84 longitude if hardware GPS exists")
    warnings: List[str] = Field(default_factory=list, description="Active device warnings")
    parsed_fields: Dict[str, Any] = Field(default_factory=dict, description="All parsed key-value tokens")
    source: str = Field(default="serial_com3", description="Source port / reader identifier")


class LiveGliderStatusResponse(BaseModel):
    status: str = Field(..., description="'ONLINE', 'STALE', or 'DISCONNECTED'")
    is_online: bool
    glider_id: str
    latest: Optional[LiveGliderPayload] = None
    last_received_at: Optional[str] = None
    seconds_since_last_update: Optional[float] = None
    ds18b20_fallback_active: bool = False
    active_warnings: List[str] = Field(default_factory=list)
    total_observations_received: int = 0
    storage_note: str = "In-memory storage (local development; resets on backend restart)"

