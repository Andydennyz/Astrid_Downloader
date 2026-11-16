import json
import logging

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from app.api import health as health_api
from app.core.logging_config import JsonFormatter
from app.services.dependency_checker import DependencyCheckResult
from app.main import app
from app.middleware.request_logging import RequestLoggingMiddleware

client = TestClient(app)


def test_health_endpoint() -> None:
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["service"] == "Astrid Downloader"


def test_root_endpoint() -> None:
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["service"] == "Astrid Downloader"


@pytest.mark.asyncio
async def test_readiness_endpoint_checks_database_dependencies_and_worker(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class FakeConnection:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args: object) -> None:
            return None

        async def execute(self, _query) -> None:
            return None

    class FakeEngine:
        def connect(self):
            return FakeConnection()

    monkeypatch.setattr(health_api, "engine", FakeEngine())
    monkeypatch.setattr(
        health_api,
        "check_dependencies",
        lambda: DependencyCheckResult(yt_dlp=True, ffmpeg=True, ffprobe=True),
    )
    monkeypatch.setattr(
        health_api,
        "download_worker_status",
        lambda: {"running": True, "queued_jobs": 2, "active_jobs": 1},
    )

    result = await health_api.readiness_check()

    assert result["status"] == "ready"
    assert result["database"] == "reachable"
    assert result["worker"]["queued_jobs"] == 2


@pytest.mark.asyncio
async def test_readiness_endpoint_returns_503_when_a_required_component_is_unavailable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(health_api, "engine", None)
    monkeypatch.setattr(
        health_api,
        "check_dependencies",
        lambda: DependencyCheckResult(yt_dlp=True, ffmpeg=False, ffprobe=True),
    )
    monkeypatch.setattr(
        health_api,
        "download_worker_status",
        lambda: {"running": True, "queued_jobs": 0, "active_jobs": 0},
    )

    with pytest.raises(HTTPException) as exc_info:
        await health_api.readiness_check()

    assert exc_info.value.status_code == 503
    assert exc_info.value.detail["dependencies"]["ffmpeg"] is False


def test_json_formatter_includes_structured_event_fields() -> None:
    record = logging.LogRecord(
        "astrid.worker",
        logging.INFO,
        __file__,
        1,
        "Download completed",
        (),
        None,
    )
    record.event = "download.job.completed"
    record.job_id = "job-1"
    record.file_size_bytes = 123

    payload = json.loads(JsonFormatter().format(record))

    assert payload["event"] == "download.job.completed"
    assert payload["job_id"] == "job-1"
    assert payload["file_size_bytes"] == 123


def test_request_logging_returns_and_logs_request_id(caplog: pytest.LogCaptureFixture) -> None:
    test_app = FastAPI()
    test_app.add_middleware(RequestLoggingMiddleware)

    @test_app.get("/")
    async def root() -> dict[str, str]:
        return {"status": "ok"}

    with caplog.at_level(logging.INFO, logger="astrid.http"):
        response = TestClient(test_app).get("/")

    request_log = next(record for record in caplog.records if record.name == "astrid.http")
    assert response.status_code == 200
    assert response.headers["x-request-id"] == request_log.request_id
    assert request_log.event == "http.request"
    assert request_log.status_code == 200
