from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field

DatasetStatus = Literal["UPLOADED", "VALIDATING", "PROCESSING", "READY", "FAILED"]


class DetectedVariable(BaseModel):
    name: str
    standard_name: Optional[str] = None
    units: Optional[str] = None
    dimensions: List[str]
    detected_type: str
    is_coordinate: bool = False
    is_ocean_variable: bool = False


class DatasetSummarySchema(BaseModel):
    id: str
    name: str
    source: str
    type: str  # Model, Argo, Glider, CTD, BGC, Satellite
    format: str  # NetCDF, CSV, TXT
    variables: str
    date_range: str
    status: DatasetStatus
    rows: Optional[int] = None
    created_at: str
    size_bytes: int
    metadata: Optional[Dict[str, Any]] = None


class DatasetDetailSchema(DatasetSummarySchema):
    dimensions: Dict[str, int]
    detected_variables: List[DetectedVariable]
    spatial_bounds: Optional[Dict[str, float]] = None
    depth_range: Optional[List[float]] = None
    attributes: Optional[Dict[str, Any]] = None


class DatasetUploadResponse(BaseModel):
    id: str
    name: str
    format: str
    size_bytes: int
    status: DatasetStatus
    message: str
    detected_variables: List[str]


class ProcessingJobStatus(BaseModel):
    job_id: str
    dataset_id: str
    status: DatasetStatus
    progress: int = Field(..., ge=0, le=100)
    message: str
    started_at: str
    completed_at: Optional[str] = None
    error: Optional[str] = None
