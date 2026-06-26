"""Business logic layer — domain services split from core_api.py."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

from app.db.database import connect

MAX_LIMIT = 500


@dataclass(frozen=True)
class ResolvedAsset:
    file_id: str
    project_id: str
    path: Path
    media_type: str


def _parse_datetime(value: str) -> datetime:
    normalized = value.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(normalized)
    except ValueError:
        return datetime.strptime(value.split(".")[0], "%Y-%m-%d %H:%M:%S")


def clamp_page(page: int) -> int:
    return max(1, int(page))


def clamp_limit(limit: int) -> int:
    return max(1, min(int(limit), MAX_LIMIT))


def parse_json_list(value: str | None) -> list[object]:
    if not value:
        return []
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        return []
    return parsed if isinstance(parsed, list) else []


def row_to_dict(row: Any) -> dict[str, object]:
    return dict(row)


def ensure_project_exists(conn: Any, project_id: str) -> None:
    row = conn.execute("SELECT id FROM projects WHERE id = ?", (project_id,)).fetchone()
    if row is None:
        raise ValueError("project_not_found")
