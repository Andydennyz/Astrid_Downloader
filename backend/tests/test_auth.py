from datetime import datetime, timedelta, timezone

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec, rsa
from fastapi import HTTPException

from app.core.security import AuthUser, get_current_user, get_supabase_jwks, verify_supabase_access_token


@pytest.mark.asyncio
async def test_get_supabase_jwks_uses_public_signing_keys_endpoint(monkeypatch: pytest.MonkeyPatch) -> None:
    requested_urls: list[str] = []

    class FakeResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict:
            return {"keys": [{"kid": "test-kid"}]}

    class FakeAsyncClient:
        async def __aenter__(self) -> "FakeAsyncClient":
            return self

        async def __aexit__(self, *args: object) -> None:
            return None

        async def get(self, url: str, timeout: float) -> FakeResponse:
            requested_urls.append(url)
            assert timeout == 10.0
            return FakeResponse()

    monkeypatch.setattr("app.core.security.settings.supabase_url", "https://example.supabase.co/")
    monkeypatch.setattr("app.core.security.httpx.AsyncClient", FakeAsyncClient)

    result = await get_supabase_jwks()

    assert requested_urls == ["https://example.supabase.co/auth/v1/.well-known/jwks.json"]
    assert result == {"keys": [{"kid": "test-kid"}]}


@pytest.mark.asyncio
@pytest.mark.parametrize("algorithm", ["RS256", "ES256"])
async def test_verify_supabase_access_token_accepts_supabase_signing_algorithms(
    algorithm: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    if algorithm == "ES256":
        private_key = ec.generate_private_key(ec.SECP256R1())
        jwk = jwt.algorithms.ECAlgorithm.to_jwk(private_key.public_key(), as_dict=True)
    else:
        private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        jwk = jwt.algorithms.RSAAlgorithm.to_jwk(private_key.public_key(), as_dict=True)
    jwk.update({"kid": "test-key", "alg": algorithm})

    async def fake_get_jwks() -> dict:
        return {"keys": [jwk]}

    monkeypatch.setattr("app.core.security.get_supabase_jwks", fake_get_jwks)
    monkeypatch.setattr("app.core.security.settings.supabase_url", "https://example.supabase.co")
    token = jwt.encode(
        {
            "sub": "user-123",
            "email": "user@example.com",
            "role": "authenticated",
            "aud": "authenticated",
            "iss": "https://example.supabase.co/auth/v1",
            "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
        },
        private_key,
        algorithm=algorithm,
        headers={"kid": "test-key"},
    )

    result = await verify_supabase_access_token(token)

    assert result == AuthUser(user_id="user-123", email="user@example.com", role="authenticated")


@pytest.mark.asyncio
async def test_verify_supabase_access_token_rejects_jwk_algorithm_mismatch(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def fake_get_jwks() -> dict:
        return {"keys": [{"kid": "test-key", "alg": "ES256", "kty": "EC", "crv": "P-256"}]}

    monkeypatch.setattr("app.core.security.get_supabase_jwks", fake_get_jwks)
    monkeypatch.setattr("app.core.security.settings.supabase_url", "https://example.supabase.co")
    token = jwt.encode(
        {
            "sub": "user-123",
            "aud": "authenticated",
            "iss": "https://example.supabase.co/auth/v1",
            "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
        },
        rsa.generate_private_key(public_exponent=65537, key_size=2048),
        algorithm="RS256",
        headers={"kid": "test-key"},
    )

    with pytest.raises(HTTPException) as exc_info:
        await verify_supabase_access_token(token)

    assert exc_info.value.status_code == 401
    assert "does not match" in str(exc_info.value.detail)


@pytest.mark.asyncio
async def test_get_current_user_requires_bearer_token() -> None:
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(None)

    assert exc_info.value.status_code == 401
    assert "bearer" in str(exc_info.value.detail).lower()


@pytest.mark.asyncio
async def test_get_current_user_rejects_invalid_scheme() -> None:
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user("Token abc123")

    assert exc_info.value.status_code == 401
    assert "bearer" in str(exc_info.value.detail).lower()
