import time
from .client import StrimClient


class StrimFlask:
    """
    Flask extension / middleware for STRIM Labs telemetry.
    """

    def __init__(
        self,
        app=None,
        api_key: str = "",
        endpoint: str = None,
        service: str = None,
        debug: bool = False,
    ):
        self.client = StrimClient(
            api_key=api_key,
            endpoint=endpoint,
            service=service,
            debug=debug,
        )
        if app is not None:
            self.init_app(app)

    def init_app(self, app):
        @app.before_request
        def _before_request():
            import flask
            flask.g._strim_start_time = time.perf_counter()

        @app.after_request
        def _after_request(response):
            import flask
            try:
                start = getattr(flask.g, "_strim_start_time", None)
                duration_ms = (time.perf_counter() - start) * 1000.0 if start else 0.0

                req = flask.request
                path = req.path
                route = str(req.url_rule.rule) if req.url_rule else path

                self.client.record(
                    method=req.method,
                    path=path,
                    route=route,
                    status=response.status_code,
                    duration_ms=duration_ms,
                    content_length=response.content_length or 0,
                )
            except Exception:
                pass
            return response
