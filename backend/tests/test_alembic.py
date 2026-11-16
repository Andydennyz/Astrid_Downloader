import os
from pathlib import Path
import subprocess
import sys

from alembic.config import Config
from sqlalchemy import create_engine, inspect, text

from app.database.migrations import sync_database_url

BACKEND_ROOT = Path(__file__).resolve().parents[1]


def test_alembic_config_preserves_percent_encoded_database_password() -> None:
    database_url = "postgresql://user:encoded%40password@example.com:5432/database"
    config = Config()

    sync_url = sync_database_url(database_url).replace("%", "%%")
    config.set_main_option("sqlalchemy.url", sync_url)

    assert config.get_main_option("sqlalchemy.url") == (
        "postgresql+psycopg://user:encoded%40password@example.com:5432/database"
    )


def test_alembic_uses_installed_psycopg3_driver_for_async_postgres_url() -> None:
    database_url = "postgresql+asyncpg://user:encoded%40password@example.com:5432/database"

    sync_url = sync_database_url(database_url)

    assert sync_url == "postgresql+psycopg://user:encoded%40password@example.com:5432/database"


def test_alembic_uses_psycopg3_for_plain_postgres_url() -> None:
    database_url = "postgresql://user:encoded%40password@example.com:5432/database"

    sync_url = sync_database_url(database_url)

    assert sync_url == "postgresql+psycopg://user:encoded%40password@example.com:5432/database"


def test_alembic_normalizes_legacy_postgres_scheme() -> None:
    database_url = "postgres://user:password@example.com:5432/database"

    assert sync_database_url(database_url) == (
        "postgresql+psycopg://user:password@example.com:5432/database"
    )


def test_alembic_can_construct_sync_engine_with_psycopg3() -> None:
    from sqlalchemy import create_engine

    engine = create_engine(
        sync_database_url("postgresql://user:encoded%40password@example.com:5432/database")
    )

    assert engine.dialect.name == "postgresql"
    assert engine.dialect.driver == "psycopg"
    engine.dispose()


def test_alembic_translates_async_sqlite_driver() -> None:
    assert sync_database_url("sqlite+aiosqlite:///storage/dev.db") == (
        "sqlite:///storage/dev.db"
    )


def _run_migration(database_file: Path, revision: str) -> None:
    environment = os.environ.copy()
    environment["DATABASE_URL"] = f"sqlite+aiosqlite:///{database_file}"
    environment["ENVIRONMENT"] = "development"
    result = subprocess.run(
        [
            sys.executable,
            "-m",
            "alembic",
            "upgrade",
            revision,
        ],
        cwd=BACKEND_ROOT,
        env=environment,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr


def test_fresh_database_migrates_to_head(tmp_path: Path) -> None:
    database_file = tmp_path / "fresh.db"

    _run_migration(database_file, "head")

    engine = create_engine(f"sqlite:///{database_file}")
    assert inspect(engine).has_table("users")
    assert "attempt_count" in {
        column["name"] for column in inspect(engine).get_columns("download_jobs")
    }
    engine.dispose()


def test_existing_app_schema_is_adopted_and_migrated_without_dropping_data(
    tmp_path: Path,
) -> None:
    database_file = tmp_path / "existing.db"
    _run_migration(database_file, "a47a1ba5bc0b")

    engine = create_engine(f"sqlite:///{database_file}")
    with engine.begin() as connection:
        connection.execute(text("INSERT INTO users (id, email, created_at) VALUES ('user-1', NULL, CURRENT_TIMESTAMP)"))
        connection.execute(text("DROP TABLE alembic_version"))
    engine.dispose()

    _run_migration(database_file, "head")

    engine = create_engine(f"sqlite:///{database_file}")
    inspector = inspect(engine)
    assert "attempt_count" in {
        column["name"] for column in inspector.get_columns("download_jobs")
    }
    with engine.connect() as connection:
        assert connection.scalar(text("SELECT id FROM users")) == "user-1"
        assert connection.scalar(text("SELECT version_num FROM alembic_version")) == (
            "b6c01d7491a2"
        )
    engine.dispose()
