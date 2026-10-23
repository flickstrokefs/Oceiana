from typing import Literal, Optional, Dict, Any, List
from pydantic import BaseModel, Field

# Provenance taxonomy:
# REAL      = directly measured in-situ (Argo, glider, CTD)
# DERIVED   = computed from REAL data (TEOS-10 SA/CT, gradients, MLD)
# SIMULATED = output of a named external operational model (e.g. CMEMS forecast)
# SYNTHETIC = produced by placeholder formulas in this codebase — NOT from any real source
ProvenanceType = Literal["REAL", "DERIVED", "SIMULATED", "SYNTHETIC"]


class SpatialBoundingBox(BaseModel):
    min_lat: float = Field(..., ge=-90, le=90)
    max_lat: float = Field(..., ge=-90, le=90)
    min_lon: float = Field(..., ge=-180, le=180)
    max_lon: float = Field(..., ge=-180, le=180)


class SystemHealthResponse(BaseModel):
    status: str
    service: str
    version: str
    timestamp: str
    datasets_loaded: int
    datasets: List[str]
    provenance_modes: List[str]


class VariableMetadata(BaseModel):
    name: str
    display_name: str
    unit: str
    description: str
    valid_range: List[float]
    source: str
