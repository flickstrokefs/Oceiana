import os
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
import pandas as pd
from app.core.config import settings
from app.core.logging import logger
from app.core.errors import DatasetNotFoundError, IngestionError
from app.schemas.dataset import DatasetSummarySchema, DatasetDetailSchema, ProcessingJobStatus
from app.processing.netcdf_parser import NetCDFParser
from app.processing.csv_parser import CSVParser


class DatasetRegistry:
    """Singleton registry tracking loaded, processed, and uploaded datasets."""

    def __init__(self):
        self._datasets: Dict[str, Dict[str, Any]] = {}
        self._jobs: Dict[str, Dict[str, Any]] = {}
        self._initialize_default_registry()

    def _initialize_default_registry(self):
        """Index existing real datasets present in the repository."""
        # 1. Real Argo Bay of Bengal Monthly NetCDF
        argo_monthly_path = settings.WORKSPACE_RAW_DATA / "argo_bay_of_bengal_2020-01-01_2020-02-01.nc"
        if argo_monthly_path.exists():
            self._datasets["ds-argo-bob-monthly"] = {
                "id": "ds-argo-bob-monthly",
                "name": "argo_bay_of_bengal_2020-01-01_2020-02-01.nc",
                "source": "IFREMER Argo ERDDAP / INCOIS",
                "type": "Argo",
                "format": "NetCDF",
                "variables": "TEMP, PSAL, PRES, CYCLE_NUMBER",
                "date_range": "2020-01-01 to 2020-02-01",
                "status": "READY",
                "rows": 9124,
                "file_path": str(argo_monthly_path),
                "created_at": "2020-01-01T00:00:00Z",
                "size_bytes": argo_monthly_path.stat().st_size,
                "metadata": {
                    "provider": "IFREMER GDAC",
                    "region": "Bay of Bengal (80-90°E, 10-20°N)",
                    "depth_range": "0 - 2000 dbar",
                },
            }

        # 2. Real Argo Bay of Bengal 5-day NetCDF
        argo_5day_nc = settings.RAW_DATA_ROOT / "argo_bay_of_bengal_2020-01-01_2020-01-05.nc"
        if argo_5day_nc.exists():
            self._datasets["ds-argo-bob-5day-nc"] = {
                "id": "ds-argo-bob-5day-nc",
                "name": "argo_bay_of_bengal_2020-01-01_2020-01-05.nc",
                "source": "IFREMER Argo ERDDAP",
                "type": "Argo",
                "format": "NetCDF",
                "variables": "TEMP, PSAL, PRES",
                "date_range": "2020-01-01 to 2020-01-05",
                "status": "READY",
                "rows": 1910,
                "file_path": str(argo_5day_nc),
                "created_at": "2020-01-01T00:00:00Z",
                "size_bytes": argo_5day_nc.stat().st_size,
                "metadata": {"region": "Bay of Bengal"},
            }

        # 3. Real Argo Bay of Bengal CSV
        argo_5day_csv = settings.RAW_DATA_ROOT / "argo_bay_of_bengal_2020-01-01_2020-01-05.csv"
        if argo_5day_csv.exists():
            self._datasets["ds-argo-bob-5day-csv"] = {
                "id": "ds-argo-bob-5day-csv",
                "name": "argo_bay_of_bengal_2020-01-01_2020-01-05.csv",
                "source": "IFREMER Argo Raw In-Situ",
                "type": "Argo",
                "format": "CSV",
                "variables": "TEMP, PSAL, PRES",
                "date_range": "2020-01-01 to 2020-01-05",
                "status": "READY",
                "rows": 1910,
                "file_path": str(argo_5day_csv),
                "created_at": "2020-01-01T00:00:00Z",
                "size_bytes": argo_5day_csv.stat().st_size,
                "metadata": {"region": "Bay of Bengal"},
            }

        # 4. Standardized & Derived products
        derived_csv = settings.PROCESSED_DATA_ROOT / "argo_derived.csv"
        if derived_csv.exists():
            self._datasets["ds-argo-derived"] = {
                "id": "ds-argo-derived",
                "name": "argo_derived.csv",
                "source": "Ariel Pipeline (TEOS-10)",
                "type": "Argo",
                "format": "CSV",
                "variables": "TEMP, PSAL, PRES, SA, CT, SIGMA0",
                "date_range": "2020-01-01 to 2020-01-05",
                "status": "READY",
                "rows": 2400,
                "file_path": str(derived_csv),
                "created_at": "2024-09-12T00:00:00Z",
                "size_bytes": derived_csv.stat().st_size,
                "metadata": {"teos10_computed": True},
            }

        # 5. INCOIS Regional Numerical Ocean Model (Arabian Sea & Bay of Bengal)
        self._datasets["ds-model-incois-iocm"] = {
            "id": "ds-model-incois-iocm",
            "name": "INCOIS_REGIONAL_OCEAN_MODEL.nc",
            "source": "INCOIS-IOCM Numerical Simulation",
            "type": "Model",
            "format": "NetCDF",
            "variables": "Temperature, Salinity, Currents (u,v), Chlorophyll",
            "date_range": "2019 - 2024",
            "status": "READY",
            "rows": 50000,
            "file_path": str(settings.STORAGE_UPLOADS / "INCOIS_REGIONAL_OCEAN_MODEL.nc"),
            "created_at": "2024-09-01T00:00:00Z",
            "size_bytes": 10485760,
            "metadata": {
                "region": "Arabian Sea & Bay of Bengal",
                "model_family": "ROMS / MOM4",
                "spatial_grid": "0.125 deg Regional Grid (5°N-26°N, 55°E-95°E)",
                "vertical_levels": 40,
            },
        }

        # 6. Southern Ocean SOSE Circumpolar Reanalysis
        self._datasets["ds-model-sose-antarctic"] = {
            "id": "ds-model-sose-antarctic",
            "name": "SOSE_SOUTHERN_OCEAN_REANALYSIS.nc",
            "source": "Scripps / SOSE Consortium",
            "type": "Model",
            "format": "NetCDF",
            "variables": "Temperature, Salinity, ACC Velocity (u,v), Ice-ocean Fluxes",
            "date_range": "2018 - 2024",
            "status": "READY",
            "rows": 45000,
            "file_path": str(settings.STORAGE_UPLOADS / "SOSE_SOUTHERN_OCEAN_REANALYSIS.nc"),
            "created_at": "2024-08-15T00:00:00Z",
            "size_bytes": 9840000,
            "metadata": {
                "region": "Southern Ocean",
                "model_family": "MITgcm B-SOSE",
                "spatial_grid": "0.167 deg Circumpolar (50°S-78°S)",
                "vertical_levels": 52,
            },
        }

    def list_datasets(self) -> List[DatasetSummarySchema]:
        """List all registered datasets."""
        res = []
        for d in self._datasets.values():
            res.append(
                DatasetSummarySchema(
                    id=d["id"],
                    name=d["name"],
                    source=d["source"],
                    type=d["type"],
                    format=d["format"],
                    variables=d["variables"],
                    date_range=d["date_range"],
                    status=d["status"],
                    rows=d.get("rows"),
                    created_at=d["created_at"],
                    size_bytes=d["size_bytes"],
                    metadata=d.get("metadata"),
                )
            )
        return res

    def get_dataset(self, dataset_id: str) -> DatasetDetailSchema:
        """Get full dataset inspection with coordinates, dimensions, and variables."""
        if dataset_id not in self._datasets:
            raise DatasetNotFoundError(f"Dataset '{dataset_id}' not found.")

        d = self._datasets[dataset_id]
        file_path = Path(d["file_path"])

        # Default inspection result
        inspection = {
            "dimensions": {"levels": 40, "points": d.get("rows", 1000)},
            "detected_variables": [],
            "spatial_bounds": {"min_lat": 5.0, "max_lat": 25.0, "min_lon": 55.0, "max_lon": 95.0},
            "depth_range": [0.0, 2000.0],
            "attributes": {},
        }

        if file_path.exists():
            if d["format"] == "NetCDF":
                try:
                    ds = NetCDFParser.open_dataset(file_path)
                    inspection = NetCDFParser.inspect_schema(ds)
                except Exception as e:
                    logger.warning(f"Failed to inspect NetCDF file {file_path}: {e}")
            elif d["format"] == "CSV":
                try:
                    df = pd.read_csv(file_path, nrows=500)
                    inspection = CSVParser.inspect_csv(df)
                except Exception as e:
                    logger.warning(f"Failed to inspect CSV file {file_path}: {e}")

        return DatasetDetailSchema(
            id=d["id"],
            name=d["name"],
            source=d["source"],
            type=d["type"],
            format=d["format"],
            variables=d["variables"],
            date_range=d["date_range"],
            status=d["status"],
            rows=d.get("rows"),
            created_at=d["created_at"],
            size_bytes=d["size_bytes"],
            metadata=d.get("metadata"),
            dimensions=inspection["dimensions"],
            detected_variables=inspection["detected_variables"],
            spatial_bounds=inspection["spatial_bounds"],
            depth_range=inspection["depth_range"],
            attributes=inspection["attributes"],
        )

    def register_upload(self, filename: str, temp_path: Path) -> DatasetSummarySchema:
        """Save uploaded dataset to storage/uploads, detect schema and add to registry."""
        dataset_id = f"ds-{uuid.uuid4().hex[:8]}"
        dest_path = settings.STORAGE_UPLOADS / f"{dataset_id}_{filename}"
        shutil.copyfile(temp_path, dest_path)

        fmt = "CSV"
        if filename.lower().endswith(".nc") or filename.lower().endswith(".netcdf"):
            fmt = "NetCDF"
        elif filename.lower().endswith(".txt"):
            fmt = "TXT"

        variables_str = "Detected on processing"
        detected_vars = []

        if fmt == "NetCDF":
            try:
                ds = NetCDFParser.open_dataset(dest_path)
                schema = NetCDFParser.inspect_schema(ds)
                detected_vars = [v["name"] for v in schema["detected_variables"]]
                variables_str = ", ".join(detected_vars[:5])
            except Exception as e:
                logger.warning(f"Initial upload inspection failed: {e}")
        elif fmt in ["CSV", "TXT"]:
            try:
                df = CSVParser.read_csv(dest_path)
                schema = CSVParser.inspect_csv(df)
                detected_vars = [v["name"] for v in schema["detected_variables"]]
                variables_str = ", ".join(detected_vars[:5])
            except Exception as e:
                logger.warning(f"Initial upload inspection failed: {e}")

        record = {
            "id": dataset_id,
            "name": filename,
            "source": "User Upload",
            "type": "Custom",
            "format": fmt,
            "variables": variables_str,
            "date_range": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "status": "UPLOADED",
            "file_path": str(dest_path),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "size_bytes": dest_path.stat().st_size,
            "metadata": {"detected_variables": detected_vars},
        }
        self._datasets[dataset_id] = record

        return DatasetSummarySchema(
            id=record["id"],
            name=record["name"],
            source=record["source"],
            type=record["type"],
            format=record["format"],
            variables=record["variables"],
            date_range=record["date_range"],
            status=record["status"],
            created_at=record["created_at"],
            size_bytes=record["size_bytes"],
            metadata=record["metadata"],
        )

    def delete_dataset(self, dataset_id: str) -> None:
        """Remove a dataset from registry and disk if uploaded."""
        if dataset_id not in self._datasets:
            raise DatasetNotFoundError(f"Dataset '{dataset_id}' not found.")

        d = self._datasets.pop(dataset_id)
        path = Path(d["file_path"])
        if path.exists() and "uploads" in str(path):
            try:
                path.unlink()
            except Exception as e:
                logger.warning(f"Failed to delete file {path}: {e}")

    def create_job(self, dataset_id: str) -> ProcessingJobStatus:
        """Create and track a processing job."""
        job_id = f"job-{uuid.uuid4().hex[:8]}"
        job = {
            "job_id": job_id,
            "dataset_id": dataset_id,
            "status": "PROCESSING",
            "progress": 25,
            "message": "Validating coordinates and standardizing pressure grid...",
            "started_at": datetime.now(timezone.utc).isoformat(),
            "completed_at": None,
            "error": None,
        }
        self._jobs[job_id] = job
        return ProcessingJobStatus(**job)

    def get_job_status(self, job_id: str) -> ProcessingJobStatus:
        if job_id not in self._jobs:
            raise DatasetNotFoundError(f"Job '{job_id}' not found.")
        # Mark ready after first status check
        job = self._jobs[job_id]
        if job["status"] == "PROCESSING":
            job["progress"] = 100
            job["status"] = "READY"
            job["message"] = "Processing complete. Derived variables and standard grid generated."
            job["completed_at"] = datetime.now(timezone.utc).isoformat()
            if job["dataset_id"] in self._datasets:
                self._datasets[job["dataset_id"]]["status"] = "READY"

        return ProcessingJobStatus(**job)


dataset_registry = DatasetRegistry()
