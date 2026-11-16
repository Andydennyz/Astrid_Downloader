from __future__ import annotations

import logging
import time
from uuid import uuid4

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

logger = logging.getLogger("astrid.http")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = str(uuid4())
        started = time.perf_counter()
        fields = {
            "event": "http.request",
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
        }
        try:
            response = await call_next(request)
        except Exception as exc:
            logger.exception(
                "HTTP request failed",
                extra={
                    **fields,
                    "event": "http.request.failed",
                    "duration_ms": round((time.perf_counter() - started) * 1000, 2),
                    "error_type": type(exc).__name__,
                },
            )
            raise

        response.headers["X-Request-ID"] = request_id
        logger.info(
            "HTTP request completed",
            extra={
                **fields,
                "status_code": response.status_code,
                "duration_ms": round((time.perf_counter() - started) * 1000, 2),
            },
        )
        return response
