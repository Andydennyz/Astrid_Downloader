from __future__ import annotations

import shutil
from typing import Literal

from pydantic import BaseModel


class DependencyCheckResult(BaseModel):
    yt_dlp: bool
    ffmpeg: bool
    ffprobe: bool


def check_dependencies() -> DependencyCheckResult:
    return DependencyCheckResult(
        yt_dlp=shutil.which("yt-dlp") is not None,
        ffmpeg=shutil.which("ffmpeg") is not None,
        ffprobe=shutil.which("ffprobe") is not None,
    )
