from __future__ import annotations

import asyncio
import hashlib
from collections.abc import Iterator
from pathlib import Path
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.api import media as media_api
from app.core.security import AuthUser, get_current_user_or_guest
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

    app.dependency_overrides[get_current_user_or_guest] = override_current_user
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


def test_routes_require_a_bearer_or_guest_token(api_client) -> None:
    client, _, _ = api_client
    app.dependency_overrides.pop(get_current_user_or_guest)

    response = client.get("/api/v1/downloads")

    assert response.status_code == 401
    assert response.json()["detail"] == "A bearer token or guest token is required."


def test_guest_can_download_and_only_access_jobs_from_its_browser(
    api_client, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    client, _, _ = api_client
    app.dependency_overrides.pop(get_current_user_or_guest)
    guest_token = str(uuid4())
    monkeypatch.setattr(media_api.settings, "storage_path", str(tmp_path / "storage"))
    monkeypatch.setattr(media_api.settings, "storage_quota_bytes", 0)

    async def skip_queue(job_id: str) -> None:
        return None

    monkeypatch.setattr(media_api, "queue_download_job", skip_queue)
    payload = {
        "sourceUrl": "https://www.youtube.com/watch?v=guest-video",
        "title": "Guest download",
        "creator": "Creator",
        "thumbnailUrl": "",
        "durationSec": 10,
        "destination": "",
        "selection": {"mode": "video"},
    }

    response = client.post(
        "/api/v1/downloads",
        headers={"X-Guest-Token": guest_token},
        json=payload,
    )

    assert response.status_code == 200
    job_id = response.json()["id"]
    own_jobs = client.get(
        "/api/v1/downloads",
        headers={"X-Guest-Token": guest_token},
    )
    other_jobs = client.get(
        "/api/v1/downloads",
        headers={"X-Guest-Token": str(uuid4())},
    )
    assert [job["id"] for job in own_jobs.json()] == [job_id]
    assert other_jobs.json() == []


def test_guest_download_rejects_unsupported_source_hosts(api_client) -> None:
    client, _, _ = api_client
    app.dependency_overrides.pop(get_current_user_or_guest)
    payload = {
        "sourceUrl": "https://example.com/media",
        "title": "External URL",
        "creator": "Creator",
        "thumbnailUrl": "",
        "durationSec": 10,
        "destination": "",
        "selection": {"mode": "video"},
    }

    response = client.post(
        "/api/v1/downloads",
        headers={"X-Guest-Token": str(uuid4())},
        json=payload,
    )

    assert response.status_code == 403
    assert "Guest downloads support" in response.json()["detail"]


@pytest.mark.parametrize(
    "url",
    [
        "https://www.facebook.com/watch/?v=123456789",
        "https://fb.watch/abc123/",
        "https://www.instagram.com/reel/abc123/",
        "https://www.pinterest.com/pin/123456789/",
        "https://pin.it/abc123",
        "https://www.tiktok.com/@creator/video/123456789",
        "https://x.com/creator/status/123456789",
        "https://www.reddit.com/r/videos/comments/abc123/",
        "https://www.dailymotion.com/video/x123abc",
    ],
)
def test_guest_download_accepts_common_social_site_hosts(url: str) -> None:
    media_api._validate_guest_media_url(
        AuthUser(user_id="guest-test", role="guest"),
        url,
    )


def test_guest_route_rejects_malformed_guest_token(api_client) -> None:
    client, _, _ = api_client
    app.dependency_overrides.pop(get_current_user_or_guest)

    response = client.get(
        "/api/v1/downloads",
        headers={"X-Guest-Token": "not-a-uuid"},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Guest token is invalid."


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


def test_saving_completed_media_to_device_removes_the_server_copy_but_keeps_metadata(
    api_client, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    client, sessions, _ = api_client
    monkeypatch.setattr(media_api.settings, "storage_path", str(tmp_path / "storage"))
    file_path = user_storage_root("user-1") / "Downloads" / "clip.mp4"
    file_path.parent.mkdir(parents=True)
    file_path.write_bytes(b"completed media")

    async def seed() -> None:
        async with sessions() as session:
            session.add(User(id="user-1"))
            session.add(
                DownloadJob(
                    id="job-1",
                    user_id="user-1",
                    source_url="https://example.com/clip",
                    title="Clip",
                    creator="Creator",
                    duration_sec=10,
                    destination="Downloads",
                    status="completed",
                    extension="mp4",
                    kind="video",
                    quality_label="1080p",
                    file_path=str(file_path),
                )
            )
            session.add(
                LibraryItem(
                    id="lib_job-1",
                    user_id="user-1",
                    title="Clip",
                    creator="Creator",
                    filename=file_path.name,
                    source_url="https://example.com/clip",
                    file_path=str(file_path),
                    kind="video",
                    extension="mp4",
                    quality_label="1080p",
                    size_bytes=16,
                )
            )
            session.add(
                HistoryItem(
                    id="hist_job-1",
                    user_id="user-1",
                    title="Clip",
                    creator="Creator",
                    source_url="https://example.com/clip",
                    kind="video",
                    status="completed",
                    extension="mp4",
                    quality_label="1080p",
                    size_bytes=16,
                    file_path=str(file_path),
                )
            )
            await session.commit()

    asyncio.run(seed())

    response = client.post(
        "/api/v1/downloads/job-1/device-saved",
        json={"filename": "Video/clip.mp4"},
    )

    assert response.status_code == 200
    assert not file_path.exists()
    library = client.get("/api/v1/library").json()[0]
    history = client.get("/api/v1/history").json()[0]
    assert library["filePath"] is None
    assert library["filename"] == "Video/clip.mp4"
    assert history["filePath"] is None
    assert history["libraryId"] == "lib_job-1"
    assert history["filename"] == "Video/clip.mp4"

    async def assert_paths_cleared() -> None:
        async with sessions() as session:
            job = await session.get(DownloadJob, "job-1")
            item = await session.get(LibraryItem, "lib_job-1")
            assert job is not None and job.file_path is None
            assert item is not None and item.file_path == ""

    asyncio.run(assert_paths_cleared())


def test_deleting_completed_history_removes_linked_media_and_server_file(
    api_client, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    client, sessions, _ = api_client
    monkeypatch.setattr(media_api.settings, "storage_path", str(tmp_path / "storage"))
    file_path = user_storage_root("user-1") / "Downloads" / "clip.mp4"
    file_path.parent.mkdir(parents=True)
    file_path.write_bytes(b"completed media")

    async def seed() -> None:
        async with sessions() as session:
            session.add(User(id="user-1"))
            session.add(
                DownloadJob(
                    id="job-1",
                    user_id="user-1",
                    source_url="https://example.com/clip",
                    title="Clip",
                    creator="Creator",
                    duration_sec=10,
                    destination="Downloads",
                    status="completed",
                    extension="mp4",
                    kind="video",
                    quality_label="1080p",
                    file_path=str(file_path),
                )
            )
            session.add(
                LibraryItem(
                    id="lib_job-1",
                    user_id="user-1",
                    title="Clip",
                    creator="Creator",
                    filename=file_path.name,
                    source_url="https://example.com/clip",
                    file_path=str(file_path),
                    kind="video",
                    extension="mp4",
                    quality_label="1080p",
                    size_bytes=16,
                )
            )
            session.add(
                HistoryItem(
                    id="hist_job-1",
                    user_id="user-1",
                    title="Clip",
                    creator="Creator",
                    source_url="https://example.com/clip",
                    kind="video",
                    status="completed",
                    extension="mp4",
                    quality_label="1080p",
                    size_bytes=16,
                    file_path=str(file_path),
                )
            )
            await session.commit()

    asyncio.run(seed())

    response = client.delete("/api/v1/history/hist_job-1")

    assert response.status_code == 200
    assert not file_path.exists()
    assert client.get("/api/v1/library").json() == []
    assert client.get("/api/v1/history").json() == []


def test_guest_session_cleanup_removes_temporary_records_and_backend_files(
    api_client, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    client, sessions, _ = api_client
    app.dependency_overrides.pop(get_current_user_or_guest)
    monkeypatch.setattr(media_api.settings, "storage_path", str(tmp_path / "storage"))
    guest_token = str(uuid4())
    guest_user_id = "guest-" + hashlib.sha256(guest_token.encode("ascii")).hexdigest()
    file_path = user_storage_root(guest_user_id) / "Downloads" / "clip.mp4"
    file_path.parent.mkdir(parents=True)
    file_path.write_bytes(b"temporary media")

    async def seed() -> None:
        async with sessions() as session:
            session.add(User(id=guest_user_id))
            session.add(
                DownloadJob(
                    id="guest-job",
                    user_id=guest_user_id,
                    source_url="https://www.youtube.com/watch?v=clip",
                    title="Guest clip",
                    creator="Creator",
                    duration_sec=10,
                    destination="Downloads",
                    status="completed",
                    extension="mp4",
                    kind="video",
                    quality_label="best",
                    file_path=str(file_path),
                )
            )
            session.add(
                LibraryItem(
                    id="lib_guest-job",
                    user_id=guest_user_id,
                    title="Guest clip",
                    creator="Creator",
                    filename=file_path.name,
                    source_url="https://www.youtube.com/watch?v=clip",
                    file_path=str(file_path),
                    kind="video",
                    extension="mp4",
                    quality_label="best",
                )
            )
            session.add(
                HistoryItem(
                    id="hist_guest-job",
                    user_id=guest_user_id,
                    title="Guest clip",
                    creator="Creator",
                    source_url="https://www.youtube.com/watch?v=clip",
                    kind="video",
                    status="completed",
                    extension="mp4",
                    quality_label="best",
                    file_path=str(file_path),
                )
            )
            await session.commit()

    asyncio.run(seed())

    response = client.delete(
        "/api/v1/guest-session",
        headers={"X-Guest-Token": guest_token},
    )

    assert response.status_code == 200
    assert not file_path.exists()
    assert client.get("/api/v1/downloads", headers={"X-Guest-Token": guest_token}).json() == []
    assert client.get("/api/v1/library", headers={"X-Guest-Token": guest_token}).json() == []
    assert client.get("/api/v1/history", headers={"X-Guest-Token": guest_token}).json() == []

    async def assert_guest_removed() -> None:
        async with sessions() as session:
            assert await session.get(User, guest_user_id) is None

    asyncio.run(assert_guest_removed())


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


def test_media_preview_requires_analyzed_owned_media_and_returns_an_encrypted_ticket(
    api_client, monkeypatch: pytest.MonkeyPatch
) -> None:
    client, _, auth = api_client
    media_id = "preview-media"
    media_api._MEDIA_CACHE[("user-1", media_id)] = {
        "sourceUrl": "https://www.youtube.com/watch?v=preview",
        "title": "Preview video",
    }
    monkeypatch.setattr(
        media_api,
        "resolve_media_preview",
        lambda source_url, kind: {
            "url": "https://cdn.example/video.mp4?signature=private",
            "headers": {"User-Agent": "MediaDock"},
            "mimeType": "video/mp4",
        },
    )
    try:
        assert client.post(
            "/api/v1/media/not-owned/preview",
            json={"kind": "video"},
        ).status_code == 404

        response = client.post(
            f"/api/v1/media/{media_id}/preview",
            json={"kind": "video"},
        )
        assert response.status_code == 200
        assert response.json()["title"] == "Preview video"
        assert response.json()["element"] == "video"
        assert response.json()["isHls"] is False
        ticket = response.json()["ticket"]
        assert "cdn.example" not in ticket
        assert "private" not in ticket

        auth["user_id"] = "user-2"
        assert client.post(
            f"/api/v1/media/{media_id}/preview",
            json={"kind": "video"},
        ).status_code == 404
    finally:
        media_api._MEDIA_CACHE.pop(("user-1", media_id), None)


def test_preview_stream_forwards_single_range_requests(
    api_client, monkeypatch: pytest.MonkeyPatch
) -> None:
    client, _, _ = api_client
    observed: dict[str, object] = {}

    class FakeUpstream:
        status_code = 206
        headers = {
            "accept-ranges": "bytes",
            "content-length": "5",
            "content-range": "bytes 0-4/10",
        }

        async def aiter_raw(self):
            yield b"video"

        async def aclose(self) -> None:
            return None

    async def open_stream(client, url: str, headers: dict[str, str]):
        observed["url"] = url
        observed["range"] = headers.get("range")
        return FakeUpstream()

    monkeypatch.setattr(media_api, "_open_public_stream", open_stream)
    ticket = media_api.create_media_preview_ticket(
        "https://cdn.example/video.mp4",
        {},
        "video/mp4",
    )

    response = client.get(
        f"/api/v1/media/preview-stream/{ticket}",
        headers={"Range": "bytes=0-4"},
    )

    assert response.status_code == 206
    assert response.content == b"video"
    assert response.headers["content-range"] == "bytes 0-4/10"
    assert observed == {
        "url": "https://cdn.example/video.mp4",
        "range": "bytes=0-4",
    }
