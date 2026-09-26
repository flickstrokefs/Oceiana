import json
import hashlib
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional, Tuple
from app.core.config import settings
from app.core.logging import logger


class ScientificDataCache:
    """
    High-performance caching layer for oceanographic gridded fields,
    numerical model forecasts, and observational datasets.
    Supports in-memory LRU + filesystem persistence and stale-while-revalidate.
    """

    def __init__(self, cache_dir: Optional[Path] = None, max_memory_entries: int = 256):
        self.cache_dir = cache_dir or settings.STORAGE_CACHE
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.max_memory_entries = max_memory_entries
        self._memory_cache: Dict[str, Dict[str, Any]] = {}

    def build_cache_key(
        self,
        provider: str,
        dataset: str,
        region: str,
        variable: str,
        depth: float = 0.0,
        time_str: Optional[str] = None,
        resolution: str = "default",
    ) -> str:
        """Construct deterministic SHA-256 hash key for scientific parameters."""
        canonical_str = (
            f"{provider.lower().strip()}:"
            f"{dataset.lower().strip()}:"
            f"{region.lower().strip()}:"
            f"{variable.lower().strip()}:"
            f"{depth:.2f}:"
            f"{str(time_str).strip()}:"
            f"{resolution.lower().strip()}"
        )
        return hashlib.sha256(canonical_str.encode("utf-8")).hexdigest()

    def get(self, cache_key: str) -> Optional[Tuple[Any, bool, str]]:
        """
        Retrieve item from cache.
        Returns (data, is_stale, cached_at_iso) or None if missing.
        """
        now = time.time()

        # 1. Check memory cache
        if cache_key in self._memory_cache:
            entry = self._memory_cache[cache_key]
            expires_at = entry.get("expires_at", 0)
            cached_at = entry.get("cached_at", "")
            data = entry.get("data")
            is_stale = now > expires_at
            logger.info(f"Cache HIT (memory) for key {cache_key[:12]} (stale={is_stale})")
            return data, is_stale, cached_at

        # 2. Check disk cache
        disk_file = self.cache_dir / f"{cache_key}.json"
        if disk_file.exists():
            try:
                with open(disk_file, "r", encoding="utf-8") as f:
                    entry = json.load(f)
                expires_at = entry.get("expires_at", 0)
                cached_at = entry.get("cached_at", "")
                data = entry.get("data")
                is_stale = now > expires_at

                # Promote to memory
                self._put_memory(cache_key, entry)
                logger.info(f"Cache HIT (disk) for key {cache_key[:12]} (stale={is_stale})")
                return data, is_stale, cached_at
            except Exception as e:
                logger.warning(f"Failed to read disk cache {disk_file}: {e}")

        logger.info(f"Cache MISS for key {cache_key[:12]}")
        return None

    def set(
        self,
        cache_key: str,
        data: Any,
        ttl_seconds: Optional[int] = None,
    ) -> None:
        """Store dataset in memory and on disk with TTL."""
        ttl = ttl_seconds if ttl_seconds is not None else settings.SCIENTIFIC_CACHE_TTL_SECONDS
        now = time.time()
        cached_at = datetime.now(timezone.utc).isoformat()

        entry = {
            "cached_at": cached_at,
            "expires_at": now + ttl,
            "ttl": ttl,
            "data": data,
        }

        # Memory store
        self._put_memory(cache_key, entry)

        # Disk store
        disk_file = self.cache_dir / f"{cache_key}.json"
        try:
            with open(disk_file, "w", encoding="utf-8") as f:
                json.dump(entry, f)
            logger.info(f"Cached {cache_key[:12]} for {ttl}s")
        except Exception as e:
            logger.warning(f"Failed to write disk cache {disk_file}: {e}")

    def _put_memory(self, cache_key: str, entry: Dict[str, Any]) -> None:
        if len(self._memory_cache) >= self.max_memory_entries:
            # Simple eviction: pop oldest key
            oldest_key = next(iter(self._memory_cache))
            self._memory_cache.pop(oldest_key, None)
        self._memory_cache[cache_key] = entry


scientific_cache = ScientificDataCache()
