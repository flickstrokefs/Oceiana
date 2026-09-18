from typing import Literal, Optional, Dict, Any
from pydantic import BaseModel, Field

ProvenanceType = Literal["REAL", "MODEL", "DERIVED", "OFFICIAL", "SIMULATED"]


class ProvenanceMetadata(BaseModel):
    """
    Standardized oceanographic data provenance descriptor adhering to
    operational ocean data governance protocols.
    """
    provenance: ProvenanceType = Field(..., description="Scientific provenance class")
    source: str = Field(..., description="Originating organization or institution (e.g. Copernicus Marine, INCOIS / MoES)")
    dataset: str = Field(..., description="Canonical dataset identifier or numerical model run")
    timestamp: str = Field(..., description="Observation, forecast cycle, or generation timestamp (ISO 8601 UTC)")
    valid_from: Optional[str] = Field(None, description="Start of scientific validity period (ISO 8601 UTC)")
    valid_to: Optional[str] = Field(None, description="End of scientific validity period (ISO 8601 UTC)")
    processing_level: str = Field("L4 Gridded Analysis", description="Data processing level (e.g. L3S, L4, Model Forecast, Official Bulletin)")
    resolution: str = Field("0.083° (~9 km)", description="Nominal spatial resolution")
    region: str = Field(..., description="Authorized ocean basin (bay_of_bengal, arabian_sea, southern_ocean)")
    details: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Additional scientific metadata or calculation parameters")
