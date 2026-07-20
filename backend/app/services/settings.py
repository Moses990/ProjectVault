"""Settings and history domain."""

from __future__ import annotations

import os
from pathlib import Path

from app.db.database import connect
from app.services import clamp_page, clamp_limit, row_to_dict


def settings_get(db_path: Path | None = None) -> dict[str, object]:
    defaults: dict[str, object] = {
        "root_path": "",
        "scan_interval": 60,
        "auto_scan": True,
        "backup_retention": 10,
        "theme": "system",
        "onboarding_completed": False,
    }
    with connect(db_path) as conn:
        rows = conn.execute("SELECT key, value FROM system_settings").fetchall()
    values = defaults.copy()
    for row in rows:
        key = row["key"]
        value = row["value"]
        if key not in defaults:
            continue
        if key == "scan_interval" and value is not None:
            values[key] = int(value)
        elif key in ("auto_scan", "onboarding_completed"):
            values[key] = value.lower() not in ("false", "0", "no") if value else True
        elif key == "backup_retention" and value is not None:
            values[key] = int(value)
        else:
            values[key] = value or ""
    root_path = str(values["root_path"])
    values["root_path_accessible"] = bool(root_path and _is_readable_directory(Path(root_path)))
    return values


def _is_readable_directory(path: Path) -> bool:
    try:
        if not path.is_dir() or not os.access(path, os.R_OK):
            return False
        next(path.iterdir(), None)
        return True
    except OSError:
        return False


def _normalized_root_path(value: object) -> str:
    raw = str(value or "").strip()
    if not raw:
        raise ValueError("root_path_required")
    if len(raw) > 500:
        raise ValueError("root_path_too_long")
    try:
        path = Path(raw).expanduser().resolve(strict=True)
    except OSError as exc:
        raise ValueError("root_path_invalid") from exc
    if not _is_readable_directory(path):
        raise ValueError("root_path_unreadable")
    return str(path)


def _integer_setting(data: dict[str, object], key: str, default: int, minimum: int, maximum: int) -> int:
    try:
        value = int(data.get(key, default))
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{key}_invalid") from exc
    if value < minimum or value > maximum:
        raise ValueError(f"{key}_invalid")
    return value


def settings_put(
    data: dict[str, object],
    db_path: Path | None = None,
) -> dict[str, object]:
    root_path = _normalized_root_path(data.get("root_path", ""))
    scan_interval = _integer_setting(data, "scan_interval", 60, 1, 86400)
    theme = str(data.get("theme", "system"))
    if theme not in ("dark", "light", "system"):
        raise ValueError("theme_invalid")
    backup_retention = _integer_setting(data, "backup_retention", 10, 1, 100)
    values = {
        "root_path": root_path,
        "scan_interval": str(scan_interval),
        "theme": theme,
        "backup_retention": str(backup_retention),
        "auto_scan": str(bool(data.get("auto_scan", True))).lower(),
        "onboarding_completed": str(bool(data.get("onboarding_completed", False))).lower(),
    }
    with connect(db_path) as conn:
        for key, value in values.items():
            conn.execute(
                """
                INSERT INTO system_settings (key, value)
                VALUES (?, ?)
                ON CONFLICT(key) DO UPDATE SET
                    value = excluded.value,
                    updated_at = CURRENT_TIMESTAMP
                """,
                (key, value),
            )
    return settings_get(db_path)


def history_list(
    *,
    project_id: str | None = None,
    page: int = 1,
    limit: int = 50,
    db_path: Path | None = None,
) -> tuple[list[dict[str, object]], int, int, int]:
    filters: list[str] = []
    params: list[object] = []
    if project_id:
        filters.append("h.project_id = ?")
        params.append(project_id)
    where = f"WHERE {' AND '.join(filters)}" if filters else ""
    resolved_page = clamp_page(page)
    resolved_limit = clamp_limit(limit)
    offset = (resolved_page - 1) * resolved_limit
    with connect(db_path) as conn:
        total = int(
            conn.execute(
                f"SELECT COUNT(*) AS total FROM scan_history h {where}",
                params,
            ).fetchone()["total"]
        )
        rows = conn.execute(
            f"""
            SELECT h.id, h.project_id, p.name AS project_name, h.event_type, h.status,
                   h.message, h.created_at, h.duration_ms, h.scanner_version,
                   h.affected_files
            FROM scan_history h
            LEFT JOIN projects p ON p.id = h.project_id
            {where}
            ORDER BY h.created_at DESC, h.id DESC
            LIMIT ? OFFSET ?
            """,
            [*params, resolved_limit, offset],
        ).fetchall()
    return [row_to_dict(row) for row in rows], total, resolved_page, resolved_limit
