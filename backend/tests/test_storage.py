from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.api.media import (
    cancel_download,
    get_overview,
    pause_download,
    remove_library_item,
    resume_download,
    retry_download,
    start_download,
)
from app.core.security import AuthUser
from app.database.base import Base
from app.database.models import DownloadJob, HistoryItem, LibraryItem, User
from app.database.connection import cleanup_expired_guest_sessions
from app.schemas.media import DownloadRequestSchema
import pytest

from app.services.storage import (
    StorageError,
    cleanup_partial_output,
    resolve_destination,
    safe_filename,
    user_storage_root,
)


async def _make_sessions(database_path: Path):
    engine = create_async_engine(f"sqlite+aiosqlite:///{database_path}")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    return engine, async_sessionmaker(engine, expire_on_commit=False)


def test_default_destination_is_scoped_to_user_and_managed_root(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr("app.services.storage.settings.storage_path", str(tmp_path))

    destination = resolve_destination("user-123", "~/Downloads/Astrid/Video")

    assert destination == tmp_path / "user-123" / "Downloads" / "Astrid" / "Video"


def test_destination_rejects_parent_traversal_and_external_absolute_paths(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr("app.services.storage.settings.storage_path", str(tmp_path / "managed"))

    with pytest.raises(StorageError, match="parent-directory"):
        resolve_destination("user-123", "../outside")
    with pytest.raises(StorageError, match="inside the backend storage"):
        resolve_destination("user-123", str(tmp_path / "outside"))


def test_absolute_managed_destination_is_scoped_to_requesting_user(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    root = tmp_path / "managed"
    monkeypatch.setattr("app.services.storage.settings.storage_path", str(root))

    destination = resolve_destination("user-123", str(root / "Shared" / "Video"))

    assert destination == root / "user-123" / "Shared" / "Video"


def test_safe_filename_removes_paths_and_windows_reserved_names() -> None:
    assert safe_filename(r"..\CON.mp4", "fallback") == "_CON"
    assert safe_filename("A video: title.mp4", "fallback") == "A video_ title"


def test_cleanup_removes_only_files_for_the_unique_output_prefix(tmp_path: Path) -> None:
    output = tmp_path / "video-job1234.mp4"
    partial = tmp_path / "video-job1234.mp4.part"
    unrelated = tmp_path / "video-job9999.mp4.part"
    partial.write_bytes(b"partial")
    unrelated.write_bytes(b"keep")

    cleanup_partial_output(output)

    assert not partial.exists()
    assert unrelated.exists()


@pytest.mark.asyncio
async def test_overview_reports_user_storage_and_quota_without_multiplying_usage(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    engine, sessions = await _make_sessions(tmp_path / "overview.db")
    monkeypatch.setattr("app.services.storage.settings.storage_path", str(tmp_path / "storage"))
    monkeypatch.setattr("app.api.media.settings.storage_quota_bytes", 1000)
    monkeypatch.setattr("app.api.media.storage_disk_free_bytes", lambda: 5000)
    user = AuthUser(user_id="user-1", email=None, role="authenticated")

    async with sessions() as session:
        session.add(User(id="user-1", email=None))
        session.add_all(
            [
                HistoryItem(
                    id="history-1",
                    user_id="user-1",
                    title="Completed",
                    creator="Creator",
                    source_url="https://example.com/1",
                    kind="video",
                    status="completed",
                    extension="mp4",
                    quality_label="1080p",
                ),
                HistoryItem(
                    id="history-2",
                    user_id="user-1",
                    title="Failed",
                    creator="Creator",
                    source_url="https://example.com/2",
                    kind="video",
                    status="failed",
                    extension="mp4",
                    quality_label="1080p",
                ),
                HistoryItem(
                    id="history-old",
                    user_id="user-1",
                    title="Old failed",
                    creator="Creator",
                    source_url="https://example.com/old",
                    kind="audio",
                    status="failed",
                    extension="m4a",
                    quality_label="best",
                    timestamp=datetime.now(timezone.utc) - timedelta(days=400),
                ),
            ]
        )
        session.add(
            LibraryItem(
                id="library-1",
                user_id="user-1",
                title="Completed",
                creator="Creator",
                filename="completed.mp4",
                source_url="https://example.com/1",
                file_path=str(tmp_path / "storage" / "user-1" / "completed.mp4"),
                kind="video",
                extension="mp4",
                quality_label="1080p",
                size_bytes=250,
            )
        )
        await session.commit()

        overview = await get_overview(7, user, session)

    assert overview["totalDownloads"] == 2
    assert overview["completed"] == 1
    assert overview["failed"] == 1
    assert overview["storageBytes"] == 250
    assert overview["storageQuotaBytes"] == 1000
    assert overview["storageRemainingBytes"] == 750
    assert overview["storageDiskFreeBytes"] == 5000
    assert sum(point["video"] for point in overview["activity"]) == 2
    await engine.dispose()


@pytest.mark.asyncio
async def test_expired_guest_cleanup_removes_metadata_and_backend_media(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    engine, sessions = await _make_sessions(tmp_path / "expired-guest.db")
    storage_root_path = tmp_path / "storage"
    monkeypatch.setattr("app.services.storage.settings.storage_path", str(storage_root_path))
    monkeypatch.setattr("app.database.connection.SessionLocal", sessions)
    guest_id = "guest-expired"
    media_file = user_storage_root(guest_id) / "Downloads" / "expired.mp4"
    media_file.parent.mkdir(parents=True)
    media_file.write_bytes(b"expired media")

    async with sessions() as session:
        session.add(
            User(
                id=guest_id,
                created_at=datetime.now(timezone.utc) - timedelta(days=8),
            )
        )
        session.add(
            DownloadJob(
                id="expired-job",
                user_id=guest_id,
                source_url="https://www.youtube.com/watch?v=expired",
                title="Expired",
                creator="Creator",
                destination="Downloads",
                status="completed",
                file_path=str(media_file),
            )
        )
        session.add(
            LibraryItem(
                id="lib_expired-job",
                user_id=guest_id,
                title="Expired",
                creator="Creator",
                filename=media_file.name,
                source_url="https://www.youtube.com/watch?v=expired",
                file_path=str(media_file),
                kind="video",
                extension="mp4",
                quality_label="best",
            )
        )
        session.add(
            HistoryItem(
                id="hist_expired-job",
                user_id=guest_id,
                title="Expired",
                creator="Creator",
                source_url="https://www.youtube.com/watch?v=expired",
                kind="video",
                status="completed",
                extension="mp4",
                quality_label="best",
                file_path=str(media_file),
            )
        )
        await session.commit()

    await cleanup_expired_guest_sessions()

    assert not media_file.exists()
    async with sessions() as session:
        assert await session.get(User, guest_id) is None
        assert await session.get(DownloadJob, "expired-job") is None
        assert await session.get(LibraryItem, "lib_expired-job") is None
        assert await session.get(HistoryItem, "hist_expired-job") is None
    await engine.dispose()


@pytest.mark.asyncio
async def test_start_download_rejects_jobs_when_quota_is_full(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from fastapi import HTTPException

    engine, sessions = await _make_sessions(tmp_path / "quota.db")
    monkeypatch.setattr("app.services.storage.settings.storage_path", str(tmp_path / "storage"))
    monkeypatch.setattr("app.api.media.settings.storage_quota_bytes", 100)
    user = AuthUser(user_id="user-1", email=None, role="authenticated")
    payload = DownloadRequestSchema(
        sourceUrl="https://example.com/video",
        title="Video",
        creator="Creator",
        thumbnailUrl="",
        durationSec=10,
        destination="~/Downloads/Astrid",
        selection={},
    )

    async with sessions() as session:
        session.add(User(id="user-1", email=None))
        session.add(
            LibraryItem(
                id="library-1",
                user_id="user-1",
                title="Existing",
                creator="Creator",
                filename="existing.mp4",
                source_url="https://example.com/existing",
                file_path=str(tmp_path / "storage" / "user-1" / "existing.mp4"),
                kind="video",
                extension="mp4",
                quality_label="1080p",
                size_bytes=100,
            )
        )
        await session.commit()

        with pytest.raises(HTTPException) as exc_info:
            await start_download(payload, user, session)

    assert exc_info.value.status_code == 413
    await engine.dispose()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("audio_format", "expected_extension"),
    [("best", "m4a"), ("m4a", "m4a"), ("mp3", "mp3"), ("wav", "wav"), ("flac", "flac")],
)
async def test_start_audio_download_preserves_the_requested_output_format(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    audio_format: str,
    expected_extension: str,
) -> None:
    engine, sessions = await _make_sessions(tmp_path / f"audio-{audio_format}.db")
    monkeypatch.setattr("app.services.storage.settings.storage_path", str(tmp_path / "storage"))
    monkeypatch.setattr("app.api.media.settings.storage_quota_bytes", 0)

    async def enqueue(job_id: str) -> None:
        return None

    monkeypatch.setattr("app.api.media.queue_download_job", enqueue)
    user = AuthUser(user_id="user-1", email=None, role="authenticated")
    payload = DownloadRequestSchema(
        sourceUrl="https://example.com/audio",
        title="Audio",
        creator="Creator",
        thumbnailUrl="",
        durationSec=10,
        destination="~/Downloads/Astrid",
        selection={"mode": "audio", "audioFormat": audio_format},
    )

    async with sessions() as session:
        session.add(User(id="user-1", email=None))
        await session.commit()
        response = await start_download(payload, user, session)
        stored_job = await session.get(DownloadJob, response.id)

    assert response.kind == "audio"
    assert response.extension == expected_extension
    assert stored_job is not None
    assert stored_job.extension == expected_extension
    await engine.dispose()


@pytest.mark.asyncio
async def test_retry_resets_failed_job_and_requeues_it(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    engine, sessions = await _make_sessions(tmp_path / "retry.db")
    queued_ids: list[str] = []

    async def enqueue(job_id: str) -> None:
        queued_ids.append(job_id)

    monkeypatch.setattr("app.api.media.queue_download_job", enqueue)
    user = AuthUser(user_id="user-1", email=None, role="authenticated")

    async with sessions() as session:
        session.add(User(id="user-1", email=None))
        session.add(
            DownloadJob(
                id="job-1",
                user_id="user-1",
                source_url="https://example.com/video",
                title="Video",
                creator="Creator",
                destination="~/Downloads/Astrid",
                status="failed",
                progress=1.0,
                downloaded_bytes=123,
                total_bytes=123,
                extension="mp4",
                kind="video",
                quality_label="1080p",
                error="network error",
            )
        )
        await session.commit()

        result = await retry_download("job-1", user, session)
        job = await session.get(DownloadJob, "job-1")

    assert result["status"] == "queued"
    assert job is not None
    assert job.downloaded_bytes == 0
    assert job.total_bytes is None
    assert job.error is None
    assert queued_ids == ["job-1"]
    await engine.dispose()


@pytest.mark.asyncio
async def test_pause_resume_cancel_controls_worker_and_durable_queue(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    engine, sessions = await _make_sessions(tmp_path / "controls.db")
    stop_requests: list[tuple[str, str]] = []
    queued_ids: list[str] = []

    def request_stop(job_id: str, reason: str) -> None:
        stop_requests.append((job_id, reason))

    async def enqueue(job_id: str) -> None:
        queued_ids.append(job_id)

    monkeypatch.setattr("app.api.media.stop_download_job", request_stop)
    monkeypatch.setattr("app.api.media.queue_download_job", enqueue)
    user = AuthUser(user_id="user-1", email=None, role="authenticated")

    async with sessions() as session:
        session.add(User(id="user-1", email=None))
        session.add(
            DownloadJob(
                id="job-controls",
                user_id="user-1",
                source_url="https://example.com/video",
                title="Video",
                creator="Creator",
                destination="~/Downloads/Astrid",
                status="downloading",
                extension="mp4",
                kind="video",
                quality_label="1080p",
            )
        )
        await session.commit()

        paused = await pause_download("job-controls", user, session)
        assert paused["status"] == "paused"

        resumed = await resume_download("job-controls", user, session)
        assert resumed["status"] == "queued"

        cancelled = await cancel_download("job-controls", user, session)
        assert cancelled["status"] == "cancelled"

    assert stop_requests == [("job-controls", "paused"), ("job-controls", "cancelled")]
    assert queued_ids == ["job-controls"]
    await engine.dispose()


@pytest.mark.asyncio
async def test_removing_library_item_deletes_its_managed_file(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    engine, sessions = await _make_sessions(tmp_path / "delete.db")
    root = tmp_path / "storage"
    file_path = root / "user-1" / "Downloads" / "media.mp4"
    file_path.parent.mkdir(parents=True)
    file_path.write_bytes(b"media")
    monkeypatch.setattr("app.services.storage.settings.storage_path", str(root))
    user = AuthUser(user_id="user-1", email=None, role="authenticated")

    async with sessions() as session:
        session.add(User(id="user-1", email=None))
        session.add(
            LibraryItem(
                id="library-1",
                user_id="user-1",
                title="Video",
                creator="Creator",
                filename=file_path.name,
                source_url="https://example.com/video",
                file_path=str(file_path),
                kind="video",
                extension="mp4",
                quality_label="1080p",
                size_bytes=5,
            )
        )
        await session.commit()

        result = await remove_library_item("library-1", user, session)
        item = await session.scalar(select(LibraryItem).where(LibraryItem.id == "library-1"))

    assert result["status"] == "removed"
    assert not file_path.exists()
    assert item is None
    await engine.dispose()
