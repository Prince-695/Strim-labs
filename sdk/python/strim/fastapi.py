import time
from typing import Any, Callable
from .client import StrimClient


class StrimFastAPIMiddleware:
    """
    ASGI middleware for FastAPI and Starlette.
    Captures request method, path, status, and execution duration.
    """

    def __init__(
        self,
        app: Any,
        api_key: str,
        endpoint: str = None,
        service: str = None,
        debug: bool = False,
    ):
        self.app = app
        self.client = StrimClient(
            api_key=api_key,
            endpoint=endpoint,
            service=service,
            debug=debug,
        )

    async def __call__(self, scope: dict, receive: Callable, send: Callable) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        method = scope.get("method", "GET")
        raw_path = scope.get("path", "/")
        start_time = time.perf_counter()
        status_code = [200]
        content_length = [0]

        async def send_wrapper(message: dict) -> None:
            if message["type"] == "http.response.start":
                status_code[0] = message.get("status", 200)
                for header_name, header_val in message.get("headers", []):
                    if header_name.lower() == b"content-length":
                        try:
                            content_length[0] = int(header_val.decode("latin1"))
                        except Exception:
                            pass
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            elapsed_ms = (time.perf_counter() - start_time) * 1000.0

            # Extract route path template if starlette endpoint matched
            route = raw_path
            endpoint_obj = scope.get("endpoint")
            if endpoint_obj and hasattr(endpoint_obj, "__name__"):
                route = getattr(scope.get("route", {}), "path", raw_path)

            self.client.record(
                method=method,
                path=raw_path,
                route=route,
                status=status_code[0],
                duration_ms=elapsed_ms,
                content_length=content_length[0],
            )
