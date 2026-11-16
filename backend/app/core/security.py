from __future__ import annotations

from typing import Any

import httpx
import jwt
from fastapi import Depends, Header, HTTPException, status
from pydantic import BaseModel

from app.core.config import settings


class AuthUser(BaseModel):
    user_id: str
    email: str | None = None
    role: str = "authenticated"


async def get_supabase_jwks() -> dict[str, Any]:
    if not settings.supabase_url:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase URL is not configured.",
        )

    jwks_url = f"{settings.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
    async with httpx.AsyncClient() as client:
        response = await client.get(jwks_url, timeout=10.0)
        response.raise_for_status()
        payload = response.json()

    keys = payload.get("keys") or []
    if not keys:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase JWKS is empty.",
        )
    return payload


def _resolve_public_key(
    kid: str | None,
    algorithm: str | None,
    jwks: dict[str, Any],
) -> tuple[Any, str]:
    if not kid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="JWT missing key id.",
        )

    supported_key_types = {"RS256": "RSA", "ES256": "EC"}
    expected_key_type = supported_key_types.get(algorithm or "")
    if expected_key_type is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="JWT signing algorithm is not trusted by Supabase.",
        )

    for key in jwks.get("keys", []):
        if key.get("kid") == kid:
            if key.get("alg") != algorithm or key.get("kty") != expected_key_type:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="JWT signing algorithm does not match the Supabase key.",
                )
            if algorithm == "ES256" and key.get("crv") != "P-256":
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Supabase ES256 keys must use the P-256 curve.",
                )
            try:
                key_algorithm = (
                    jwt.algorithms.RSAAlgorithm
                    if algorithm == "RS256"
                    else jwt.algorithms.ECAlgorithm
                )
                return key_algorithm.from_jwk(key), algorithm
            except (jwt.PyJWTError, TypeError, ValueError) as exc:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Supabase signing key is invalid.",
                ) from exc

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="JWT key is not trusted by Supabase.",
    )


async def verify_supabase_access_token(token: str) -> AuthUser:
    try:
        unverified = jwt.get_unverified_header(token)
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid JWT format.") from exc

    jwks = await get_supabase_jwks()
    public_key, algorithm = _resolve_public_key(
        unverified.get("kid"),
        unverified.get("alg"),
        jwks,
    )
    issuer = f"{settings.supabase_url.rstrip('/')}/auth/v1"

    try:
        payload = jwt.decode(
            token,
            key=public_key,
            algorithms=[algorithm],
            audience="authenticated",
            issuer=issuer,
            options={"require": ["exp", "sub"]},
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Supabase token validation failed.",
        ) from exc

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token missing user id.")

    return AuthUser(
        user_id=str(user_id),
        email=payload.get("email"),
        role=str(payload.get("role") or "authenticated"),
    )


async def get_current_user(
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> AuthUser:
    if not authorization:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token.")

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Bearer token is required.")

    return await verify_supabase_access_token(token)


async def get_current_user_id(
    current_user: AuthUser = Depends(get_current_user),
) -> str:
    return current_user.user_id
