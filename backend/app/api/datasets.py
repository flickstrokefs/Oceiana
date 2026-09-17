from pathlib import Path
from typing import List
from fastapi import APIRouter, File, HTTPException, UploadFile
from app.schemas.dataset import (
    DatasetSummarySchema,
    DatasetDetailSchema,
    DatasetUploadResponse,
    ProcessingJobStatus,
)
from app.services.dataset_service import dataset_registry

router = APIRouter(prefix="/datasets", tags=["Dataset Manager"])


@router.get("", response_model=List[DatasetSummarySchema], summary="List all datasets")
def list_datasets():
    """List loaded, configured, and uploaded oceanographic datasets."""
    return dataset_registry.list_datasets()


@router.post("/upload", response_model=DatasetUploadResponse, summary="Upload oceanographic dataset")
async def upload_dataset(file: UploadFile = File(...)):
    """Upload NetCDF (.nc), CSV (.csv), or CTD (.txt) dataset into the storage pipeline."""
    filename = file.filename or "uploaded_dataset"
    temp_path = Path("temp_upload_" + filename)
    try:
        contents = await file.read()
        with open(temp_path, "wb") as f:
            f.write(contents)

        summary = dataset_registry.register_upload(filename, temp_path)
        return DatasetUploadResponse(
            id=summary.id,
            name=summary.name,
            format=summary.format,
            size_bytes=summary.size_bytes,
            status=summary.status,
            message=f"Dataset '{filename}' successfully ingested and added to registry.",
            detected_variables=summary.variables.split(", "),
        )
    finally:
        if temp_path.exists():
            temp_path.unlink()


@router.get("/{id}", response_model=DatasetDetailSchema, summary="Get dataset schema and variables")
def get_dataset(id: str):
    """Retrieve detected variables, coordinate dimensions, and spatial bounds for a dataset."""
    try:
        return dataset_registry.get_dataset(id)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{id}/process", response_model=ProcessingJobStatus, summary="Process dataset into standard grid")
def process_dataset(id: str):
    """Trigger standardization and TEOS-10 derived calculation pipeline."""
    return dataset_registry.create_job(id)


@router.get("/{id}/status", response_model=ProcessingJobStatus, summary="Check dataset processing status")
def get_dataset_status(id: str):
    """Check status of an ongoing background processing job."""
    return dataset_registry.get_job_status(id)


@router.delete("/{id}", summary="Delete dataset")
def delete_dataset(id: str):
    """Remove dataset from registry and storage."""
    try:
        dataset_registry.delete_dataset(id)
        return {"status": "success", "message": f"Dataset '{id}' deleted."}
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))
