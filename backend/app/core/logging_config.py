from __future__ import annotations

import json
import logging
import logging.config
from datetime import datetime, timezone
from typing import Any


class JsonFormatter(logging.Formatter):
    _fields = (
        "event",
        "request_id",
        "method",
        "path",
        "status_code",
        "duration_ms",
        "job_id",
        "attempt",
        "kind",
        "error_type",
        "queued_jobs",
        "active_jobs",
        "recovered_jobs",
        "file_size_bytes",
        "reason",
    )

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": datetime.fromtimestamp(record.created, timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        for field in self._fields:
            if hasattr(record, field):
                payload[field] = getattr(record, field)
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False, default=str)


def configure_logging() -> None:
    logging.config.dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {"json": {"()": JsonFormatter}},
            "handlers": {
                "console": {
                    "class": "logging.StreamHandler",
                    "formatter": "json",
                    "stream": "ext://sys.stdout",
                }
            },
            "root": {"handlers": ["console"], "level": "INFO"},
            "loggers": {
                "uvicorn": {"handlers": [], "level": "INFO", "propagate": True},
                "uvicorn.error": {"handlers": [], "level": "INFO", "propagate": True},
                "uvicorn.access": {"handlers": [], "level": "WARNING", "propagate": True},
            },
        }
    )
