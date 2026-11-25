from __future__ import annotations

import base64
import hashlib
import json
import time
from typing import Any
from urllib.parse import urlsplit

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings

_TICKET_LIFETIME_SECONDS = 30 * 60
_ALLOWED_UPSTREAM_HEADERS = {"accept", "origin", "referer", "user-agent"}


def _cipher() -> Fernet:
    key = base64.urlsafe_b64encode(
        hashlib.sha256(settings.secret_key.encode("utf-8")).digest()
    )
    return Fernet(key)


def create_media_preview_ticket(
    url: str,
    headers: dict[str, str],
    mime_type: str,
) -> str:
    payload = json.dumps(
        {
            "url": url,
            "headers": {
                name.lower(): value[:2048]
                for name, value in headers.items()
                if isinstance(name, str)
                and name.lower() in _ALLOWED_UPSTREAM_HEADERS
                and isinstance(value, str)
                and "\r" not in value
                and "\n" not in value
            },
            "mime_type": mime_type[:128],
            "expires_at": int(time.time()) + _TICKET_LIFETIME_SECONDS,
        },
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")
    return _cipher().encrypt(payload).decode("ascii")


def read_media_preview_ticket(ticket: str) -> tuple[str, dict[str, str], str]:
    try:
        payload: Any = json.loads(
            _cipher().decrypt(
                ticket.encode("ascii"),
                ttl=_TICKET_LIFETIME_SECONDS,
            )
        )
        if not isinstance(payload, dict):
            raise ValueError("Invalid media preview ticket.")
        url = payload.get("url")
        headers = payload.get("headers")
        mime_type = payload.get("mime_type")
        expires_at = payload.get("expires_at")
        parsed = urlsplit(url) if isinstance(url, str) else None
        if (
            parsed is None
            or parsed.scheme not in {"http", "https"}
            or not parsed.hostname
            or parsed.username is not None
            or parsed.password is not None
            or not isinstance(headers, dict)
            or not isinstance(mime_type, str)
            or not isinstance(expires_at, int)
            or isinstance(expires_at, bool)
            or expires_at <= int(time.time())
        ):
            raise ValueError("Invalid or expired media preview ticket.")
        safe_headers = {
            name: value
            for name, value in headers.items()
            if name in _ALLOWED_UPSTREAM_HEADERS and isinstance(value, str)
        }
        return url, safe_headers, mime_type
    except (UnicodeError, ValueError, TypeError, InvalidToken) as exc:
        raise ValueError("Invalid or expired media preview ticket.") from exc
