from __future__ import annotations

from collections.abc import AsyncGenerator
from datetime import datetime, timedelta, timezone
import logging
from pathlib import Path

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.database.base import Base
from app.database.models import DownloadJob, HistoryItem, LibraryItem, User
from app.services.storage import storage_root
from app.services.storage import user_storage_root

logger = logging.getLogger(__name__)


def _normalize_database_url(url: str) -> str:
    cleaned = url.strip()
    cleaned = cleaned.split("?", 1)[0]
    if cleaned.startswith("postgresql://") and "+asyncpg" not in cleaned:
        return cleaned.replace("postgresql://", "postgresql+asyncpg://", 1)
    return cleaned


resolved_database_url = settings.database_url.strip() if settings.database_url else ""
if not resolved_database_url and (settings.use_local_db or settings.environment.lower() in {"development", "local"}):
    local_storage_root = storage_root()
    local_storage_root.mkdir(parents=True, exist_ok=True)
    resolved_database_url = f"sqlite+aiosqlite:///{local_storage_root / 'dev.db'}"

if resolved_database_url:
    database_url = _normalize_database_url(resolved_database_url)
else:
    database_url = None

ssl_mode = settings.environment.lower() not in {"development", "local"}
engine = (
    create_async_engine(
        database_url,
        pool_pre_ping=True,
        echo=settings.environment == "development",
        connect_args={"ssl": ssl_mode} if database_url and database_url.startswith("postgresql+asyncpg") else {"check_same_thread": False} if database_url and database_url.startswith("sqlite+aiosqlite") else {},
    )
    if database_url
    else None
)

SessionLocal: async_sessionmaker[AsyncSession] | None = (
    async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False) if engine is not None else None
)


async def init_db() -> None:
    if engine is None:
        return
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    await cleanup_expired_guest_sessions()


async def cleanup_expired_guest_sessions() -> None:
    if SessionLocal is None:
        return

    expired_before = datetime.now(timezone.utc) - timedelta(days=7)
    async with SessionLocal() as session:
        expired_users = await session.scalars(
            select(User).where(
                User.id.like("guest-%"),
                User.created_at < expired_before,
            ).with_for_update()
        )
        for expired_user in expired_users.all():
            user_id = expired_user.id
            active_job = await session.scalar(
                select(DownloadJob.id)
                .where(
                    DownloadJob.user_id == user_id,
                    DownloadJob.status.in_(("queued", "downloading", "processing")),
                )
                .limit(1)
            )
            if active_job is not None:
                continue
            path_results = await session.execute(
                select(DownloadJob.file_path).where(
                    DownloadJob.user_id == user_id,
                    DownloadJob.file_path.is_not(None),
                )
            )
            paths = {path for (path,) in path_results.all() if path}
            for model in (LibraryItem, HistoryItem):
                result = await session.execute(
                    select(model.file_path).where(
                        model.user_id == user_id,
                        model.file_path.is_not(None),
                    )
                )
                paths.update(path for (path,) in result.all() if path)

            user_root = user_storage_root(user_id)
            cleanup_failed = False
            for raw_path in paths:
                try:
                    managed_path = Path(raw_path).resolve()
                    managed_path.relative_to(user_root)
                    managed_path.unlink(missing_ok=True)
                except (OSError, RuntimeError, ValueError):
                    logger.exception(
                        "Could not safely remove expired guest media",
                        extra={"event": "guest.session.cleanup_failed", "user_id": user_id},
                    )
                    cleanup_failed = True
                    break
            if cleanup_failed:
                continue

            for model in (DownloadJob, LibraryItem, HistoryItem):
                await session.execute(delete(model).where(model.user_id == user_id))
            await session.delete(expired_user)
        await session.commit()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    if SessionLocal is None:
        raise RuntimeError("Database is not configured. Set DATABASE_URL in your environment.")

    async with SessionLocal() as session:
        yield session
