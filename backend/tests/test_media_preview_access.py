from __future__ import annotations

import pytest

from app.services.media_preview_access import (
    create_media_preview_ticket,
    read_media_preview_ticket,
)


def test_preview_ticket_is_encrypted_and_filters_unneeded_headers() -> None:
    stream_url = "https://cdn.example/video.mp4?signature=secret-value"
    ticket = create_media_preview_ticket(
        stream_url,
        {
            "User-Agent": "MediaDock",
            "Cookie": "private-cookie",
        },
        "video/mp4",
    )

    assert stream_url not in ticket
    assert "private-cookie" not in ticket
    assert read_media_preview_ticket(ticket) == (
        stream_url,
        {"user-agent": "MediaDock"},
        "video/mp4",
    )


def test_preview_ticket_rejects_tampering() -> None:
    ticket = create_media_preview_ticket(
        "https://cdn.example/video.mp4",
        {},
        "video/mp4",
    )

    with pytest.raises(ValueError, match="Invalid or expired"):
        read_media_preview_ticket(ticket[:-1] + ("A" if ticket[-1] != "A" else "B"))
