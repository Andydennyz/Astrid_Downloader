from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy import case, delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import AuthUser, get_current_user
from app.core.config import settings
from app.database.connection import get_db
from app.database.models import DownloadJob, HistoryItem, LibraryItem
from app.repositories.user_repository import UserRepository
from app.schemas.media import DownloadJobResponse, DownloadRequestSchema, FileOpenSessionRequest, MediaAnalyzeRequest, MediaInfoResponse
from app.services.downloader import queue_download_job, stop_download_job
from app.services.file_access import create_file_access_ticket, read_file_access_ticket
from app.services.media_analyzer import MediaAnalysisError, analyze_media_url
from app.services.storage import StorageError, resolve_destination, storage_disk_free_bytes, user_storage_root

router = APIRouter(tags=["media"])

_MEDIA_CACHE: dict[tuple[str, str], dict] = {}


def _serialize_download(job: DownloadJob) -> dict:
    selection = {}
    if job.selection_json:
        try:
            selection = json.loads(job.selection_json)
        except json.JSONDecodeError:
            selection = {}

    request = {
        "sourceUrl": job.source_url,
        "title": job.title,
        "creator": job.creator,
        "thumbnailUrl": job.thumbnail_url or "",
        "durationSec": job.duration_sec,
        "destination": job.destination,
        "filename": job.filename,
        "selection": selection,
    }
    return {
        "id": job.id,
        "request": request,
        "kind": job.kind,
        "extension": job.extension,
        "qualityLabel": job.quality_label,
        "priority": job.priority,
        "status": job.status,
        "progress": float(job.progress),
        "downloadedBytes": int(job.downloaded_bytes),
        "totalBytes": job.total_bytes,
        "speedBps": job.speed_bps,
        "etaSec": job.eta_sec,
        "filePath": job.file_path,
        "error": job.error,
        "createdAt": job.created_at.isoformat(),
        "completedAt": job.completed_at.isoformat() if job.completed_at else None,
    }


def _serialize_library(item: LibraryItem) -> dict:
    return {
        "id": item.id,
        "kind": item.kind,
        "filename": item.filename,
        "title": item.title,
        "creator": item.creator,
        "thumbnailUrl": item.thumbnail_url or "",
        "extension": item.extension,
        "qualityLabel": item.quality_label,
        "height": None,
        "audioBitrateKbps": None,
        "durationSec": item.duration_sec,
        "sizeBytes": item.size_bytes,
        "downloadedAt": item.downloaded_at.isoformat(),
        "filePath": item.file_path,
        "sourceUrl": item.source_url,
        "platform": "other",
    }


def _serialize_history(item: HistoryItem) -> dict:
    return {
        "id": item.id,
        "title": item.title,
        "creator": item.creator,
        "thumbnailUrl": item.thumbnail_url or "",
        "sourceUrl": item.source_url,
        "platform": "other",
        "kind": item.kind,
        "status": item.status,
        "durationSec": item.duration_sec,
        "extension": item.extension,
        "qualityLabel": item.quality_label,
        "sizeBytes": item.size_bytes,
        "filePath": item.file_path,
        "error": item.error,
        "timestamp": item.timestamp.isoformat(),
    }


@router.get("/media/validate")
async def validate_media_url(url: str = Query(..., min_length=1)) -> dict:
    try:
        MediaAnalyzeRequest(url=url)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    platform = "youtube" if "youtube.com" in url.lower() or "youtu.be" in url.lower() else "other"
    return {"valid": True, "platform": platform}


@router.post("/media/analyze", response_model=MediaInfoResponse)
async def analyze_media(payload: MediaAnalyzeRequest, current_user: AuthUser = Depends(get_current_user)) -> MediaInfoResponse:
    try:
        data = analyze_media_url(payload.url)
    except MediaAnalysisError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    _MEDIA_CACHE[(current_user.user_id, str(data["id"]))] = data
    return MediaInfoResponse(**data)


@router.get("/media/{media_id}/formats")
async def get_media_formats(media_id: str, current_user: AuthUser = Depends(get_current_user)) -> list[dict]:
    data = _MEDIA_CACHE.get((current_user.user_id, media_id))
    if data is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media was not analyzed yet.")
    return data.get("formats", [])


@router.get("/downloads")
async def list_downloads(current_user: AuthUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> list[dict]:
    result = await db.execute(
        select(DownloadJob).where(DownloadJob.user_id == current_user.user_id).order_by(DownloadJob.created_at.desc())
    )
    return [_serialize_download(job) for job in result.scalars().all()]


@router.post("/downloads", response_model=DownloadJobResponse)
async def start_download(
    payload: DownloadRequestSchema,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DownloadJobResponse:
    try:
        resolve_destination(current_user.user_id, payload.destination)
    except StorageError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    if settings.storage_quota_bytes:
        used_bytes = await _get_user_storage_bytes(db, current_user.user_id)
        if used_bytes >= settings.storage_quota_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="Storage quota exceeded. Remove files or increase STORAGE_QUOTA_BYTES.",
            )

    user_repo = UserRepository(db)
    await user_repo.get_or_create(current_user.user_id, current_user.email)
    job_id = str(uuid4())
    selection = payload.selection or {}
    mode = str(selection.get("mode") or "video+audio")
    kind = "audio" if mode == "audio" else "video"
    if kind == "audio":
        audio_format = str(selection.get("audioFormat") or "m4a").lower()
        extension = audio_format if audio_format in {"mp3", "m4a", "wav", "flac"} else "m4a"
    else:
        container = str(selection.get("container") or "mp4").lower()
        extension = container if container in {"mp4", "webm"} else "mp4"
    quality = (
        selection.get("videoQuality")
        or selection.get("audioFormat")
        or "best"
    )
    job = DownloadJob(
        id=job_id,
        user_id=current_user.user_id,
        source_url=payload.sourceUrl,
        title=payload.title,
        creator=payload.creator,
        thumbnail_url=payload.thumbnailUrl,
        duration_sec=payload.durationSec,
        kind=kind,
        extension=extension,
        quality_label=str(quality),
        priority="normal",
        destination=payload.destination,
        filename=payload.filename,
        selection_json=json.dumps(selection),
        status="queued",
        progress=0.0,
        downloaded_bytes=0,
        total_bytes=None,
        speed_bps=None,
        eta_sec=None,
        file_path=None,
        error=None,
        created_at=datetime.now(timezone.utc),
        completed_at=None,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    await queue_download_job(job.id)
    return DownloadJobResponse(**_serialize_download(job))


@router.get("/downloads/{job_id}")
async def get_download(job_id: str, current_user: AuthUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> dict:
    result = await db.execute(
        select(DownloadJob).where(DownloadJob.id == job_id, DownloadJob.user_id == current_user.user_id)
    )
    job = result.scalar_one_or_none()
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Download job not found.")
    return _serialize_download(job)


@router.post("/downloads/{job_id}/pause")
async def pause_download(job_id: str, current_user: AuthUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> dict:
    result = await db.execute(
        select(DownloadJob).where(DownloadJob.id == job_id, DownloadJob.user_id == current_user.user_id)
    )
    job = result.scalar_one_or_none()
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Download job not found.")
    if job.status not in {"queued", "downloading", "processing"}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only queued or active downloads can be paused.",
        )
    job.status = "paused"
    await db.commit()
    stop_download_job(job_id, "paused")
    return _serialize_download(job)


@router.post("/downloads/{job_id}/resume")
async def resume_download(job_id: str, current_user: AuthUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> dict:
    result = await db.execute(
        select(DownloadJob).where(DownloadJob.id == job_id, DownloadJob.user_id == current_user.user_id)
    )
    job = result.scalar_one_or_none()
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Download job not found.")
    if job.status != "paused":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only paused downloads can be resumed.",
        )
    job.status = "queued"
    job.progress = 0.0
    job.downloaded_bytes = 0
    job.total_bytes = None
    job.speed_bps = 0
    job.eta_sec = 0
    job.completed_at = None
    await db.commit()
    await queue_download_job(job.id)
    return _serialize_download(job)


@router.post("/downloads/{job_id}/cancel")
async def cancel_download(job_id: str, current_user: AuthUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> dict:
    result = await db.execute(
        select(DownloadJob).where(DownloadJob.id == job_id, DownloadJob.user_id == current_user.user_id)
    )
    job = result.scalar_one_or_none()
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Download job not found.")
    if job.status not in {"queued", "downloading", "processing", "paused"}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only queued or active downloads can be cancelled.",
        )
    job.status = "cancelled"
    job.completed_at = datetime.now(timezone.utc)
    await db.commit()
    stop_download_job(job_id, "cancelled")
    return _serialize_download(job)


@router.post("/downloads/{job_id}/retry")
async def retry_download(job_id: str, current_user: AuthUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> dict:
    result = await db.execute(
        select(DownloadJob).where(DownloadJob.id == job_id, DownloadJob.user_id == current_user.user_id)
    )
    job = result.scalar_one_or_none()
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Download job not found.")
    if job.status != "failed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only failed downloads can be retried.",
        )
    job.status = "queued"
    job.progress = 0.0
    job.attempt_count = 0
    job.downloaded_bytes = 0
    job.total_bytes = None
    job.speed_bps = None
    job.eta_sec = None
    job.file_path = None
    job.error = None
    job.completed_at = None
    await db.commit()
    await queue_download_job(job.id)
    return _serialize_download(job)


@router.delete("/downloads/{job_id}")
async def remove_download(job_id: str, current_user: AuthUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> dict:
    result = await db.execute(
        select(DownloadJob).where(DownloadJob.id == job_id, DownloadJob.user_id == current_user.user_id)
    )
    job = result.scalar_one_or_none()
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Download job not found.")
    await db.delete(job)
    await db.commit()
    stop_download_job(job_id, "cancelled")
    return {"status": "removed", "id": job_id}


async def _resolve_owned_media_file(path: str, user_id: str, db: AsyncSession) -> Path:
    owned = False
    for model in (LibraryItem, HistoryItem, DownloadJob):
        result = await db.execute(
            select(model.id).where(model.user_id == user_id, model.file_path == path).limit(1)
        )
        if result.scalar_one_or_none() is not None:
            owned = True
            break
    if not owned:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media file not found.")

    user_root = user_storage_root(user_id)
    try:
        resolved_path = Path(path).resolve(strict=True)
        resolved_path.relative_to(user_root)
    except (OSError, RuntimeError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media file not found.") from exc
    if not resolved_path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media file not found.")
    return resolved_path


@router.post("/files/open-session")
async def create_file_open_session(
    payload: FileOpenSessionRequest,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    file_path = await _resolve_owned_media_file(payload.path, current_user.user_id, db)
    return {"ticket": create_file_access_ticket(current_user.user_id, str(file_path))}


@router.post("/files/download-session")
async def create_file_download_session(
    payload: FileOpenSessionRequest,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    file_path = await _resolve_owned_media_file(payload.path, current_user.user_id, db)
    ticket = create_file_access_ticket(current_user.user_id, str(file_path), disposition="attachment")
    return {"ticket": ticket}


@router.get("/files/open/{ticket}", include_in_schema=False)
async def open_media_file(ticket: str, db: AsyncSession = Depends(get_db)) -> FileResponse:
    try:
        user_id, path, disposition = read_file_access_ticket(ticket)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media file not found.") from exc

    file_path = await _resolve_owned_media_file(path, user_id, db)
    return FileResponse(
        file_path,
        filename=file_path.name,
        content_disposition_type=disposition,
        headers={
            "Cache-Control": "private, no-store",
            "Referrer-Policy": "no-referrer",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.get("/library")
async def list_library(
    kind: str | None = Query(default=None),
    search: str | None = Query(default=None),
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    query = select(LibraryItem).where(LibraryItem.user_id == current_user.user_id)
    if kind:
        if kind not in {"video", "audio"}:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Library kind must be 'video' or 'audio'.",
            )
        query = query.where(LibraryItem.kind == kind)
    if search:
        escaped_search = search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        query = query.where(
            LibraryItem.title.ilike(f"%{escaped_search}%", escape="\\")
            | LibraryItem.creator.ilike(f"%{escaped_search}%", escape="\\")
            | LibraryItem.filename.ilike(f"%{escaped_search}%", escape="\\")
        )
    result = await db.execute(query.order_by(LibraryItem.downloaded_at.desc()))
    return [_serialize_library(item) for item in result.scalars().all()]


@router.delete("/library/{library_id}")
async def remove_library_item(library_id: str, current_user: AuthUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> dict:
    result = await db.execute(
        select(LibraryItem).where(LibraryItem.id == library_id, LibraryItem.user_id == current_user.user_id)
    )
    item = result.scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Library item not found.")
    file_path = Path(item.file_path)
    user_root = user_storage_root(current_user.user_id)
    try:
        resolved_path = file_path.resolve()
        resolved_path.relative_to(user_root)
    except (OSError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The library file is outside the user's managed storage directory.",
        ) from exc
    file_path.unlink(missing_ok=True)
    await db.delete(item)
    await db.commit()
    return {"status": "removed", "id": library_id}


@router.get("/history")
async def list_history(current_user: AuthUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> list[dict]:
    result = await db.execute(
        select(HistoryItem).where(HistoryItem.user_id == current_user.user_id).order_by(HistoryItem.timestamp.desc())
    )
    return [_serialize_history(item) for item in result.scalars().all()]


@router.delete("/history/{history_id}")
async def remove_history_item(history_id: str, current_user: AuthUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> dict:
    result = await db.execute(
        select(HistoryItem).where(HistoryItem.id == history_id, HistoryItem.user_id == current_user.user_id)
    )
    item = result.scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="History item not found.")
    await db.delete(item)
    await db.commit()
    return {"status": "removed", "id": history_id}


@router.delete("/history")
async def clear_history(current_user: AuthUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> dict:
    await db.execute(delete(HistoryItem).where(HistoryItem.user_id == current_user.user_id))
    await db.commit()
    return {"status": "cleared"}


@router.get("/stats/overview")
async def get_overview(days: int = Query(default=7, ge=1, le=365), current_user: AuthUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> dict:
    today = datetime.now(timezone.utc).date()
    start_date = today - timedelta(days=days - 1)
    start_timestamp = datetime.combine(start_date, datetime.min.time(), tzinfo=timezone.utc)
    end_timestamp = datetime.combine(today + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc)
    totals = await db.execute(
        select(
            func.count(HistoryItem.id),
            func.sum(case((HistoryItem.status == "completed", 1), else_=0)),
            func.sum(case((HistoryItem.status == "failed", 1), else_=0)),
        ).where(
            HistoryItem.user_id == current_user.user_id,
            HistoryItem.timestamp >= start_timestamp,
            HistoryItem.timestamp < end_timestamp,
        )
    )
    count, completed, failed = totals.one()
    storage_bytes = await _get_user_storage_bytes(db, current_user.user_id)
    quota_bytes = settings.storage_quota_bytes or None
    activity_result = await db.execute(
        select(HistoryItem.timestamp, HistoryItem.kind).where(
            HistoryItem.user_id == current_user.user_id,
            HistoryItem.timestamp >= start_timestamp,
            HistoryItem.timestamp < end_timestamp,
        )
    )
    activity_counts: dict[str, dict[str, int]] = {}
    for timestamp, kind in activity_result.all():
        day = timestamp.date().isoformat()
        counts = activity_counts.setdefault(day, {"video": 0, "audio": 0})
        if kind in counts:
            counts[kind] += 1
    activity = [
        {
            "date": (start_date + timedelta(days=offset)).isoformat(),
            **activity_counts.get(
                (start_date + timedelta(days=offset)).isoformat(),
                {"video": 0, "audio": 0},
            ),
        }
        for offset in range(days)
    ]
    return {
        "totalDownloads": int(count or 0),
        "completed": int(completed or 0),
        "failed": int(failed or 0),
        "storageBytes": storage_bytes,
        "storageQuotaBytes": quota_bytes,
        "storageRemainingBytes": max(quota_bytes - storage_bytes, 0) if quota_bytes is not None else None,
        "storageDiskFreeBytes": storage_disk_free_bytes(),
        "activity": activity,
    }


async def _get_user_storage_bytes(db: AsyncSession, user_id: str) -> int:
    result = await db.execute(
        select(func.coalesce(func.sum(LibraryItem.size_bytes), 0)).where(LibraryItem.user_id == user_id)
    )
    return int(result.scalar_one())
