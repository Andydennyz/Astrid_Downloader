from __future__ import annotations

import re
import shutil
from pathlib import Path

from app.core.config import settings


class StorageError(ValueError):
    pass


def storage_root() -> Path:
    configured = Path(settings.storage_path).expanduser()
    if configured.is_absolute():
        return configured.resolve()
    backend_root = Path(__file__).resolve().parents[2]
    return (backend_root / configured).resolve()


def user_storage_root(user_id: str) -> Path:
    safe_user_id = re.sub(r"[^A-Za-z0-9._-]+", "_", user_id).strip("._") or "user"
    return (storage_root() / safe_user_id).resolve()


def resolve_destination(user_id: str, destination: str) -> Path:
    root = storage_root()
    user_root = user_storage_root(user_id)
    raw_destination = destination.strip()

    if raw_destination == "~":
        relative_destination = Path()
    elif raw_destination.startswith("~/") or raw_destination.startswith("~\\"):
        relative_destination = Path(raw_destination[2:])
    else:
        supplied_path = Path(raw_destination).expanduser()
        if supplied_path.is_absolute():
            try:
                relative_destination = supplied_path.resolve().relative_to(user_root)
            except ValueError as exc:
                try:
                    relative_destination = supplied_path.resolve().relative_to(root)
                except ValueError:
                    raise StorageError(
                        "Destination must be inside the backend storage directory."
                    ) from exc
                if relative_destination.parts and relative_destination.parts[0] == user_root.name:
                    relative_destination = Path(*relative_destination.parts[1:])
        else:
            relative_destination = supplied_path

    if any(part == ".." for part in relative_destination.parts):
        raise StorageError("Destination cannot contain parent-directory traversal.")

    resolved = (user_root / relative_destination).resolve()
    try:
        resolved.relative_to(user_root)
    except ValueError as exc:
        raise StorageError("Destination must stay inside the user's storage directory.") from exc
    return resolved


def safe_filename(value: str | None, fallback: str) -> str:
    candidate = (value or fallback).replace("\\", "/").rsplit("/", 1)[-1].strip()
    candidate = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", candidate).strip(" .")
    if Path(candidate).suffix:
        candidate = Path(candidate).stem
    candidate = candidate.strip(" .") or "download"
    if candidate.split(".", 1)[0].upper() in {
        "CON", "PRN", "AUX", "NUL",
        *(f"COM{index}" for index in range(1, 10)),
        *(f"LPT{index}" for index in range(1, 10)),
    }:
        candidate = f"_{candidate}"
    return candidate[:180].rstrip(" .") or "download"


def cleanup_partial_output(output_path: Path) -> None:
    if not output_path.parent.exists():
        return
    for candidate in output_path.parent.glob(f"{output_path.stem}*"):
        if candidate.is_file() or candidate.is_symlink():
            candidate.unlink(missing_ok=True)


def storage_disk_free_bytes() -> int:
    root = storage_root()
    root.mkdir(parents=True, exist_ok=True)
    return shutil.disk_usage(root).free
