import os
from pathlib import Path
from typing import List, Optional
from pydantic import Field

try:
    from pydantic_settings import BaseSettings, SettingsConfigDict
except ImportError:
    from pydantic import BaseModel
    try:
        from pydantic import BaseSettings
    except ImportError:
        BaseSettings = BaseModel

    def SettingsConfigDict(**kwargs):
        return kwargs


class Settings(BaseSettings):
    """Production application settings with environment variable support."""

    APP_NAME: str = "Ariel Ocean Data API"
    APP_VERSION: str = "2.0.0"
    ENVIRONMENT: str = "production"
    DEBUG: bool = False

    # Network / Server
    API_HOST: str = "0.0.0.0"
    API_PORT: int = int(os.environ.get("PORT", 8000))
    API_BASE_PATH: str = "/api"
    CORS_ORIGINS: List[str] = [
        "https://oceianaxoxo.vercel.app",
        "http://oceianaxoxo.vercel.app",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:3000",
        "oceianaxoxo-rgaj5pv9t-sudhanshuvermafs-7215s-projects.vercel.app",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "https://oceianaxoxo.vercel.app/",
        "*",
    ]

    # Paths
    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent
    DATA_ROOT: Path = Path(__file__).resolve().parent.parent.parent / "data"
    RAW_DATA_ROOT: Path = Path(__file__).resolve().parent.parent.parent / "data" / "raw"
    PROCESSED_DATA_ROOT: Path = Path(__file__).resolve().parent.parent.parent / "data" / "processed"
    STORAGE_UPLOADS: Path = Path(__file__).resolve().parent.parent.parent / "storage" / "uploads"
    STORAGE_CACHE: Path = Path(__file__).resolve().parent.parent.parent / "storage" / "cache"

    # Workspace data path (parent directory / data)
    WORKSPACE_RAW_DATA: Path = Path(__file__).resolve().parent.parent.parent.parent / "data" / "raw"

    # INCOIS / Remote Data Endpoints
    INCOIS_API_URL: str = Field(
        default="https://data.incois.gov.in/api",
        description="Official INCOIS data service endpoint",
    )
    INCOIS_ERDDAP_URL: str = Field(
        default="https://erddap.incois.gov.in/erddap",
        description="INCOIS ERDDAP catalog URL",
    )
    INCOIS_BASE_URL: str = Field(
        default="https://incois.gov.in",
        description="INCOIS official portal base URL",
    )
    INCOIS_PFZ_URL: str = Field(
        default="https://incois.gov.in/portal/pfz/",
        description="INCOIS Potential Fishing Zone advisory endpoint",
    )

    # Autonomous Glider DAC configuration (IFREMER OceanGliders GDAC)
    GLIDER_ERDDAP_URL: str = Field(
        default="https://erddap.ifremer.fr/erddap",
        description="Authoritative IFREMER OceanGliders GDAC ERDDAP URL",
    )
    GLIDER_DATASET_ID: str = Field(
        default="OceanGlidersGDACTrajectories",
        description="Authoritative IFREMER OceanGliders GDAC dataset ID",
    )
    GLIDER_CACHE_TTL_SECONDS: int = Field(
        default=604800,
        description="Glider cache TTL in seconds (7 days)",
    )
    GLIDER_REQUEST_TIMEOUT: int = Field(
        default=45,
        description="Glider ERDDAP request timeout in seconds",
    )

    # Copernicus Marine Service credentials
    COPERNICUS_MARINE_USERNAME: Optional[str] = Field(
        default=None,
        description="Copernicus Marine Service username",
    )
    COPERNICUS_MARINE_PASSWORD: Optional[str] = Field(
        default=None,
        description="Copernicus Marine Service password",
    )

    # Scientific limits, caching & defaults
    MAX_OBSERVATIONS_QUERY_LIMIT: int = 10000
    STANDARD_PRESSURE_STEP: float = 10.0
    DEFAULT_CACHE_TTL_SECONDS: int = 300
    SCIENTIFIC_CACHE_TTL_SECONDS: int = 3600  # 1 hour for live/recent data
    SCIENTIFIC_FORECAST_CACHE_TTL_SECONDS: int = 21600  # 6 hours for forecast cycles

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()

# Ensure directories exist
settings.DATA_ROOT.mkdir(parents=True, exist_ok=True)
settings.RAW_DATA_ROOT.mkdir(parents=True, exist_ok=True)
settings.PROCESSED_DATA_ROOT.mkdir(parents=True, exist_ok=True)
settings.STORAGE_UPLOADS.mkdir(parents=True, exist_ok=True)
settings.STORAGE_CACHE.mkdir(parents=True, exist_ok=True)
