from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from typing import Any

from app.core.config import settings


def _encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def create_file_access_ticket(user_id: str, file_path: str, disposition: str = "inline") -> str:
    if disposition not in {"inline", "attachment"}:
        raise ValueError("Unsupported file disposition.")
    payload = json.dumps(
        {
            "user_id": user_id,
            "file_path": file_path,
            "disposition": disposition,
            "expires_at": int(time.time()) + 60 * 60 * 24,
        },
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")
    encoded_payload = _encode(payload)
    signature = hmac.new(
        settings.secret_key.encode("utf-8"),
        encoded_payload.encode("ascii"),
        hashlib.sha256,
    ).digest()
    return f"{encoded_payload}.{_encode(signature)}"


def read_file_access_ticket(ticket: str) -> tuple[str, str, str]:
    try:
        encoded_payload, supplied_signature = ticket.split(".", 1)
        expected_signature = _encode(
            hmac.new(
                settings.secret_key.encode("utf-8"),
                encoded_payload.encode("ascii"),
                hashlib.sha256,
            ).digest()
        )
        if not hmac.compare_digest(supplied_signature, expected_signature):
            raise ValueError("Invalid file access ticket.")

        payload: Any = json.loads(_decode(encoded_payload))
        if not isinstance(payload, dict):
            raise ValueError("Invalid file access ticket.")
        user_id = payload.get("user_id")
        file_path = payload.get("file_path")
        disposition = payload.get("disposition")
        expires_at = payload.get("expires_at")
        if (
            not isinstance(user_id, str)
            or not isinstance(file_path, str)
            or disposition not in {"inline", "attachment"}
            or not isinstance(expires_at, int)
            or isinstance(expires_at, bool)
            or expires_at <= int(time.time())
        ):
            raise ValueError("Invalid or expired file access ticket.")
        return user_id, file_path, disposition
    except (UnicodeError, ValueError, TypeError) as exc:
        raise ValueError("Invalid or expired file access ticket.") from exc
