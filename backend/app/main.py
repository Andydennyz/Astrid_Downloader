from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import SQLAlchemyError

from app.api.auth import router as auth_router
from app.api.health import router as health_router
from app.api.media import router as media_router
from app.core.config import settings
from app.core.logging_config import configure_logging
from app.database.connection import cleanup_expired_guest_sessions, init_db
from app.middleware.rate_limit import RateLimitMiddleware
from app.middleware.request_logging import RequestLoggingMiddleware
from app.services.downloader import start_download_worker, stop_download_worker

configure_logging()
logger = logging.getLogger(__name__)


async def _cleanup_expired_guest_sessions_periodically() -> None:
    while True:
        await asyncio.sleep(3600)
        try:
            await cleanup_expired_guest_sessions()
        except SQLAlchemyError:
            logger.exception(
                "Could not clean expired guest sessions",
                extra={"event": "guest.session.cleanup_failed"},
            )


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await start_download_worker()
    cleanup_task = asyncio.create_task(_cleanup_expired_guest_sessions_periodically())
    try:
        yield
    finally:
        cleanup_task.cancel()
        try:
            await cleanup_task
        except asyncio.CancelledError:
            pass
        await stop_download_worker()


app = FastAPI(
    title="Astrid Downloader API",
    description="Public API for the Astrid Downloader backend.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.frontend_url,
        "https://localhost",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(RequestLoggingMiddleware)
app.include_router(health_router, prefix=settings.api_v1_prefix)
app.include_router(auth_router, prefix=settings.api_v1_prefix)
app.include_router(media_router, prefix=settings.api_v1_prefix)


@app.get("/")
async def root() -> dict:
    return {
        "service": settings.app_name,
        "environment": settings.environment,
        "message": "Astrid Downloader backend is running.",
    }
