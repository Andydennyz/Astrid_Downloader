from __future__ import annotations

import pytest
import yt_dlp

from app.services.media_analyzer import (
    MediaAnalysisError,
    analyze_media_url,
    detect_platform,
    resolve_media_preview,
)


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


def test_resolve_media_preview_prefers_a_progressive_muxed_stream(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class FakeYoutubeDL:
        def __init__(self, options: dict):
            self.options = options
            assert options["skip_download"] is True

        def __enter__(self) -> "FakeYoutubeDL":
            return self

        def __exit__(self, *args: object) -> None:
            return None

        def extract_info(self, url: str, download: bool) -> dict:
            assert url == "https://youtube.com/watch?v=example"
            assert download is False
            return {
                "formats": [
                    {
                        "url": "https://cdn.example/video-only.mp4",
                        "protocol": "https",
                        "ext": "mp4",
                        "height": 1080,
                        "vcodec": "avc1",
                        "acodec": "none",
                    },
                    {
                        "url": "https://cdn.example/muxed.mp4",
                        "protocol": "https",
                        "ext": "mp4",
                        "height": 720,
                        "vcodec": "avc1",
                        "acodec": "mp4a",
                        "http_headers": {
                            "User-Agent": "MediaDock test",
                            "Cookie": "must-not-be-forwarded",
                        },
                    },
                ]
            }

    monkeypatch.setattr("app.services.media_analyzer.yt_dlp.YoutubeDL", FakeYoutubeDL)

    result = resolve_media_preview("https://youtube.com/watch?v=example", "video")

    assert result == {
        "url": "https://cdn.example/muxed.mp4",
        "headers": {
            "User-Agent": "MediaDock test",
            "Cookie": "must-not-be-forwarded",
        },
        "mimeType": "video/mp4",
    }


def test_resolve_media_preview_rejects_hls_only_sources(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class FakeYoutubeDL:
        def __init__(self, options: dict):
            pass

        def __enter__(self) -> "FakeYoutubeDL":
            return self

        def __exit__(self, *args: object) -> None:
            return None

        def extract_info(self, url: str, download: bool) -> dict:
            return {
                "formats": [
                    {
                        "url": "https://cdn.example/master.m3u8",
                        "protocol": "m3u8_native",
                        "ext": "mp4",
                        "vcodec": "avc1",
                        "acodec": "mp4a",
                    }
                ]
            }

    monkeypatch.setattr("app.services.media_analyzer.yt_dlp.YoutubeDL", FakeYoutubeDL)

    with pytest.raises(MediaAnalysisError, match="progressive stream"):
        resolve_media_preview("https://twitch.tv/example", "video")


def test_audio_preview_prefers_an_audio_only_format(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class FakeYoutubeDL:
        def __init__(self, options: dict):
            pass

        def __enter__(self) -> "FakeYoutubeDL":
            return self

        def __exit__(self, *args: object) -> None:
            return None

        def extract_info(self, url: str, download: bool) -> dict:
            return {
                "formats": [
                    {
                        "url": "https://cdn.example/video-with-audio.mp4",
                        "protocol": "https",
                        "ext": "mp4",
                        "height": 720,
                        "tbr": 1500,
                        "vcodec": "avc1",
                        "acodec": "mp4a",
                    },
                    {
                        "url": "https://cdn.example/audio.m4a",
                        "protocol": "https",
                        "ext": "m4a",
                        "tbr": 128,
                        "vcodec": "none",
                        "acodec": "mp4a",
                    },
                ]
            }

    monkeypatch.setattr("app.services.media_analyzer.yt_dlp.YoutubeDL", FakeYoutubeDL)

    result = resolve_media_preview("https://soundcloud.com/example/track", "audio")

    assert result["url"] == "https://cdn.example/audio.m4a"
    assert result["mimeType"] == "audio/mp4"


@pytest.mark.parametrize(
    ("url", "expected_platform"),
    [
        ("https://www.facebook.com/watch/?v=123", "facebook"),
        ("https://www.instagram.com/reel/abc123/", "instagram"),
        ("https://pin.it/abc123", "pinterest"),
        ("https://www.tiktok.com/@creator/video/123", "tiktok"),
        ("https://x.com/creator/status/123", "x"),
        ("https://notinstagram.com/reel/abc123/", "other"),
    ],
)
def test_detect_platform_uses_host_boundaries(url: str, expected_platform: str) -> None:
    assert detect_platform(url) == expected_platform


def test_format_height_uses_short_edge_for_portrait_video() -> None:
    from app.services.media_analyzer import _format_formats

    formats = _format_formats(
        {
            "formats": [
                {
                    "format_id": "portrait",
                    "width": 1080,
                    "height": 1920,
                    "vcodec": "av01",
                    "acodec": "none",
                }
            ]
        }
    )

    assert formats[0]["height"] == 1080


def test_installed_yt_dlp_has_extractors_for_requested_social_sites() -> None:
    from yt_dlp.extractor import gen_extractors

    extractors = [extractor for extractor in gen_extractors() if extractor.IE_NAME != "generic"]
    for url in (
        "https://www.facebook.com/watch/?v=123456789",
        "https://www.instagram.com/reel/abc123/",
        "https://www.pinterest.com/pin/123456789/",
    ):
        assert any(extractor.suitable(url) for extractor in extractors), url
