import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

# Load .env from repo root so CMEMS credentials are available to pytest
try:
    from dotenv import load_dotenv
    _env_file = backend_dir.parent / ".env"
    if _env_file.exists():
        load_dotenv(_env_file, override=False)
except ImportError:
    pass  # python-dotenv not installed — env vars must be set manually
