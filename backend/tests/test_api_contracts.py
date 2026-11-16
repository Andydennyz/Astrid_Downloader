from __future__ import annotations

import asyncio
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.api import media as media_api
from app.core.security import AuthUser, get_current_user
from app.database.base import Base
from app.database.connection import get_db
from app.database.models import DownloadJob, HistoryItem, LibraryItem, User
from app.main import app
from app.schemas.media import MediaAnalyzeRequest
from app.services.storage import user_storage_root


@pytest.fixture
def api_client(tmp_path: Path) -> Iterator[tuple[TestClient, async_sessionmaker, dict[str, str]]]:
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'api.db'}")
    asyncio.run(_create_schema(engine))
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    auth = {"user_id": "user-1"}
    previous_overrides = app.dependency_overrides.copy()

    async def override_current_user() -> AuthUser:
        return AuthUser(user_id=auth["user_id"], email=None)

    async def override_get_db():
        async with sessions() as session:
            yield session

    app.dependency_overrides[get_current_user] = override_current_user
    app.dependency_overrides[get_db] = override_get_db
    try:
        yield TestClient(app), sessions, auth
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous_overrides)
        asyncio.run(engine.dispose())


async def _create_schema(engine) -> None:
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)


def test_routes_require_authentication(api_client) -> None:
    client, _, _ = api_client
    app.dependency_overrides.pop(get_current_user)

    response = client.get("/api/v1/downloads")

    assert response.status_code == 401
    assert response.json()["detail"] == "Missing bearer token."


def test_missing_and_foreign_items_return_not_found(api_client) -> None:
    client, sessions, _ = api_client

    async def seed() -> None:
        async with sessions() as session:
            session.add_all(
                [
                    User(id="user-1"),
                    User(id="user-2"),
                    DownloadJob(
                        id="foreign-job",
                        user_id="user-2",
                        source_url="https://example.com/media",
                        title="Foreign",
                        creator="Creator",
                        duration_sec=10,
                        destination="",
                    ),
                    LibraryItem(
                        id="foreign-library",
                        user_id="user-2",
                        title="Foreign",
                        creator="Creator",
                        filename="foreign.mp4",
                        source_url="https://example.com/media",
                        file_path=str(Path("foreign.mp4")),
                        kind="video",
                        extension="mp4",
                        quality_label="best",
                    ),
                    HistoryItem(
                        id="foreign-history",
                        user_id="user-2",
                        title="Foreign",
                        creator="Creator",
                        source_url="https://example.com/media",
                        kind="video",
                        status="completed",
                        extension="mp4",
                        quality_label="best",
                    ),
                ]
            )
            await session.commit()

    asyncio.run(seed())
    paths = [
        "/api/v1/downloads/missing",
        "/api/v1/downloads/foreign-job",
        "/api/v1/library/foreign-library",
        "/api/v1/history/foreign-history",
    ]

    assert client.get(paths[0]).status_code == 404
    for path in paths[1:]:
        assert client.delete(path).status_code == 404


def test_library_filters_are_applied_with_user_scoping(api_client) -> None:
    client, sessions, _ = api_client

    async def seed() -> None:
        async with sessions() as session:
            session.add_all(
                [
                    User(id="user-1"),
                    User(id="user-2"),
                    LibraryItem(
                        id="video-1",
                        user_id="user-1",
                        title="Sunrise",
                        creator="Alice",
                        filename="sunrise.mp4",
                        source_url="https://example.com/sunrise",
                        file_path="video-1.mp4",
                        kind="video",
                        extension="mp4",
                        quality_label="1080p",
                    ),
                    LibraryItem(
                        id="audio-1",
                        user_id="user-1",
                        title="Sunrise song",
                        creator="Alice",
                        filename="sunrise.m4a",
                        source_url="https://example.com/song",
                        file_path="audio-1.m4a",
                        kind="audio",
                        extension="m4a",
                        quality_label="best",
                    ),
                    LibraryItem(
                        id="foreign-1",
                        user_id="user-2",
                        title="Sunrise",
                        creator="Alice",
                        filename="foreign.mp4",
                        source_url="https://example.com/foreign",
                        file_path="foreign.mp4",
                        kind="video",
                        extension="mp4",
                        quality_label="best",
                    ),
                ]
            )
            await session.commit()

    asyncio.run(seed())

    response = client.get("/api/v1/library", params={"kind": "video", "search": "sunrise"})

    assert response.status_code == 200
    assert [item["id"] for item in response.json()] == ["video-1"]
    assert client.get("/api/v1/library", params={"kind": "invalid"}).status_code == 422


def test_open_session_streams_owned_media_with_range_support(api_client, tmp_path: Path, monkeypatch) -> None:
    client, sessions, auth = api_client
    monkeypatch.setattr(media_api.settings, "storage_path", str(tmp_path / "storage"))
    file_path = user_storage_root("user-1") / "clip.mp4"
    file_path.parent.mkdir(parents=True)
    file_path.write_bytes(b"video-content")

    async def seed() -> None:
        async with sessions() as session:
            session.add_all(
                [
                    User(id="user-1"),
                    User(id="user-2"),
                    LibraryItem(
                        id="video-1",
                        user_id="user-1",
                        title="Clip",
                        creator="Creator",
                        filename=file_path.name,
                        source_url="https://example.com/clip",
                        file_path=str(file_path),
                        kind="video",
                        extension="mp4",
                        quality_label="720p",
                    ),
                ]
            )
            await session.commit()

    asyncio.run(seed())

    session_response = client.post("/api/v1/files/open-session", json={"path": str(file_path)})
    assert session_response.status_code == 200
    ticket = session_response.json()["ticket"]
    assert client.get("/api/v1/files/open/not-a-ticket").status_code == 404

    stream_response = client.get(f"/api/v1/files/open/{ticket}")
    assert stream_response.status_code == 200
    assert stream_response.headers["content-type"] == "video/mp4"
    assert stream_response.headers["content-disposition"].startswith("inline;")
    assert stream_response.content == b"video-content"

    range_response = client.get(
        f"/api/v1/files/open/{ticket}",
        headers={"Range": "bytes=0-4"},
    )
    assert range_response.status_code == 206
    assert range_response.content == b"video"

    download_session = client.post("/api/v1/files/download-session", json={"path": str(file_path)})
    assert download_session.status_code == 200
    download_ticket = download_session.json()["ticket"]
    download_response = client.get(f"/api/v1/files/open/{download_ticket}")
    assert download_response.status_code == 200
    assert download_response.headers["content-disposition"].startswith("attachment;")

    auth["user_id"] = "user-2"
    assert client.post("/api/v1/files/open-session", json={"path": str(file_path)}).status_code == 404


def test_formats_cache_is_user_scoped_and_invalid_media_urls_are_rejected(api_client) -> None:
    client, _, _ = api_client
    media_api._MEDIA_CACHE[("user-2", "cached-media")] = {"formats": [{"formatId": "1"}]}
    try:
        assert client.get("/api/v1/media/cached-media/formats").status_code == 404
        media_api._MEDIA_CACHE[("user-1", "cached-media")] = {"formats": [{"formatId": "1"}]}
        assert client.get("/api/v1/media/cached-media/formats").json() == [{"formatId": "1"}]
        assert client.post(
            "/api/v1/media/analyze",
            json={"url": " ftp://example.com/media "},
        ).status_code == 422
        assert client.get(
            "/api/v1/media/validate",
            params={"url": " ftp://example.com/media "},
        ).status_code == 422
        assert MediaAnalyzeRequest(url=" https://example.com/media ").url == "https://example.com/media"
    finally:
        media_api._MEDIA_CACHE.pop(("user-1", "cached-media"), None)
        media_api._MEDIA_CACHE.pop(("user-2", "cached-media"), None)
