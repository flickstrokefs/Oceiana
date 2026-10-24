from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.core.logging import setup_logging, logger
from app.core.errors import ArielException, to_http_exception

# Import API routers
from app.api.system import router as system_router
from app.api.argo import router as argo_router
from app.api.observations import router as observations_router
from app.api.gliders import router as gliders_router
from app.api.ocean import router as ocean_router
from app.api.datasets import router as datasets_router
from app.api.hazard import router as hazard_router
from app.api.fishery import router as fishery_router
from app.api.search import router as search_router

# Initialize structured logging
setup_logging()

app = FastAPI(
    title=settings.APP_NAME,
    description=(
        "Production backend for OCEAN-X / ARIEL. "
        "Integrates numerical ocean model outputs and in-situ observations (Argo floats, gliders, CTD), "
        "standardized TEOS-10 derived products, vertical gradients, depth slicing, "
        "marine hazard assessment, and potential fishing zone advisories."
    ),
    version=settings.APP_VERSION,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Global domain exception handler
@app.exception_handler(ArielException)
async def ariel_exception_handler(request: Request, exc: ArielException):
    http_exc = to_http_exception(exc)
    return JSONResponse(
        status_code=http_exc.status_code,
        content=http_exc.detail,
    )


# Root entrypoint
@app.get("/")
def root():
    return {
        "status": "online",
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs": "/api/docs",
        "provenance_standards": {
            "REAL": "Direct in-situ instrument or recorded NetCDF measurement",
            "DERIVED": "Thermodynamically computed via TEOS-10 / scientific equations",
            "SIMULATED": "Numerical model prediction",
        },
        "endpoints": [
            "/api/health",
            "/api/metadata",
            "/api/argo",
            "/api/argo/observations",
            "/api/argo/profiles",
            "/api/argo/depth",
            "/api/observations",
            "/api/observations/{id}/profile",
            "/api/gliders",
            "/api/gliders/{id}/track",
            "/api/ocean/depth-slice",
            "/api/ocean/currents",
            "/api/ocean/timeseries",
            "/api/regions/{region_id}/slice",
            "/api/datasets",
            "/api/hazard/analyze",
            "/api/fishery/advisory",
            "/api/fishery/pfz",
            "/api/search",
        ],
    }


# Register routers under /api
app.include_router(system_router, prefix=settings.API_BASE_PATH)
app.include_router(argo_router, prefix=settings.API_BASE_PATH)
app.include_router(observations_router, prefix=settings.API_BASE_PATH)
app.include_router(gliders_router, prefix=settings.API_BASE_PATH)
app.include_router(ocean_router, prefix=settings.API_BASE_PATH)
app.include_router(datasets_router, prefix=settings.API_BASE_PATH)
app.include_router(hazard_router, prefix=settings.API_BASE_PATH)
app.include_router(fishery_router, prefix=settings.API_BASE_PATH)
app.include_router(search_router, prefix=settings.API_BASE_PATH)

logger.info(f"OCEAN-X {settings.APP_NAME} initialized successfully.")
