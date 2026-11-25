from __future__ import annotations

import ipaddress
import json
import re
import socket
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urljoin, urlsplit
from uuid import uuid4

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy import case, delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import AuthUser, get_current_user_or_guest
from app.core.config import settings
from app.database.connection import get_db
from app.database.models import DownloadJob, HistoryItem, LibraryItem, User
from app.repositories.user_repository import UserRepository
from app.schemas.media import DeviceSavedRequest, DownloadJobResponse, DownloadRequestSchema, FileOpenSessionRequest, MediaAnalyzeRequest, MediaInfoResponse, MediaPreviewRequest
from app.services.downloader import queue_download_job, stop_download_job
from app.services.file_access import create_file_access_ticket, read_file_access_ticket
from app.services.media_preview_access import (
    create_media_preview_ticket,
    read_media_preview_ticket,
)
from app.services.media_analyzer import (
    MediaAnalysisError,
    analyze_media_url,
    detect_platform,
    resolve_media_preview,
)
from app.services.storage import StorageError, resolve_destination, storage_disk_free_bytes, user_storage_root

router = APIRouter(tags=["media"])

_MEDIA_CACHE: dict[tuple[str, str], dict] = {}
_GUEST_MEDIA_DOMAINS = (
    "youtube.com",
    "youtu.be",
    "vimeo.com",
    "soundcloud.com",
    "twitch.tv",
    "bandcamp.com",
    "facebook.com",
    "fb.watch",
    "instagram.com",
    "instagr.am",
    "pinterest.com",
    "pin.it",
    "tiktok.com",
    "twitter.com",
    "x.com",
    "reddit.com",
    "redd.it",
    "dailymotion.com",
    "dai.ly",
)


def _validate_public_stream_host(url: str) -> None:
    parsed = urlsplit(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ValueError("Invalid media stream URL.")
    try:
        try:
            addresses = {ipaddress.ip_address(parsed.hostname)}
        except ValueError:
            addresses = {
                ipaddress.ip_address(result[4][0])
                for result in socket.getaddrinfo(
                    parsed.hostname,
                    parsed.port or (443 if parsed.scheme == "https" else 80),
                    type=socket.SOCK_STREAM,
                )
            }
    except (OSError, ValueError) as exc:
        raise ValueError("Could not resolve the media host.") from exc
    if not addresses or any(not address.is_global for address in addresses):
        raise ValueError("Media previews cannot access private network hosts.")


async def _open_public_stream(
    client: httpx.AsyncClient,
    url: str,
    headers: dict[str, str],
) -> httpx.Response:
    for _ in range(6):
        _validate_public_stream_host(url)
        upstream = await client.send(
            client.build_request("GET", url, headers=headers),
            stream=True,
        )
        if upstream.status_code not in {301, 302, 303, 307, 308}:
            return upstream
        location = upstream.headers.get("location")
        await upstream.aclose()
        if not location:
            return upstream
        url = urljoin(url, location)
    raise httpx.TooManyRedirects("Media host redirected too many times.")


def _validate_guest_media_url(current_user: AuthUser, url: str) -> None:
    if current_user.role != "guest":
        return

    try:
        parsed = urlsplit(url)
        hostname = (parsed.hostname or "").rstrip(".").lower()
        port = parsed.port
    except ValueError:
        hostname = ""
        port = None
        parsed = None
    is_supported = any(
        hostname == domain or hostname.endswith(f".{domain}")
        for domain in _GUEST_MEDIA_DOMAINS
    )
    if (
        parsed is None
        or parsed.scheme not in {"http", "https"}
        or (port is not None and port not in {80, 443})
        or not is_supported
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Guest downloads support public YouTube, Vimeo, SoundCloud, Twitch, "
                "Bandcamp, Facebook, Instagram, Pinterest, TikTok, X, Reddit, and "
                "Dailymotion links. Sign in to use other supported sites."
            ),
        )


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
        "filePath": item.file_path or None,
        "sourceUrl": item.source_url,
        "platform": "other",
    }


def _serialize_history(
    item: HistoryItem,
    library_item: LibraryItem | None = None,
) -> dict:
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
        "libraryId": library_item.id if library_item is not None else None,
        "filename": library_item.filename if library_item is not None else None,
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
    return {"valid": True, "platform": detect_platform(url)}


@router.post("/media/analyze", response_model=MediaInfoResponse)
async def analyze_media(payload: MediaAnalyzeRequest, current_user: AuthUser = Depends(get_current_user_or_guest)) -> MediaInfoResponse:
    _validate_guest_media_url(current_user, payload.url)
    try:
        data = analyze_media_url(payload.url)
    except MediaAnalysisError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    _MEDIA_CACHE[(current_user.user_id, str(data["id"]))] = data
    return MediaInfoResponse(**data)


@router.post("/media/{media_id}/preview")
async def create_media_preview(
    media_id: str,
    payload: MediaPreviewRequest,
    current_user: AuthUser = Depends(get_current_user_or_guest),
) -> dict:
    data = _MEDIA_CACHE.get((current_user.user_id, media_id))
    if data is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Media was not analyzed yet.",
        )
    if detect_platform(data["sourceUrl"]) == "other":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "Only supported platform pages can be streamed through the backend. "
                "Direct media URLs can be played directly in the app."
            ),
        )
    try:
        preview = resolve_media_preview(data["sourceUrl"], payload.kind)
    except MediaAnalysisError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    ticket = create_media_preview_ticket(
        preview["url"],
        preview["headers"],
        preview["mimeType"],
    )
    return {
        "ticket": ticket,
        "title": data["title"],
        "element": payload.kind,
        "isHls": False,
    }


@router.get("/media/preview-stream/{ticket}", include_in_schema=False)
async def stream_media_preview(ticket: str, request: Request) -> StreamingResponse:
    try:
        stream_url, upstream_headers, mime_type = read_media_preview_ticket(ticket)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Media preview expired. Open the preview again.",
        ) from exc

    range_header = request.headers.get("range")
    if range_header:
        if len(range_header) > 128 or not re.fullmatch(r"bytes=\d*-\d*", range_header):
            raise HTTPException(
                status_code=status.HTTP_416_REQUESTED_RANGE_NOT_SATISFIABLE,
                detail="Only a single byte range can be previewed.",
            )
        upstream_headers["range"] = range_header
    client = httpx.AsyncClient(
        timeout=httpx.Timeout(connect=20, read=None, write=20, pool=10),
        trust_env=False,
    )
    try:
        upstream = await _open_public_stream(client, stream_url, upstream_headers)
    except (httpx.HTTPError, ValueError) as exc:
        await client.aclose()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The media host could not start the preview stream.",
        ) from exc

    if upstream.status_code not in {200, 206}:
        await upstream.aclose()
        await client.aclose()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"The media host returned HTTP {upstream.status_code}.",
        )

    response_headers = {
        "Content-Type": mime_type,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
    }
    for header in (
        "accept-ranges",
        "content-length",
        "content-range",
        "content-encoding",
    ):
        if header in upstream.headers:
            response_headers[header.title()] = upstream.headers[header]

    async def stream_body():
        try:
            async for chunk in upstream.aiter_raw():
                yield chunk
        finally:
            await upstream.aclose()
            await client.aclose()

    return StreamingResponse(
        stream_body(),
        status_code=upstream.status_code,
        headers=response_headers,
    )


@router.get("/media/{media_id}/formats")
async def get_media_formats(media_id: str, current_user: AuthUser = Depends(get_current_user_or_guest)) -> list[dict]:
    data = _MEDIA_CACHE.get((current_user.user_id, media_id))
    if data is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media was not analyzed yet.")
    return data.get("formats", [])


@router.get("/downloads")
async def list_downloads(current_user: AuthUser = Depends(get_current_user_or_guest), db: AsyncSession = Depends(get_db)) -> list[dict]:
    result = await db.execute(
        select(DownloadJob).where(DownloadJob.user_id == current_user.user_id).order_by(DownloadJob.created_at.desc())
    )
    return [_serialize_download(job) for job in result.scalars().all()]


@router.post("/downloads", response_model=DownloadJobResponse)
async def start_download(
    payload: DownloadRequestSchema,
    current_user: AuthUser = Depends(get_current_user_or_guest),
    db: AsyncSession = Depends(get_db),
) -> DownloadJobResponse:
    _validate_guest_media_url(current_user, payload.sourceUrl)
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
    await user_repo.get_or_create(
        current_user.user_id,
        current_user.email,
        touch_guest_session=current_user.role == "guest",
    )
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
async def get_download(job_id: str, current_user: AuthUser = Depends(get_current_user_or_guest), db: AsyncSession = Depends(get_db)) -> dict:
    result = await db.execute(
        select(DownloadJob).where(DownloadJob.id == job_id, DownloadJob.user_id == current_user.user_id)
    )
    job = result.scalar_one_or_none()
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Download job not found.")
    return _serialize_download(job)


@router.post("/downloads/{job_id}/pause")
async def pause_download(job_id: str, current_user: AuthUser = Depends(get_current_user_or_guest), db: AsyncSession = Depends(get_db)) -> dict:
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
async def resume_download(job_id: str, current_user: AuthUser = Depends(get_current_user_or_guest), db: AsyncSession = Depends(get_db)) -> dict:
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
async def cancel_download(job_id: str, current_user: AuthUser = Depends(get_current_user_or_guest), db: AsyncSession = Depends(get_db)) -> dict:
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
async def retry_download(job_id: str, current_user: AuthUser = Depends(get_current_user_or_guest), db: AsyncSession = Depends(get_db)) -> dict:
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
async def remove_download(job_id: str, current_user: AuthUser = Depends(get_current_user_or_guest), db: AsyncSession = Depends(get_db)) -> dict:
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


@router.post("/downloads/{job_id}/device-saved")
async def mark_download_saved_to_device(
    job_id: str,
    payload: DeviceSavedRequest,
    current_user: AuthUser = Depends(get_current_user_or_guest),
    db: AsyncSession = Depends(get_db),
) -> dict:
    job = await db.scalar(
        select(DownloadJob).where(
            DownloadJob.id == job_id,
            DownloadJob.user_id == current_user.user_id,
        )
    )
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Download job not found.")
    if job.status != "completed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only completed downloads can be saved to the device.",
        )

    path = job.file_path
    if path:
        try:
            managed_path = _resolve_managed_path(path, current_user.user_id)
        except (OSError, RuntimeError, ValueError) as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="The download file is outside the user's managed storage directory.",
            ) from exc
        managed_path.unlink(missing_ok=True)

    job.file_path = None
    library = await db.get(LibraryItem, f"lib_{job.id}")
    if library is not None and library.user_id == current_user.user_id:
        library.file_path = ""
        library.filename = payload.filename
    history = await db.get(HistoryItem, f"hist_{job.id}")
    if history is not None and history.user_id == current_user.user_id:
        history.file_path = None
    await db.commit()
    return {"status": "saved", "id": job_id, "filename": payload.filename}


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

    try:
        resolved_path = _resolve_managed_path(path, user_id, strict=True)
    except (OSError, RuntimeError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media file not found.") from exc
    if not resolved_path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media file not found.")
    return resolved_path


def _resolve_managed_path(path: str, user_id: str, strict: bool = False) -> Path:
    resolved_path = Path(path).resolve(strict=strict)
    resolved_path.relative_to(user_storage_root(user_id))
    return resolved_path


async def _remove_library_record(
    item: LibraryItem,
    user_id: str,
    db: AsyncSession,
) -> None:
    if item.file_path:
        try:
            path = _resolve_managed_path(item.file_path, user_id)
        except (OSError, RuntimeError, ValueError) as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="The library file is outside the user's managed storage directory.",
            ) from exc
        path.unlink(missing_ok=True)
    await db.delete(item)


@router.post("/files/open-session")
async def create_file_open_session(
    payload: FileOpenSessionRequest,
    current_user: AuthUser = Depends(get_current_user_or_guest),
    db: AsyncSession = Depends(get_db),
) -> dict:
    file_path = await _resolve_owned_media_file(payload.path, current_user.user_id, db)
    return {"ticket": create_file_access_ticket(current_user.user_id, str(file_path))}


@router.post("/files/download-session")
async def create_file_download_session(
    payload: FileOpenSessionRequest,
    current_user: AuthUser = Depends(get_current_user_or_guest),
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
    current_user: AuthUser = Depends(get_current_user_or_guest),
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
async def remove_library_item(library_id: str, current_user: AuthUser = Depends(get_current_user_or_guest), db: AsyncSession = Depends(get_db)) -> dict:
    result = await db.execute(
        select(LibraryItem).where(LibraryItem.id == library_id, LibraryItem.user_id == current_user.user_id)
    )
    item = result.scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Library item not found.")
    await _remove_library_record(item, current_user.user_id, db)
    if library_id.startswith("lib_"):
        linked_history = await db.get(HistoryItem, f"hist_{library_id[4:]}")
        if linked_history is not None and linked_history.user_id == current_user.user_id:
            await db.delete(linked_history)
        linked_job = await db.get(DownloadJob, library_id[4:])
        if linked_job is not None and linked_job.user_id == current_user.user_id:
            linked_job.file_path = None
    await db.commit()
    return {"status": "removed", "id": library_id}


@router.get("/history")
async def list_history(current_user: AuthUser = Depends(get_current_user_or_guest), db: AsyncSession = Depends(get_db)) -> list[dict]:
    result = await db.execute(
        select(HistoryItem).where(HistoryItem.user_id == current_user.user_id).order_by(HistoryItem.timestamp.desc())
    )
    items = result.scalars().all()
    library_ids = [
        f"lib_{item.id[5:]}"
        for item in items
        if item.id.startswith("hist_")
    ]
    library_items = {}
    if library_ids:
        library_result = await db.execute(
            select(LibraryItem).where(
                LibraryItem.user_id == current_user.user_id,
                LibraryItem.id.in_(library_ids),
            )
        )
        library_items = {item.id: item for item in library_result.scalars().all()}
    return [
        _serialize_history(
            item,
            library_items.get(f"lib_{item.id[5:]}")
            if item.id.startswith("hist_")
            else None,
        )
        for item in items
    ]


@router.delete("/history/{history_id}")
async def remove_history_item(history_id: str, current_user: AuthUser = Depends(get_current_user_or_guest), db: AsyncSession = Depends(get_db)) -> dict:
    result = await db.execute(
        select(HistoryItem).where(HistoryItem.id == history_id, HistoryItem.user_id == current_user.user_id)
    )
    item = result.scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="History item not found.")
    if history_id.startswith("hist_"):
        linked_library = await db.get(LibraryItem, f"lib_{history_id[5:]}")
        if linked_library is not None and linked_library.user_id == current_user.user_id:
            await _remove_library_record(linked_library, current_user.user_id, db)
        linked_job = await db.get(DownloadJob, history_id[5:])
        if linked_job is not None and linked_job.user_id == current_user.user_id:
            if linked_job.file_path:
                try:
                    path = _resolve_managed_path(linked_job.file_path, current_user.user_id)
                except (OSError, RuntimeError, ValueError) as exc:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="The download file is outside the user's managed storage directory.",
                    ) from exc
                path.unlink(missing_ok=True)
            await db.delete(linked_job)
    await db.delete(item)
    await db.commit()
    return {"status": "removed", "id": history_id}


@router.delete("/history")
async def clear_history(current_user: AuthUser = Depends(get_current_user_or_guest), db: AsyncSession = Depends(get_db)) -> dict:
    await db.execute(delete(HistoryItem).where(HistoryItem.user_id == current_user.user_id))
    await db.commit()
    return {"status": "cleared"}


@router.delete("/guest-session")
async def clear_guest_session(
    current_user: AuthUser = Depends(get_current_user_or_guest),
    db: AsyncSession = Depends(get_db),
) -> dict:
    if current_user.role != "guest":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only guest sessions can be cleared this way.",
        )

    jobs = (
        await db.scalars(
            select(DownloadJob).where(DownloadJob.user_id == current_user.user_id)
        )
    ).all()
    paths = {job.file_path for job in jobs if job.file_path}
    library_paths = await db.scalars(
        select(LibraryItem.file_path).where(
            LibraryItem.user_id == current_user.user_id,
            LibraryItem.file_path != "",
        )
    )
    paths.update(path for path in library_paths.all() if path)
    history_paths = await db.scalars(
        select(HistoryItem.file_path).where(
            HistoryItem.user_id == current_user.user_id,
            HistoryItem.file_path.is_not(None),
        )
    )
    paths.update(path for path in history_paths.all() if path)
    for job in jobs:
        stop_download_job(job.id, "cancelled")
    for managed_file in paths:
        try:
            path = _resolve_managed_path(managed_file, current_user.user_id)
        except (OSError, RuntimeError, ValueError) as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A guest download file is outside its managed storage directory.",
            ) from exc
        path.unlink(missing_ok=True)

    await db.execute(delete(HistoryItem).where(HistoryItem.user_id == current_user.user_id))
    await db.execute(delete(LibraryItem).where(LibraryItem.user_id == current_user.user_id))
    await db.execute(delete(DownloadJob).where(DownloadJob.user_id == current_user.user_id))
    guest_user = await db.get(User, current_user.user_id)
    if guest_user is not None:
        await db.delete(guest_user)
    await db.commit()
    return {"status": "cleared"}


@router.get("/stats/overview")
async def get_overview(days: int = Query(default=7, ge=1, le=365), current_user: AuthUser = Depends(get_current_user_or_guest), db: AsyncSession = Depends(get_db)) -> dict:
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
    storage_bytes = await _get_user_library_bytes(db, current_user.user_id)
    quota_bytes = settings.storage_quota_bytes or None
    backend_storage_bytes = await _get_user_storage_bytes(db, current_user.user_id)
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
        "storageRemainingBytes": max(quota_bytes - backend_storage_bytes, 0) if quota_bytes is not None else None,
        "storageDiskFreeBytes": storage_disk_free_bytes(),
        "activity": activity,
    }


async def _get_user_storage_bytes(db: AsyncSession, user_id: str) -> int:
    result = await db.execute(
        select(func.coalesce(func.sum(LibraryItem.size_bytes), 0)).where(
            LibraryItem.user_id == user_id,
            LibraryItem.file_path != "",
        )
    )
    return int(result.scalar_one())


async def _get_user_library_bytes(db: AsyncSession, user_id: str) -> int:
    result = await db.execute(
        select(func.coalesce(func.sum(LibraryItem.size_bytes), 0)).where(
            LibraryItem.user_id == user_id
        )
    )
    return int(result.scalar_one())
