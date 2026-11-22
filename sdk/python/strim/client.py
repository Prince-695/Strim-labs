import json
import os
import threading
import time
import urllib.error
import urllib.request
from typing import Any, Dict, List, Optional


class StrimClient:
    def __init__(
        self,
        api_key: str,
        endpoint: Optional[str] = None,
        service: Optional[str] = None,
        batch_size: int = 50,
        flush_interval_seconds: float = 2.0,
        debug: bool = False,
    ):
        self.api_key = api_key or os.getenv("STRIM_API_KEY", "")
        self.endpoint = (endpoint or os.getenv("STRIM_ENDPOINT") or "https://api.strimlabs.com").rstrip("/")
        self.service = service or os.getenv("STRIM_SERVICE") or "api"
        self.batch_size = max(1, batch_size)
        self.flush_interval = max(0.5, flush_interval_seconds)
        self.debug = debug

        self._lock = threading.Lock()
        self._buffer: List[Dict[str, Any]] = []
        self._running = True
        self._thread = threading.Thread(target=self._worker_loop, daemon=True)
        self._thread.start()

    def record(
        self,
        method: str,
        path: str,
        status: int,
        duration_ms: float,
        route: Optional[str] = None,
        content_length: int = 0,
    ) -> None:
        if not self.api_key:
            return

        event = {
            "ts": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()),
            "method": method.upper(),
            "path": path,
            "route": route or path,
            "status": status,
            "duration_ms": round(max(0.1, duration_ms), 2),
            "bytes": max(0, content_length),
            "error": status >= 400 or status == 0,
        }

        with self._lock:
            self._buffer.append(event)
            should_flush = len(self._buffer) >= self.batch_size

        if should_flush:
            threading.Thread(target=self.flush, daemon=True).start()

    def flush(self) -> None:
        with self._lock:
            if not self._buffer or not self.api_key:
                return
            batch = self._buffer[: self.batch_size]
            del self._buffer[: self.batch_size]

        try:
            url = f"{self.endpoint}/v1/ingest/events"
            payload = json.dumps({"service": self.service, "events": batch}).encode("utf-8")
            req = urllib.request.Request(
                url,
                data=payload,
                headers={
                    "Content-Type": "application/json",
                    "X-API-Key": self.api_key,
                },
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=5) as resp:
                if self.debug and resp.status >= 300:
                    print(f"[STRIM Labs] Ingest response status: {resp.status}")
        except Exception as err:
            if self.debug:
                print(f"[STRIM Labs] Telemetry delivery failed: {err}")
            # Telemetry collection must never raise to crash the application

    def _worker_loop(self) -> None:
        while self._running:
            time.sleep(self.flush_interval)
            self.flush()

    def close(self) -> None:
        self._running = False
        self.flush()
