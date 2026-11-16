from __future__ import annotations

import asyncio
import json
import logging
import threading
from datetime import datetime, timezone
from pathlib import Path
import re
from typing import Any

import yt_dlp
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import settings
from app.database.connection import SessionLocal
from app.database.models import DownloadJob, HistoryItem, LibraryItem
from app.services.storage import (
    StorageError,
    cleanup_partial_output,
    resolve_destination,
    safe_filename,
)

logger = logging.getLogger(__name__)


class DownloadWorker:
    def __init__(self) -> None:
        self._queue: asyncio.Queue[str | None] = asyncio.Queue()
        self._queued_ids: set[str] = set()
        self._active_events: dict[str, threading.Event] = {}
        self._stop_reasons: dict[str, str] = {}
        self._task: asyncio.Task[None] | None = None
        self._stopping = False

    async def start(self) -> None:
        if self._task is not None and not self._task.done():
            return
        self._stopping = False
        while True:
            try:
                self._queue.get_nowait()
            except asyncio.QueueEmpty:
                break
            else:
                self._queue.task_done()
        self._queued_ids.clear()
        await self._recover_jobs()
        self._task = asyncio.create_task(self._run())
        logger.info(
            "Download worker started",
            extra={
                "event": "download.worker.started",
                "queued_jobs": len(self._queued_ids),
                "active_jobs": len(self._active_events),
            },
        )

    async def enqueue(self, job_id: str) -> None:
        if self._stopping or job_id in self._queued_ids:
            return
        self._queued_ids.add(job_id)
        await self._queue.put(job_id)

    async def stop(self) -> None:
        task = self._task
        if task is None or task.done():
            self._task = None
            return

        self._stopping = True
        for job_id, event in self._active_events.items():
            self._stop_reasons[job_id] = "queued"
            event.set()

        while True:
            try:
                queued_id = self._queue.get_nowait()
            except asyncio.QueueEmpty:
                break
            self._queue.task_done()
            if queued_id is not None:
                self._queued_ids.discard(queued_id)
        await self._queue.put(None)
        await task
        self._task = None
        logger.info("Download worker stopped", extra={"event": "download.worker.stopped"})

    def request_stop(self, job_id: str, reason: str) -> None:
        event = self._active_events.get(job_id)
        if event is not None:
            self._stop_reasons[job_id] = reason
            event.set()

    async def _recover_jobs(self) -> None:
        if SessionLocal is None:
            return

        async with SessionLocal() as session:
            result = await session.execute(
                select(DownloadJob).where(
                    DownloadJob.status.in_(("queued", "downloading", "processing"))
                )
            )
            jobs = result.scalars().all()
            recovered_ids: list[str] = []
            for job in jobs:
                if job.status in {"downloading", "processing"}:
                    job.status = "queued"
                    job.progress = 0.0
                    job.downloaded_bytes = 0
                    job.total_bytes = None
                    job.speed_bps = 0
                    job.eta_sec = 0
                recovered_ids.append(job.id)
            await session.commit()

        for job_id in recovered_ids:
            await self.enqueue(job_id)
        if recovered_ids:
            logger.info(
                "Recovered interrupted download jobs",
                extra={"event": "download.jobs.recovered", "recovered_jobs": len(recovered_ids)},
            )

    async def _run(self) -> None:
        while True:
            job_id = await self._queue.get()
            try:
                if job_id is None:
                    return
                self._queued_ids.discard(job_id)
                await self._process_job(job_id)
            except Exception:
                logger.exception(
                    "Unexpected error while processing download job",
                    extra={"event": "download.job.unexpected_error", "job_id": job_id},
                )
            finally:
                self._queue.task_done()

    async def _process_job(self, job_id: str) -> None:
        if SessionLocal is None:
            return

        stop_event = threading.Event()
        self._active_events[job_id] = stop_event
        attempt_count = 0
        attempt_limit_reached = False
        async with SessionLocal() as session:
            result = await session.execute(select(DownloadJob).where(DownloadJob.id == job_id))
            job = result.scalar_one_or_none()
            if job is None:
                self._active_events.pop(job_id, None)
                return

            if job.status in {"cancelled", "failed", "completed", "paused"}:
                self._active_events.pop(job_id, None)
                self._stop_reasons.pop(job_id, None)
                return

            if job.attempt_count >= settings.download_max_retries + 1:
                attempt_limit_reached = True
            else:
                job.status = "downloading"
                job.progress = 0.0
                job.error = None
                job.attempt_count += 1
                attempt_count = job.attempt_count
                await session.commit()
                logger.info(
                    "Download attempt started",
                    extra={
                        "event": "download.job.started",
                        "job_id": job.id,
                        "attempt": attempt_count,
                        "kind": job.kind,
                    },
                )

        if attempt_limit_reached:
            await self._mark_failed(
                job_id,
                "Download attempt limit was reached before this worker restart.",
            )
            self._active_events.pop(job_id, None)
            self._stop_reasons.pop(job_id, None)
            return

        try:
            try:
                file_path = self._build_output_path(job)
                file_path.parent.mkdir(parents=True, exist_ok=True)
                existing_storage_bytes = await self._get_user_storage_bytes(job.user_id)
            except (OSError, StorageError, ValueError) as exc:
                await self._mark_failed(job_id, str(exc))
                return

            loop = asyncio.get_running_loop()
            progress_updates: asyncio.Queue[dict[str, Any] | None] = asyncio.Queue(maxsize=1)
            progress_task = asyncio.create_task(self._sync_progress_loop(job_id, progress_updates))
            progress_state: dict[str, Any] = {
                "downloaded_bytes": 0,
                "total_bytes": None,
                "speed_bps": 0,
                "eta_sec": 0,
                "progress": 0.0,
            }

            def publish_progress(payload: dict[str, Any]) -> None:
                def replace_pending_update() -> None:
                    if progress_updates.full():
                        progress_updates.get_nowait()
                    progress_updates.put_nowait(payload)

                loop.call_soon_threadsafe(replace_pending_update)

            def _hook(info: dict[str, Any]) -> None:
                if stop_event.is_set():
                    raise yt_dlp.utils.DownloadError("Download stopped by request.")
                if info.get("status") == "downloading":
                    downloaded = int(info.get("downloaded_bytes") or 0)
                    if (
                        settings.storage_quota_bytes
                        and existing_storage_bytes + downloaded > settings.storage_quota_bytes
                    ):
                        raise yt_dlp.utils.DownloadError(
                            "Storage quota exceeded. Remove files or increase STORAGE_QUOTA_BYTES."
                        )
                    total = info.get("total_bytes_estimate") or info.get("total_bytes")
                    total_value = int(total) if total else None
                    progress_state.update(
                        {
                            "downloaded_bytes": downloaded,
                            "total_bytes": total_value,
                            "speed_bps": int(info.get("speed") or 0),
                            "eta_sec": int(info.get("eta") or 0),
                            "progress": 0.0
                            if total_value is None
                            else min(0.99, downloaded / max(total_value, 1)),
                        }
                    )
                    publish_progress(progress_state.copy())
                elif info.get("status") == "finished":
                    progress_state["progress"] = 1.0
                    publish_progress({**progress_state, "status": "processing"})

            ydl_opts: dict[str, Any] = {
                "noplaylist": True,
                "quiet": True,
                "no_warnings": True,
                "outtmpl": str(file_path),
                "format": self._pick_format(job),
                "progress_hooks": [_hook],
                "paths": {"home": str(file_path.parent)},
            }

            if job.kind == "audio":
                ydl_opts["postprocessors"] = [{
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": self._preferred_audio_codec(job.extension),
                    "preferredquality": "0",
                }]
                ydl_opts["format"] = "bestaudio/best"
            elif self._selection(job).get("mode") == "video+audio":
                container = str(self._selection(job).get("container") or "mp4").lower()
                ydl_opts["merge_output_format"] = container if container in {"mp4", "webm"} else "mp4"

            download_error: Exception | None = None
            downloaded_path: str | None = None
            try:
                downloaded_path = await asyncio.to_thread(self._download_sync, ydl_opts, job.source_url)
            except Exception as exc:  # noqa: BLE001
                download_error = exc
            finally:
                await progress_updates.put(None)
                await progress_task

            if download_error is not None or stop_event.is_set():
                if download_error is not None:
                    logger.warning(
                        "Download attempt failed",
                        extra={
                            "event": "download.job.attempt_failed",
                            "job_id": job_id,
                            "attempt": attempt_count,
                            "error_type": type(download_error).__name__,
                        },
                    )
                try:
                    cleanup_partial_output(file_path)
                except OSError:
                    logger.exception("Could not remove partial output for download job %s", job_id)
                stop_reason = self._stop_reasons.get(job_id)
                if stop_reason:
                    await self._mark_stopped(job_id, stop_reason)
                    return

                message = str(download_error or "Download was interrupted.")
                if (
                    attempt_count <= settings.download_max_retries
                    and "Storage quota exceeded" not in message
                ):
                    await self._mark_retry_queued(job_id, message)
                    logger.info(
                        "Download retry queued",
                        extra={
                            "event": "download.job.retry_queued",
                            "job_id": job_id,
                            "attempt": attempt_count,
                        },
                    )
                    delay = settings.download_retry_backoff_seconds * (2 ** (attempt_count - 1))
                    await asyncio.sleep(min(delay, 30))
                    stop_reason = self._stop_reasons.get(job_id)
                    if stop_reason:
                        await self._mark_stopped(job_id, stop_reason)
                    else:
                        await self.enqueue(job_id)
                else:
                    await self._mark_failed(job_id, message)
                return

            output_path = (
                Path(downloaded_path)
                if downloaded_path
                else self._final_output_path(file_path, job)
            )
            if not output_path.is_file() or output_path.stat().st_size <= 0:
                try:
                    cleanup_partial_output(file_path)
                except OSError:
                    logger.exception("Could not remove incomplete output for download job %s", job_id)
                await self._mark_failed(
                    job_id,
                    "The downloader completed without producing a media file.",
                )
                return
            await self._mark_completed(job_id, str(output_path))
        finally:
            self._active_events.pop(job_id, None)
            self._stop_reasons.pop(job_id, None)

    @staticmethod
    def _download_sync(ydl_opts: dict[str, Any], source_url: str) -> str | None:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(source_url, download=True)
            if isinstance(info, dict):
                filepath = info.get("filepath")
                if isinstance(filepath, str):
                    return filepath
            return None

    async def _sync_progress_loop(
        self, job_id: str, updates: asyncio.Queue[dict[str, Any] | None]
    ) -> None:
        while True:
            payload = await updates.get()
            if payload is None:
                return
            for attempt in range(3):
                try:
                    await self._sync_progress(job_id, payload)
                    break
                except SQLAlchemyError:
                    if attempt == 2:
                        logger.exception(
                            "Progress update could not be persisted for download job %s",
                            job_id,
                        )
                    else:
                        await asyncio.sleep(0.1 * (2**attempt))

    def _build_output_path(self, job: DownloadJob) -> Path:
        base_dir = resolve_destination(job.user_id, job.destination)
        base_name = safe_filename(job.filename, job.title)
        extension = job.extension.lower().lstrip(".") if job.extension else "mp4"
        if not extension.isascii() or not extension.isalnum() or len(extension) > 10:
            extension = "mp4"
        job_suffix = re.sub(r"[^A-Za-z0-9]", "", job.id)[:8] or "download"
        selection = self._selection(job)
        if job.kind == "audio" or selection.get("mode") == "video+audio":
            return base_dir / f"{base_name}-{job_suffix}.%(ext)s"
        return base_dir / f"{base_name}-{job_suffix}.{extension}"

    def _final_output_path(self, requested_path: Path, job: DownloadJob) -> Path:
        if job.kind == "audio":
            audio_ext = self._preferred_audio_codec(job.extension)
            return requested_path.with_suffix(f".{audio_ext}")
        selection = self._selection(job)
        if selection.get("mode") == "video+audio":
            container = str(selection.get("container") or "mp4").lower()
            if container not in {"mp4", "webm"}:
                container = "mp4"
            return requested_path.with_suffix(f".{container}")
        return requested_path

    def _preferred_audio_codec(self, extension: str | None) -> str:
        if extension in {"mp3", "wav", "flac", "m4a", "opus"}:
            return extension
        return "mp3"

    @staticmethod
    def _selection(job: DownloadJob) -> dict[str, Any]:
        if not job.selection_json:
            return {}
        try:
            selection = json.loads(job.selection_json)
        except json.JSONDecodeError:
            return {}
        return selection if isinstance(selection, dict) else {}

    def _pick_format(self, job: DownloadJob) -> str:
        selection = self._selection(job)
        mode = str(selection.get("mode") or "video")
        if mode == "audio":
            return "bestaudio/best"

        quality = str(selection.get("videoQuality") or "best")
        height_filter = (
            f"[height<={quality.removesuffix('p')}]"
            if quality in {"2160p", "1440p", "1080p", "720p", "480p", "360p"}
            else ""
        )
        if mode == "video":
            return f"bestvideo{height_filter}"
        if mode == "video+audio":
            return f"bestvideo{height_filter}+bestaudio/best{height_filter}"
        if quality in {"2160p", "1440p", "1080p", "720p", "480p", "360p"}:
            return f"bestvideo[height<={quality.removesuffix('p')}]+bestaudio/best[height<={quality.removesuffix('p')}]"
        return "bestvideo+bestaudio/best"

    async def _sync_progress(self, job_id: str, payload: dict[str, Any]) -> None:
        if SessionLocal is None:
            return

        async with SessionLocal() as session:
            result = await session.execute(select(DownloadJob).where(DownloadJob.id == job_id))
            job = result.scalar_one_or_none()
            if job is None:
                return

            if job.status in {"cancelled", "paused", "failed", "completed"}:
                return

            if "status" in payload and payload["status"]:
                job.status = str(payload["status"])
            if "downloaded_bytes" in payload:
                job.downloaded_bytes = int(payload["downloaded_bytes"] or 0)
            if "total_bytes" in payload:
                if payload["total_bytes"] is not None:
                    job.total_bytes = int(payload["total_bytes"])
            if "speed_bps" in payload:
                job.speed_bps = int(payload["speed_bps"] or 0)
            if "eta_sec" in payload:
                job.eta_sec = int(payload["eta_sec"] or 0)
            if "progress" in payload:
                job.progress = float(payload["progress"] or 0.0)
            await session.commit()

    async def _mark_retry_queued(self, job_id: str, message: str) -> None:
        if SessionLocal is None:
            return

        async with SessionLocal() as session:
            job = await session.get(DownloadJob, job_id)
            if job is None or job.status in {"cancelled", "paused", "completed"}:
                return
            job.status = "queued"
            job.error = f"Retry scheduled after: {message}"
            job.progress = 0.0
            job.downloaded_bytes = 0
            job.total_bytes = None
            job.speed_bps = 0
            job.eta_sec = 0
            job.completed_at = None
            await session.commit()

    async def _mark_stopped(self, job_id: str, reason: str) -> None:
        if SessionLocal is None:
            return

        async with SessionLocal() as session:
            job = await session.get(DownloadJob, job_id)
            if job is None:
                return

            expected_statuses = {"downloading", "processing", reason}
            if reason == "paused" and job.status == "queued":
                job.attempt_count = max(0, job.attempt_count - 1)
                await session.commit()
                logger.info(
                    "Download stopped",
                    extra={"event": "download.job.stopped", "job_id": job_id, "reason": reason},
                )
                return
            if reason == "queued" and job.status == "queued":
                return
            if job.status not in expected_statuses:
                return

            was_running = job.status in {"downloading", "processing"}
            job.status = reason
            job.progress = 0.0
            job.downloaded_bytes = 0
            job.total_bytes = None
            job.speed_bps = 0
            job.eta_sec = 0
            job.error = None
            if reason == "cancelled":
                job.completed_at = datetime.now(timezone.utc)
            else:
                if was_running:
                    job.attempt_count = max(0, job.attempt_count - 1)
                job.completed_at = None
            await session.commit()
            logger.info(
                "Download stopped",
                extra={"event": "download.job.stopped", "job_id": job_id, "reason": reason},
            )

    async def _mark_failed(self, job_id: str, message: str) -> None:
        if SessionLocal is None:
            return

        async with SessionLocal() as session:
            result = await session.execute(select(DownloadJob).where(DownloadJob.id == job_id))
            job = result.scalar_one_or_none()
            if job is None:
                return
            job.status = "failed"
            job.progress = 1.0 if job.downloaded_bytes else 0.0
            job.error = message
            job.completed_at = datetime.now(timezone.utc)

            job.file_path = None
            history = await session.get(HistoryItem, f"hist_{job.id}")
            history_values = {
                "user_id": job.user_id,
                "title": job.title,
                "creator": job.creator,
                "source_url": job.source_url,
                "thumbnail_url": job.thumbnail_url,
                "kind": job.kind,
                "status": "failed",
                "extension": job.extension,
                "quality_label": job.quality_label,
                "duration_sec": job.duration_sec,
                "size_bytes": None,
                "file_path": None,
                "error": message,
                "timestamp": datetime.now(timezone.utc),
            }
            if history is None:
                history = HistoryItem(id=f"hist_{job.id}", **history_values)
                session.add(history)
            else:
                for key, value in history_values.items():
                    setattr(history, key, value)
            await session.commit()
            logger.error(
                "Download job failed",
                extra={"event": "download.job.failed", "job_id": job_id},
            )

    async def _mark_completed(self, job_id: str, output_path: str) -> None:
        if SessionLocal is None:
            return

        async with SessionLocal() as session:
            result = await session.execute(select(DownloadJob).where(DownloadJob.id == job_id))
            job = result.scalar_one_or_none()
            if job is None:
                return

            job.status = "completed"
            job.progress = 1.0
            job.file_path = output_path
            job.completed_at = datetime.now(timezone.utc)
            job.error = None

            path = Path(output_path)
            size_bytes = path.stat().st_size if path.exists() else 0
            job.total_bytes = size_bytes
            job.downloaded_bytes = size_bytes

            library = await session.get(LibraryItem, f"lib_{job.id}")
            library_values = {
                "user_id": job.user_id,
                "title": job.title,
                "creator": job.creator,
                "filename": path.name,
                "source_url": job.source_url,
                "thumbnail_url": job.thumbnail_url,
                "file_path": str(path),
                "kind": job.kind,
                "extension": path.suffix.lstrip("."),
                "quality_label": job.quality_label,
                "size_bytes": size_bytes,
                "duration_sec": job.duration_sec,
                "downloaded_at": datetime.now(timezone.utc),
            }
            if library is None:
                library = LibraryItem(id=f"lib_{job.id}", **library_values)
                session.add(library)
            else:
                for key, value in library_values.items():
                    setattr(library, key, value)

            history = await session.get(HistoryItem, f"hist_{job.id}")
            history_values = {
                "user_id": job.user_id,
                "title": job.title,
                "creator": job.creator,
                "source_url": job.source_url,
                "thumbnail_url": job.thumbnail_url,
                "kind": job.kind,
                "status": "completed",
                "extension": path.suffix.lstrip("."),
                "quality_label": job.quality_label,
                "duration_sec": job.duration_sec,
                "size_bytes": size_bytes,
                "file_path": str(path),
                "error": None,
                "timestamp": datetime.now(timezone.utc),
            }
            if history is None:
                history = HistoryItem(id=f"hist_{job.id}", **history_values)
                session.add(history)
            else:
                for key, value in history_values.items():
                    setattr(history, key, value)
            await session.commit()
            logger.info(
                "Download job completed",
                extra={
                    "event": "download.job.completed",
                    "job_id": job_id,
                    "file_size_bytes": size_bytes,
                },
            )

    async def _get_user_storage_bytes(self, user_id: str) -> int:
        if SessionLocal is None:
            return 0
        async with SessionLocal() as session:
            result = await session.execute(
                select(func.coalesce(func.sum(LibraryItem.size_bytes), 0)).where(
                    LibraryItem.user_id == user_id
                )
            )
            return int(result.scalar_one())

    def health_status(self) -> dict[str, int | bool]:
        return {
            "running": self._task is not None and not self._task.done(),
            "queued_jobs": len(self._queued_ids),
            "active_jobs": len(self._active_events),
        }


_download_worker = DownloadWorker()


async def start_download_worker() -> None:
    await _download_worker.start()


async def stop_download_worker() -> None:
    await _download_worker.stop()


def download_worker_status() -> dict[str, int | bool]:
    return _download_worker.health_status()


async def queue_download_job(job_id: str) -> None:
    await _download_worker.enqueue(job_id)


def stop_download_job(job_id: str, reason: str) -> None:
    _download_worker.request_stop(job_id, reason)
