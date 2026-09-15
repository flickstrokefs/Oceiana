from datetime import datetime, timezone
from fastapi import APIRouter
from app.core.config import settings
from app.core.regions import OCEAN_REGIONS, VALID_REGIONS
from app.schemas.common import SystemHealthResponse
from app.services.dataset_service import dataset_registry

router = APIRouter(tags=["System & Metadata"])


@router.get("/health", response_model=SystemHealthResponse)
def health_check():
    """System health status, uptime, and loaded datasets."""
    datasets = [d.name for d in dataset_registry.list_datasets()]
    return SystemHealthResponse(
        status="healthy",
        service=settings.APP_NAME,
        version=settings.APP_VERSION,
        timestamp=datetime.now(timezone.utc).isoformat(),
        datasets_loaded=len(datasets),
        datasets=datasets,
        provenance_modes=["REAL", "DERIVED", "SIMULATED"],
    )


@router.get("/metadata")
def global_metadata():
    """Global oceanographic parameter units, valid physical ranges, and observation types."""
    return {
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "authorized_regions": [
            {
                "id": k,
                "name": v["name"],
                "bounds_label": v["bounds_label"],
                "description": v["description"],
            }
            for k, v in OCEAN_REGIONS.items()
        ],
        "parameters": [
            {"id": "temperature", "name": "Sea Water Temperature", "unit": "°C", "valid_range": [-2.0, 36.0]},
            {"id": "salinity", "name": "Practical Salinity", "unit": "PSU", "valid_range": [10.0, 42.0]},
            {"id": "current", "name": "Current Speed", "unit": "m/s", "valid_range": [0.0, 5.0]},
            {"id": "chlorophyll", "name": "Chlorophyll-a", "unit": "mg/m³", "valid_range": [0.0, 15.0]},
            {"id": "oxygen", "name": "Dissolved Oxygen", "unit": "ml/L", "valid_range": [0.0, 10.0]},
        ],
        "depth_strata_meters": [0, 50, 100, 200, 250, 500, 750, 1000, 1500, 2000],
        "supported_instruments": ["Argo Floats", "Autonomous Underwater Gliders", "CTD", "BGC Profilers", "RAMA Moorings"],
    }
