from __future__ import annotations

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = "ok"
    service: str = "astrid-downloader"
    environment: str
    database_configured: bool


class MessageResponse(BaseModel):
    message: str


class AuthProfileResponse(BaseModel):
    id: str
    email: str | None = None
    role: str = "authenticated"


class PaginationMeta(BaseModel):
    total: int = 0
    page: int = 1
    page_size: int = 25


class PaginatedResponse(BaseModel):
    items: list[dict] = Field(default_factory=list)
    meta: PaginationMeta = Field(default_factory=PaginationMeta)
