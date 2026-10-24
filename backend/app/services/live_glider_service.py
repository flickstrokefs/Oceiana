"""
Live Physical Glider Ingestion & In-Memory State Service
=========================================================
Stores and manages live telemetry streaming from physical ocean gliders (e.g. COM3).

NOTE:
Uses in-memory storage for local development.
Accumulated history resets when the backend server process restarts.
"""

from collections import deque
import datetime
import threading
from typing import Any, Dict, List, Optional
from app.schemas.glider import LiveGliderPayload, LiveGliderStatusResponse


class LiveGliderService:
    """Thread-safe in-memory store for physical glider live telemetry."""

    def __init__(self, history_limit: int = 200):
        self._lock = threading.Lock()
        self._history_limit = history_limit
        self._latest: Optional[LiveGliderPayload] = None
        self._history: deque[LiveGliderPayload] = deque(maxlen=history_limit)
        self._device_warnings: deque[str] = deque(maxlen=50)
        self._ds18b20_fallback_active: bool = False
        self._total_received: int = 0
        self._last_received_utc: Optional[datetime.datetime] = None
        self._default_glider_id: str = "GLIDER-PHYSICAL-COM3"

    def ingest_telemetry(self, payload: LiveGliderPayload) -> LiveGliderStatusResponse:
        """Ingest a new live observation from the glider port reader."""
        now = datetime.datetime.now(datetime.timezone.utc)
        with self._lock:
            self._latest = payload
            self._history.appendleft(payload)
            self._total_received += 1
            self._last_received_utc = now

            if payload.ds18b20_fallback_active:
                self._ds18b20_fallback_active = True

            if payload.warnings:
                for w in payload.warnings:
                    if w not in self._device_warnings:
                        self._device_warnings.appendleft(w)

        return self.get_status()

    def get_status(self) -> LiveGliderStatusResponse:
        """Return the current connectivity status and latest observation."""
        with self._lock:
            if self._last_received_utc is None:
                return LiveGliderStatusResponse(
                    status="DISCONNECTED",
                    is_online=False,
                    glider_id=self._default_glider_id,
                    latest=None,
                    last_received_at=None,
                    seconds_since_last_update=None,
                    ds18b20_fallback_active=self._ds18b20_fallback_active,
                    active_warnings=list(self._device_warnings),
                    total_observations_received=self._total_received,
                )

            now = datetime.datetime.now(datetime.timezone.utc)
            delta = (now - self._last_received_utc).total_seconds()

            # Online if data arrived in the last 15 seconds
            if delta <= 15.0:
                status = "ONLINE"
                is_online = True
            elif delta <= 60.0:
                status = "STALE"
                is_online = False
            else:
                status = "DISCONNECTED"
                is_online = False

            glider_id = self._latest.glider_id if self._latest else self._default_glider_id

            return LiveGliderStatusResponse(
                status=status,
                is_online=is_online,
                glider_id=glider_id,
                latest=self._latest,
                last_received_at=self._last_received_utc.isoformat(),
                seconds_since_last_update=round(delta, 1),
                ds18b20_fallback_active=self._ds18b20_fallback_active,
                active_warnings=list(self._device_warnings),
                total_observations_received=self._total_received,
            )

    def get_history(self, limit: int = 50) -> List[LiveGliderPayload]:
        """Return bounded observation history."""
        with self._lock:
            return list(self._history)[:limit]


# Global singleton instance
live_glider_service = LiveGliderService()
