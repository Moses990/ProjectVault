"""Settings and history domain."""

from __future__ import annotations

from pathlib import Path

from app.db.database import connect
from app.services import clamp_page, clamp_limit, row_to_dict


def settings_get(db_path: Path | None = None) -> dict[str, object]:
    defaults: dict[str, object] = {"root_path": "", "scan_interval": 60, "theme": "system"}
    with connect(db_path) as conn:
        rows = conn.execute("SELECT key, value FROM system_settings").fetchall()
    values = defaults.copy()
    for row in rows:
        key = row["key"]
        value = row["value"]
        if key == "scan_interval" and value is not None:
            values[key] = int(value)
        else:
            values[key] = value or ""
    return values


def settings_put(
    data: dict[str, object],
    db_path: Path | None = None,
) -> dict[str, object]:
    root_path = str(data.get("root_path", ""))
    if root_path and not Path(root_path).exists():
        raise ValueError("root_path_invalid")
    scan_interval = int(data.get("scan_interval", 60))
    if scan_interval < 1:
        raise ValueError("scan_interval_invalid")
    theme = str(data.get("theme", "system"))
    values = {"root_path": root_path, "scan_interval": str(scan_interval), "theme": theme}
    with connect(db_path) as conn:
        for key, value in values.items():
            conn.execute(
                """
                INSERT INTO system_settings (key, value, category)
                VALUES (?, ?, 'general')
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
        filters.append("project_id = ?")
        params.append(project_id)
    where = f"WHERE {' AND '.join(filters)}" if filters else ""
    resolved_page = clamp_page(page)
    resolved_limit = clamp_limit(limit)
    offset = (resolved_page - 1) * resolved_limit
    with connect(db_path) as conn:
        total = int(
            conn.execute(
                f"SELECT COUNT(*) AS total FROM scan_history {where}",
                params,
            ).fetchone()["total"]
        )
        rows = conn.execute(
            f"""
            SELECT id, project_id, event_type, status, message, created_at, duration_ms,
                   scanner_version, affected_files
            FROM scan_history
            {where}
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
            """,
            [*params, resolved_limit, offset],
        ).fetchall()
    return [row_to_dict(row) for row in rows], total, resolved_page, resolved_limit
