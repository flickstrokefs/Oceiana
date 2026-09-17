from pathlib import Path
from typing import List
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Production application settings with environment variable support."""

    APP_NAME: str = "Ariel Ocean Data API"
    APP_VERSION: str = "2.0.0"
    ENVIRONMENT: str = "production"
    DEBUG: bool = False

    # Network / Server
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    API_BASE_PATH: str = "/api"
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
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

    # INCOIS / Remote Data Endpoints (optional adapters)
    INCOIS_API_URL: str = Field(
        default="https://data.incois.gov.in/api",
        description="Official INCOIS data service endpoint",
    )
    INCOIS_ERDDAP_URL: str = Field(
        default="https://erddap.incois.gov.in/erddap",
        description="INCOIS ERDDAP catalog URL",
    )

    # Autonomous Glider DAC configuration (IOOS National Glider DAC)
    GLIDER_ERDDAP_URL: str = Field(
        default="https://gliders.ioos.us/erddap",
        description="Authoritative IOOS Glider DAC ERDDAP URL",
    )
    GLIDER_DATASETS: List[str] = Field(
        default=[
            "ru29-20180812T0220",
            "amlr01-20191206T0452-delayed",
            "amlr02-20191206T1236-delayed",
            "amlr03-20191206T0529-delayed",
            "gs_565-20151220T1746-delayed",
        ],
        description="Real glider datasets in authorized regions (Bay of Bengal & Southern Ocean)",
    )
    GLIDER_CACHE_TTL_SECONDS: int = Field(
        default=86400,
        description="Glider cache TTL in seconds",
    )
    GLIDER_REQUEST_TIMEOUT: int = Field(
        default=30,
        description="Glider ERDDAP request timeout in seconds",
    )

    # Scientific limits & defaults
    MAX_OBSERVATIONS_QUERY_LIMIT: int = 10000
    STANDARD_PRESSURE_STEP: float = 10.0
    DEFAULT_CACHE_TTL_SECONDS: int = 300

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
