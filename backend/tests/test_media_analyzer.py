from __future__ import annotations

import pytest
import yt_dlp

from app.services.media_analyzer import MediaAnalysisError, analyze_media_url


def test_analyze_media_url_returns_extracted_metadata(monkeypatch: pytest.MonkeyPatch) -> None:
    class FakeYoutubeDL:
        def __init__(self, options: dict):
            self.options = options

        def __enter__(self) -> "FakeYoutubeDL":
            return self

        def __exit__(self, *args: object) -> None:
            return None

        def extract_info(self, url: str, download: bool) -> dict:
            assert url == "https://youtu.be/example"
            assert download is False
            return {
                "id": "video-id",
                "title": "Example video",
                "uploader": "Example creator",
                "duration": 42,
                "timestamp": 1_767_225_600,
                "formats": [
                    {
                        "format_id": "18",
                        "ext": "mp4",
                        "vcodec": "avc1",
                        "acodec": "mp4a",
                    },
                ],
            }

    monkeypatch.setattr("app.services.media_analyzer.yt_dlp.YoutubeDL", FakeYoutubeDL)

    result = analyze_media_url("https://youtu.be/example")

    assert result["title"] == "Example video"
    assert result["creator"] == "Example creator"
    assert result["durationSec"] == 42
    assert result["uploadedAt"] == "2026-01-01T00:00:00+00:00"
    assert result["formats"][0]["formatId"] == "18"


def test_analyze_media_url_surfaces_extractor_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    class FakeYoutubeDL:
        def __init__(self, options: dict):
            pass

        def __enter__(self) -> "FakeYoutubeDL":
            return self

        def __exit__(self, *args: object) -> None:
            return None

        def extract_info(self, url: str, download: bool) -> None:
            raise yt_dlp.utils.DownloadError("video unavailable")

    monkeypatch.setattr("app.services.media_analyzer.yt_dlp.YoutubeDL", FakeYoutubeDL)

    with pytest.raises(MediaAnalysisError, match="video unavailable"):
        analyze_media_url("https://youtu.be/unavailable")
