"""
app.data.cache_utils — Shared cache helpers for all data fetchers.

Every fetcher stores:
  data/cache/<source>/<hash>.nc   (or .json / .csv)
  data/cache/manifests/<source>_<hash>.json  (provenance record)

The manifest JSON schema:
  {
    "source":      str,          # e.g. "Ifremer ERDDAP"
    "doi_or_url":  str,
    "retrieved_at": ISO8601,
    "bbox":        [lon_min, lat_min, lon_max, lat_max],
    "time_range":  [start_ISO, end_ISO],
    "n_records":   int,
    "cache_file":  str,          # relative to backend/
    "provenance":  "REAL"        # always REAL for raw fetches
  }
"""

from __future__ import annotations

import hashlib
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger("ariel.data.cache")

# Root of data cache (relative to backend/ directory)
CACHE_ROOT = Path(__file__).parent.parent.parent / "data" / "cache"
MANIFEST_DIR = CACHE_ROOT / "manifests"


def _ensure_dirs() -> None:
    CACHE_ROOT.mkdir(parents=True, exist_ok=True)
    MANIFEST_DIR.mkdir(parents=True, exist_ok=True)


def make_cache_key(source: str, **kwargs: Any) -> str:
    """Stable hash for a set of fetch parameters."""
    canonical = json.dumps({k: str(v) for k, v in sorted(kwargs.items())}, sort_keys=True)
    h = hashlib.sha256(f"{source}:{canonical}".encode()).hexdigest()[:16]
    return h


def manifest_path(source_tag: str, cache_key: str) -> Path:
    _ensure_dirs()
    return MANIFEST_DIR / f"{source_tag}_{cache_key}.json"


def data_path(subdir: str, cache_key: str, suffix: str = ".nc") -> Path:
    _ensure_dirs()
    d = CACHE_ROOT / subdir
    d.mkdir(parents=True, exist_ok=True)
    return d / f"{cache_key}{suffix}"


def write_manifest(
    source_tag: str,
    cache_key: str,
    source: str,
    doi_or_url: str,
    bbox: list[float],
    time_range: list[str],
    n_records: int,
    cache_file: Path,
    extra: Optional[dict[str, Any]] = None,
) -> Path:
    """Write a provenance manifest and return its path."""
    _ensure_dirs()
    manifest = {
        "source": source,
        "doi_or_url": doi_or_url,
        "retrieved_at": datetime.now(timezone.utc).isoformat(),
        "bbox": bbox,
        "time_range": time_range,
        "n_records": n_records,
        "cache_file": str(cache_file),
        "provenance": "REAL",
    }
    if extra:
        manifest.update(extra)
    mp = manifest_path(source_tag, cache_key)
    mp.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    logger.info(f"Manifest written: {mp.name} (n={n_records}, source={source})")
    return mp


def read_manifest(source_tag: str, cache_key: str) -> Optional[dict[str, Any]]:
    mp = manifest_path(source_tag, cache_key)
    if mp.exists():
        try:
            return json.loads(mp.read_text(encoding="utf-8"))
        except Exception as e:
            logger.warning(f"Could not read manifest {mp}: {e}")
    return None


def cache_exists(subdir: str, cache_key: str, suffix: str = ".nc") -> bool:
    return data_path(subdir, cache_key, suffix).exists()
