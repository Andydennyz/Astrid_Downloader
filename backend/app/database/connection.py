from __future__ import annotations

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.database.base import Base
from app.services.storage import storage_root


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


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    if SessionLocal is None:
        raise RuntimeError("Database is not configured. Set DATABASE_URL in your environment.")

    async with SessionLocal() as session:
        yield session
