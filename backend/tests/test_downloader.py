import asyncio
import json
from pathlib import Path
import threading
import time

import pytest
import yt_dlp
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.database.base import Base
from app.database.models import DownloadJob, HistoryItem, LibraryItem, User
from app.services.downloader import DownloadWorker


def test_output_path_uses_user_root_safe_filename_and_job_suffix(
    tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr("app.services.storage.settings.storage_path", str(tmp_path))
    job = DownloadJob(
        id="job-1234",
        user_id="user-1",
        title="Unsafe: title",
        filename="Custom title.mp4",
        destination="~/Downloads/Astrid/Video",
        extension="mp4",
    )

    output_path = DownloadWorker()._build_output_path(job)

    assert output_path == (
        tmp_path / "user-1" / "Downloads" / "Astrid" / "Video" / "Custom title-job1234.mp4"
    )


def test_video_plus_audio_selection_requires_audio_and_uses_the_selected_container(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr("app.services.storage.settings.storage_path", str(tmp_path))
    job = DownloadJob(
        id="job-av",
        user_id="user-1",
        title="Video with sound",
        filename=None,
        destination="~/Downloads",
        kind="video",
        extension="webm",
        selection_json=json.dumps(
            {"mode": "video+audio", "videoQuality": "1080p", "container": "webm"}
        ),
    )
    worker = DownloadWorker()

    assert worker._pick_format(job) == (
        "bestvideo[height<=1080]+bestaudio/"
        "bestvideo[width<=1080]+bestaudio/"
        "best[height<=1080]/best[width<=1080]"
    )
    output_path = worker._build_output_path(job)
    assert output_path.suffix == ".%(ext)s"
    assert worker._final_output_path(output_path, job).suffix == ".webm"


@pytest.mark.parametrize(
    ("mode", "expected_format"),
    [
        ("video", "portrait-video"),
        ("video+audio", "portrait-video+audio"),
    ],
)
def test_video_format_selection_accepts_portrait_video(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    mode: str,
    expected_format: str,
) -> None:
    monkeypatch.setattr("app.services.storage.settings.storage_path", str(tmp_path))
    job = DownloadJob(
        id="job-portrait",
        user_id="user-1",
        title="Portrait reel",
        filename=None,
        destination="~/Downloads",
        kind="video",
        extension="mp4",
        selection_json=json.dumps(
            {"mode": mode, "videoQuality": "1080p", "container": "mp4"}
        ),
    )
    formats = [
        {
            "format_id": "portrait-video",
            "ext": "mp4",
            "url": "https://example.com/video",
            "width": 1080,
            "height": 1920,
            "vcodec": "av01",
            "acodec": "none",
        },
        {
            "format_id": "audio",
            "ext": "m4a",
            "url": "https://example.com/audio",
            "vcodec": "none",
            "acodec": "mp4a",
        },
    ]

    with yt_dlp.YoutubeDL({"quiet": True}) as ydl:
        selected = list(
            ydl.build_format_selector(DownloadWorker()._pick_format(job))(
                {"formats": formats, "incomplete": True}
            )
        )

    assert selected[0]["format_id"] == expected_format


@pytest.mark.parametrize("audio_format", ["m4a", "mp3", "wav", "flac"])
def test_audio_selection_uses_a_source_aware_temporary_extension(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, audio_format: str
) -> None:
    monkeypatch.setattr("app.services.storage.settings.storage_path", str(tmp_path))
    job = DownloadJob(
        id="job-audio",
        user_id="user-1",
        title="Audio track",
        filename=None,
        destination="~/Downloads",
        kind="audio",
        extension=audio_format,
        selection_json=json.dumps({"mode": "audio", "audioFormat": audio_format}),
    )
    worker = DownloadWorker()

    assert worker._pick_format(job) == "bestaudio/best"
    output_path = worker._build_output_path(job)
    assert output_path.suffix == ".%(ext)s"
    assert worker._final_output_path(output_path, job).suffix == f".{audio_format}"


def test_download_sync_returns_the_postprocessed_output_path(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class FakeYoutubeDL:
        def __init__(self, options: dict) -> None:
            self.options = options

        def __enter__(self) -> "FakeYoutubeDL":
            return self

        def __exit__(self, *args: object) -> None:
            return None

        def extract_info(self, url: str, download: bool) -> dict:
            assert url == "https://example.com/audio"
            assert download is True
            return {"filepath": "C:\\media\\audio.mp3"}

    monkeypatch.setattr("app.services.downloader.yt_dlp.YoutubeDL", FakeYoutubeDL)

    output_path = DownloadWorker._download_sync({}, "https://example.com/audio")

    assert output_path == "C:\\media\\audio.mp3"


@pytest.mark.asyncio
async def test_download_worker_queue_accepts_jobs() -> None:
    worker = DownloadWorker()

    await worker.enqueue("job-123")

    assert await worker._queue.get() == "job-123"


@pytest.mark.asyncio
async def test_mark_completed_persists_actual_file_path_and_size(
    tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'test.db'}")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    monkeypatch.setattr("app.services.downloader.SessionLocal", sessions)

    async with sessions() as session:
        session.add(User(id="user-1", email=None))
        session.add(
            DownloadJob(
                id="job-1",
                user_id="user-1",
                source_url="https://example.com/video",
                title="A video",
                creator="Creator",
                destination="~/Downloads/Astrid/Video",
                status="processing",
                extension="mp4",
                kind="video",
                quality_label="1080p",
            )
        )
        await session.commit()

    media_file = tmp_path / "video-job-1.mp4"
    media_file.write_bytes(b"persisted media")
    worker = DownloadWorker()
    await worker._mark_failed("job-1", "temporary network error")
    await worker._mark_completed("job-1", str(media_file))

    async with sessions() as session:
        job = await session.get(DownloadJob, "job-1")
        library = await session.get(LibraryItem, "lib_job-1")
        history = await session.get(HistoryItem, "hist_job-1")

        assert job is not None
        assert job.status == "completed"
        assert job.file_path == str(media_file)
        assert job.total_bytes == len(b"persisted media")
        assert library is not None
        assert library.file_path == str(media_file)
        assert library.size_bytes == len(b"persisted media")
        assert history is not None
        assert history.status == "completed"
        assert history.size_bytes == len(b"persisted media")

    await engine.dispose()


async def _create_worker_database(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'worker.db'}")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    monkeypatch.setattr("app.services.downloader.SessionLocal", sessions)
    async with sessions() as session:
        session.add(User(id="user-1", email=None))
        await session.commit()
    return engine, sessions


@pytest.mark.asyncio
async def test_worker_requeues_interrupted_jobs_after_restart(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    engine, sessions = await _create_worker_database(tmp_path, monkeypatch)
    async with sessions() as session:
        session.add_all(
            [
                DownloadJob(
                    id=job_id,
                    user_id="user-1",
                    source_url=f"https://example.com/{job_id}",
                    title=job_id,
                    creator="Creator",
                    destination="~/Downloads/Astrid",
                    status=old_status,
                    progress=0.6,
                    downloaded_bytes=60,
                    total_bytes=100,
                    attempt_count=1,
                    extension="mp4",
                    kind="video",
                    quality_label="1080p",
                )
                for job_id, old_status in (
                    ("queued-job", "queued"),
                    ("downloading-job", "downloading"),
                    ("processing-job", "processing"),
                    ("paused-job", "paused"),
                )
            ]
        )
        await session.commit()

    worker = DownloadWorker()
    await worker._recover_jobs()

    recovered_ids = {
        worker._queue.get_nowait(),
        worker._queue.get_nowait(),
        worker._queue.get_nowait(),
    }
    async with sessions() as session:
        jobs = (await session.execute(select(DownloadJob))).scalars().all()
        statuses = {job.id: (job.status, job.progress, job.downloaded_bytes) for job in jobs}

    assert recovered_ids == {"queued-job", "downloading-job", "processing-job"}
    assert statuses["downloading-job"] == ("queued", 0.0, 0)
    assert statuses["processing-job"] == ("queued", 0.0, 0)
    assert statuses["paused-job"][0] == "paused"
    await engine.dispose()


@pytest.mark.asyncio
async def test_worker_coalesces_duplicate_queue_entries() -> None:
    worker = DownloadWorker()

    await worker.enqueue("job-1")
    await worker.enqueue("job-1")

    assert worker._queue.qsize() == 1


@pytest.mark.asyncio
async def test_progress_sync_retries_transient_database_errors(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    worker = DownloadWorker()
    attempts = 0

    async def flaky_sync(job_id: str, payload: dict) -> None:
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            raise SQLAlchemyError("temporary database failure")

    monkeypatch.setattr(worker, "_sync_progress", flaky_sync)
    updates: asyncio.Queue[dict | None] = asyncio.Queue()
    await updates.put({"progress": 0.5})
    await updates.put(None)

    await worker._sync_progress_loop("job-1", updates)

    assert attempts == 2


@pytest.mark.asyncio
async def test_worker_retries_a_failed_attempt_and_persists_progress(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    engine, sessions = await _create_worker_database(tmp_path, monkeypatch)
    monkeypatch.setattr("app.services.storage.settings.storage_path", str(tmp_path / "storage"))
    monkeypatch.setattr("app.services.downloader.settings.download_max_retries", 1)
    monkeypatch.setattr("app.services.downloader.settings.download_retry_backoff_seconds", 0)
    async with sessions() as session:
        session.add(
            DownloadJob(
                id="job-retry",
                user_id="user-1",
                source_url="https://example.com/video",
                title="Video",
                creator="Creator",
                destination="~/Downloads/Astrid",
                status="queued",
                extension="mp4",
                kind="video",
                quality_label="1080p",
            )
        )
        await session.commit()

    worker = DownloadWorker()
    original_sync = worker._sync_progress
    persisted_progress: list[float] = []

    async def record_progress(job_id: str, payload: dict) -> None:
        if "progress" in payload:
            persisted_progress.append(payload["progress"])
        await original_sync(job_id, payload)

    monkeypatch.setattr(worker, "_sync_progress", record_progress)
    attempts = 0

    def fake_download(ydl_options: dict, source_url: str) -> None:
        nonlocal attempts
        attempts += 1
        hook = ydl_options["progress_hooks"][0]
        hook(
            {
                "status": "downloading",
                "downloaded_bytes": 5,
                "total_bytes": 10,
                "speed": 2,
                "eta": 1,
            }
        )
        if attempts == 1:
            raise yt_dlp.utils.DownloadError("temporary network failure")
        hook({"status": "finished"})
        Path(ydl_options["outtmpl"]).write_bytes(b"completed media")

    monkeypatch.setattr(worker, "_download_sync", fake_download)

    await worker._process_job("job-retry")
    async with sessions() as session:
        retried = await session.get(DownloadJob, "job-retry")
        assert retried is not None
        assert retried.status == "queued"
        assert retried.attempt_count == 1

    await worker._process_job("job-retry")
    async with sessions() as session:
        completed = await session.get(DownloadJob, "job-retry")
        assert completed is not None
        assert completed.status == "completed"
        assert completed.attempt_count == 2
        assert await session.get(LibraryItem, "lib_job-retry") is not None

    assert attempts == 2
    assert 0.5 in persisted_progress
    while not worker._queue.empty():
        worker._queue.get_nowait()
        worker._queue.task_done()
    await engine.dispose()


@pytest.mark.asyncio
async def test_graceful_worker_shutdown_requeues_and_cleans_active_job(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    engine, sessions = await _create_worker_database(tmp_path, monkeypatch)
    monkeypatch.setattr("app.services.storage.settings.storage_path", str(tmp_path / "storage"))
    async with sessions() as session:
        session.add(
            DownloadJob(
                id="job-shutdown",
                user_id="user-1",
                source_url="https://example.com/video",
                title="Video",
                creator="Creator",
                destination="~/Downloads/Astrid",
                status="queued",
                extension="mp4",
                kind="video",
                quality_label="1080p",
            )
        )
        await session.commit()

    worker = DownloadWorker()
    download_started = threading.Event()
    output_paths: list[Path] = []

    def fake_download(ydl_options: dict, source_url: str) -> None:
        output = Path(ydl_options["outtmpl"])
        output_paths.append(output)
        output.write_bytes(b"partial")
        hook = ydl_options["progress_hooks"][0]
        download_started.set()
        while True:
            try:
                hook({"status": "downloading", "downloaded_bytes": 6, "total_bytes": 10})
            except yt_dlp.utils.DownloadError:
                return
            time.sleep(0.01)

    monkeypatch.setattr(worker, "_download_sync", fake_download)
    await worker.start()
    assert await asyncio.to_thread(download_started.wait, 2)
    await asyncio.wait_for(worker.stop(), timeout=5)

    async with sessions() as session:
        job = await session.get(DownloadJob, "job-shutdown")
        assert job is not None
        assert job.status == "queued"
        assert job.attempt_count == 0
    assert output_paths
    assert not output_paths[0].exists()
    assert worker._task is None
    await engine.dispose()


@pytest.mark.asyncio
async def test_worker_cancellation_stops_download_and_removes_partial_output(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    engine, sessions = await _create_worker_database(tmp_path, monkeypatch)
    monkeypatch.setattr("app.services.storage.settings.storage_path", str(tmp_path / "storage"))
    async with sessions() as session:
        session.add(
            DownloadJob(
                id="job-cancel",
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

    worker = DownloadWorker()
    download_started = threading.Event()
    resume_download = threading.Event()
    output_paths: list[Path] = []

    def fake_download(ydl_options: dict, source_url: str) -> None:
        output = Path(ydl_options["outtmpl"])
        output_paths.append(output)
        output.write_bytes(b"partial")
        hook = ydl_options["progress_hooks"][0]
        hook({"status": "downloading", "downloaded_bytes": 6, "total_bytes": 10})
        download_started.set()
        if not resume_download.wait(timeout=5):
            raise TimeoutError("test did not release the downloader")
        hook({"status": "downloading", "downloaded_bytes": 7, "total_bytes": 10})

    monkeypatch.setattr(worker, "_download_sync", fake_download)
    process_task = asyncio.create_task(worker._process_job("job-cancel"))
    assert await asyncio.to_thread(download_started.wait, 2)

    async with sessions() as session:
        job = await session.get(DownloadJob, "job-cancel")
        assert job is not None
        job.status = "cancelled"
        await session.commit()
    worker.request_stop("job-cancel", "cancelled")
    resume_download.set()
    await process_task

    async with sessions() as session:
        job = await session.get(DownloadJob, "job-cancel")
        assert job is not None
        assert job.status == "cancelled"
    assert output_paths
    assert not output_paths[0].exists()
    await engine.dispose()
