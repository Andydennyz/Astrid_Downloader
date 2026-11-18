from __future__ import annotations

from urllib.parse import urlsplit

from pydantic import BaseModel, Field, field_validator, model_validator


class MediaAnalyzeRequest(BaseModel):
    url: str = Field(..., min_length=1)

    @field_validator("url", mode="before")
    @classmethod
    def trim_url(cls, value: str) -> str:
        return value.strip() if isinstance(value, str) else value

    @model_validator(mode="after")
    def require_absolute_http_url(self) -> "MediaAnalyzeRequest":
        parsed = urlsplit(self.url)
        if parsed.scheme not in {"http", "https"} or not parsed.hostname:
            raise ValueError("A valid absolute HTTP or HTTPS media URL is required.")
        return self


class FileOpenSessionRequest(BaseModel):
    path: str = Field(..., min_length=1)


class DeviceSavedRequest(BaseModel):
    filename: str = Field(..., min_length=1, max_length=255)

    @field_validator("filename")
    @classmethod
    def require_safe_relative_filename(cls, value: str) -> str:
        normalized = value.replace("\\", "/")
        parts = normalized.split("/")
        if (
            normalized.startswith("/")
            or any(part in {"", ".", ".."} or ":" in part for part in parts)
        ):
            raise ValueError("Filename must be a safe relative path.")
        return normalized


class FormatOptionSchema(BaseModel):
    formatId: str
    kind: str
    container: str
    height: int | None = None
    fps: float | None = None
    videoCodec: str | None = None
    audioCodec: str | None = None
    bitrateKbps: int | None = None
    sampleRateHz: int | None = None
    estimatedSizeBytes: int | None = None
    note: str | None = None


class MediaInfoResponse(BaseModel):
    id: str
    sourceUrl: str
    platform: str
    title: str
    creator: str
    durationSec: int
    thumbnailUrl: str
    uploadedAt: str
    description: str | None = None
    formats: list[FormatOptionSchema] = Field(default_factory=list)


class DownloadRequestSchema(BaseModel):
    sourceUrl: str
    title: str
    creator: str
    thumbnailUrl: str
    durationSec: int
    destination: str
    filename: str | None = None
    selection: dict = Field(default_factory=dict)


class DownloadJobResponse(BaseModel):
    id: str
    request: DownloadRequestSchema
    kind: str
    extension: str
    qualityLabel: str
    priority: str | None = None
    status: str
    progress: float
    downloadedBytes: int
    totalBytes: int | None = None
    speedBps: int | None = None
    etaSec: int | None = None
    filePath: str | None = None
    error: str | None = None
    createdAt: str
    completedAt: str | None = None
