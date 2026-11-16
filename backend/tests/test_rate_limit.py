from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.middleware import rate_limit
from app.middleware.rate_limit import RateLimitMiddleware


def test_rate_limit_returns_json_429_and_retry_after() -> None:
    app = FastAPI()
    app.add_middleware(RateLimitMiddleware, requests_per_minute=1)

    @app.get("/")
    async def root() -> dict[str, str]:
        return {"status": "ok"}

    client = TestClient(app)

    assert client.get("/").status_code == 200
    response = client.get("/")

    assert response.status_code == 429
    assert response.json()["detail"] == "Rate limit exceeded. Please try again later."
    assert response.headers["retry-after"] == "60"


def test_retry_after_reflects_remaining_window(monkeypatch) -> None:
    app = FastAPI()
    app.add_middleware(RateLimitMiddleware, requests_per_minute=1)

    @app.get("/")
    async def root() -> dict[str, str]:
        return {"status": "ok"}

    timestamps = iter([10.0, 69.5])
    monkeypatch.setattr(
        rate_limit,
        "time",
        SimpleNamespace(monotonic=lambda: next(timestamps)),
    )
    client = TestClient(app)

    assert client.get("/").status_code == 200
    response = client.get("/")

    assert response.status_code == 429
    assert response.headers["retry-after"] == "1"
