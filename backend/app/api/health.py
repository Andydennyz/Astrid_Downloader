from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import settings
from app.database.connection import engine
from app.services.dependency_checker import check_dependencies
from app.services.downloader import download_worker_status

router = APIRouter(tags=["health"])
logger = logging.getLogger("astrid.health")


@router.get("/health")
async def health_check() -> dict:
    database_configured = bool(settings.database_url)
    return {
        "status": "ok",
        "service": settings.app_name,
        "environment": settings.environment,
        "database_configured": database_configured,
    }


@router.get("/health/db")
async def database_health_check() -> dict:
    if engine is None:
        return {"status": "not_configured", "database": "unavailable"}

    async with engine.connect() as connection:
        await connection.execute(text("SELECT 1"))

    return {"status": "ok", "database": "reachable"}


@router.get("/health/ready")
async def readiness_check() -> dict:
    dependencies = check_dependencies().model_dump()
    worker = download_worker_status()
    database_status = "unavailable"
    if engine is not None:
        try:
            async with engine.connect() as connection:
                await connection.execute(text("SELECT 1"))
            database_status = "reachable"
        except SQLAlchemyError as exc:
            logger.error(
                "Readiness check could not reach the database",
                extra={"event": "health.database.unavailable", "error_type": type(exc).__name__},
            )

    checks = {
        "database": database_status,
        "dependencies": dependencies,
        "worker": worker,
    }
    ready = (
        database_status == "reachable"
        and all(dependencies.values())
        and worker["running"]
    )
    if not ready:
        logger.warning(
            "Backend readiness check failed",
            extra={"event": "health.readiness.failed"},
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"status": "not_ready", **checks},
        )
    return {"status": "ready", **checks}
