from __future__ import annotations

import logging
import math
import time
from collections import defaultdict
from typing import Any

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse, Response

from app.core.config import settings

logger = logging.getLogger("astrid.rate_limit")


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: Any, requests_per_minute: int | None = None):
        super().__init__(app)
        self.requests_per_minute = (
            settings.max_rate_requests_per_minute
            if requests_per_minute is None
            else requests_per_minute
        )
        if self.requests_per_minute < 1:
            raise ValueError("requests_per_minute must be greater than zero.")
        self.window = 60
        self.requests: defaultdict[str, list[float]] = defaultdict(list)
        self._last_cleanup = 0.0

    async def dispatch(self, request: Request, call_next) -> Response:
        client_key = request.client.host if request.client else "unknown"
        now = time.monotonic()
        if now - self._last_cleanup >= self.window:
            for key, timestamps in list(self.requests.items()):
                active = [timestamp for timestamp in timestamps if now - timestamp < self.window]
                if active:
                    self.requests[key] = active
                else:
                    del self.requests[key]
            self._last_cleanup = now

        bucket = self.requests[client_key]
        bucket[:] = [ts for ts in bucket if now - ts < self.window]

        if len(bucket) >= self.requests_per_minute:
            retry_after = max(1, math.ceil(self.window - (now - bucket[0])))
            logger.warning(
                "Rate limit exceeded",
                extra={
                    "event": "rate_limit.exceeded",
                    "method": request.method,
                    "path": request.url.path,
                },
            )
            return JSONResponse(
                status_code=429,
                content={"detail": "Rate limit exceeded. Please try again later."},
                headers={"Retry-After": str(retry_after)},
            )

        bucket.append(now)
        return await call_next(request)
