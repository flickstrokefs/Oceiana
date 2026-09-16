import time
from typing import Any, Dict, Optional
import hashlib
import json


class SimpleMemoryCache:
    """Thread-safe LRU/TTL in-memory cache for fast spatial slices and dataset metadata."""

    def __init__(self, default_ttl_seconds: int = 300, max_items: int = 500):
        self.default_ttl = default_ttl_seconds
        self.max_items = max_items
        self._store: Dict[str, Dict[str, Any]] = {}

    @staticmethod
    def make_key(prefix: str, **kwargs) -> str:
        """Create deterministic SHA256 cache key from keyword arguments."""
        clean_kwargs = {k: v for k, v in sorted(kwargs.items()) if v is not None}
        raw_str = f"{prefix}:" + json.dumps(clean_kwargs, sort_keys=True, default=str)
        return hashlib.sha256(raw_str.encode("utf-8")).hexdigest()

    def get(self, key: str) -> Optional[Any]:
        """Retrieve item if exists and not expired."""
        record = self._store.get(key)
        if not record:
            return None
        if time.time() > record["expires_at"]:
            del self._store[key]
            return None
        return record["value"]

    def set(self, key: str, value: Any, ttl_seconds: Optional[int] = None) -> None:
        """Store item with TTL expiration."""
        ttl = ttl_seconds if ttl_seconds is not None else self.default_ttl
        if len(self._store) >= self.max_items:
            # Evict oldest 20%
            keys_to_evict = list(self._store.keys())[: max(1, self.max_items // 5)]
            for k in keys_to_evict:
                self._store.pop(k, None)

        self._store[key] = {
            "value": value,
            "expires_at": time.time() + ttl,
        }

    def clear(self) -> None:
        """Wipe entire cache."""
        self._store.clear()


cache = SimpleMemoryCache()
