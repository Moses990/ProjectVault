"""Project domain: listing, overview, favorites, AI metadata."""

from __future__ import annotations

import json
from pathlib import Path

from app.core.config import resolve_runtime_database
from app.db.database import connect
from app.db.schema import CURRENT_SCHEMA_VERSION
from app.services import clamp_limit, clamp_page, ensure_project_exists, parse_json_list, row_to_dict
from app.services.system import scanner_status


def dashboard_metrics(db_path: Path | None = None) -> dict[str, int]:
    with connect(db_path) as conn:
        row = conn.execute(
            """
            SELECT COUNT(*) AS project_total,
                   COALESCE(SUM(cad_count), 0) AS cad_total,
                   COALESCE(SUM(material_count), 0) AS material_total
            FROM projects
            """
        ).fetchone()
    return {
        "project_total": int(row["project_total"]),
        "cad_total": int(row["cad_total"]),
        "material_total": int(row["material_total"]),
    }


def recent_projects(limit: int = 10, db_path: Path | None = None) -> list[dict[str, object]]:
    with connect(db_path) as conn:
        rows = conn.execute(
            """
            SELECT id, name, phase, last_updated_at, file_count
            FROM projects
            ORDER BY COALESCE(last_updated_at, created_at) DESC, name ASC
            LIMIT ?
            """,
            (clamp_limit(limit),),
        ).fetchall()
    return [row_to_dict(row) for row in rows]


def dashboard_summary(db_path: Path | None = None) -> dict[str, object]:
    """Return the read-only data needed to render the Dashboard in one request."""
    runtime = resolve_runtime_database()
    activity: dict[str, object] = {"status": "ready", "items": []}
    with connect(db_path) as conn:
        metrics = conn.execute(
            """
            SELECT
              (SELECT COUNT(*) FROM projects) AS projects,
              (SELECT COUNT(*) FROM files) AS indexed_files,
              (SELECT COUNT(*) FROM drawings) AS drawings,
              (SELECT COUNT(*) FROM materials) AS materials
            """
        ).fetchone()
        recent_rows = conn.execute(
            """
            SELECT id, name, status, file_count, cad_count, material_count, last_updated_at
            FROM projects
            ORDER BY CASE WHEN last_updated_at IS NULL THEN 1 ELSE 0 END,
                     last_updated_at DESC, created_at DESC, name ASC
            LIMIT 8
            """
        ).fetchall()
        settings_rows = conn.execute(
            """
            SELECT key, value FROM system_settings
            WHERE key IN ('root_path', 'scan_interval', 'auto_scan')
            """
        ).fetchall()
        integrity = str(conn.execute("PRAGMA integrity_check").fetchone()[0]).lower()
        schema_version = int(conn.execute("PRAGMA user_version").fetchone()[0])
        try:
            activity_rows = conn.execute(
                """
                SELECT h.id, h.project_id, p.name AS project_name, h.event_type, h.status,
                       h.message, h.created_at, h.duration_ms, h.scanner_version,
                       h.affected_files
                FROM scan_history h
                LEFT JOIN projects p ON p.id = h.project_id
                ORDER BY h.created_at DESC, h.id DESC
                LIMIT 5
                """
            ).fetchall()
            activity["items"] = [row_to_dict(row) for row in activity_rows]
        except Exception:
            activity = {"status": "unavailable", "items": [], "reason": "history_query_failed"}

    settings = {str(row["key"]): str(row["value"] or "") for row in settings_rows}
    root_value = settings.get("root_path", "").strip()
    root_path = Path(root_value) if root_value else None
    root_accessible = bool(root_path and root_path.is_dir())
    auto_scan_enabled = settings.get("auto_scan", "true").lower() not in {"false", "0", "no"}
    interval = int(settings.get("scan_interval", "60") or 60)
    index_status = "healthy" if integrity == "ok" and schema_version == CURRENT_SCHEMA_VERSION else "warning"
    return {
        "stats": {key: int(metrics[key]) for key in ("projects", "indexed_files", "drawings", "materials")},
        "recent_projects": [row_to_dict(row) for row in recent_rows],
        "workspace": {
            "root_path": root_value,
            "root_path_accessible": root_accessible,
            "auto_scan_effective": auto_scan_enabled and root_accessible,
            "scan_interval_effective": interval if auto_scan_enabled and root_accessible else None,
            "index_status": index_status,
            "runtime_mode": runtime.mode,
            "database_source": runtime.source,
            "scanner": scanner_status(),
        },
        "recent_activity": activity,
    }


def list_projects(
    *,
    q: str | None = None,
    project_type: str | None = None,
    phase: str | None = None,
    page: int = 1,
    limit: int = 50,
    sort_by: str = "last_updated_at",
    order: str = "desc",
    db_path: Path | None = None,
) -> tuple[list[dict[str, object]], int, int, int]:
    sort_columns = {
        "name": "p.name",
        "type": "p.type",
        "phase": "p.phase",
        "last_updated_at": "p.last_updated_at",
        "file_count": "p.file_count",
        "cad_count": "p.cad_count",
        "material_count": "p.material_count",
    }
    if sort_by not in sort_columns:
        raise ValueError("sort_by_invalid")
    normalized_order = order.lower()
    if normalized_order not in {"asc", "desc"}:
        raise ValueError("order_invalid")

    filters: list[str] = []
    params: list[object] = []
    if q:
        filters.append("(p.name LIKE ? OR p.project_path LIKE ?)")
        pattern = f"%{q}%"
        params.extend([pattern, pattern])
    if project_type:
        filters.append("p.type = ?")
        params.append(project_type)
    if phase:
        filters.append("p.phase = ?")
        params.append(phase)
    where = f"WHERE {' AND '.join(filters)}" if filters else ""
    resolved_page = clamp_page(page)
    resolved_limit = clamp_limit(limit)
    offset = (resolved_page - 1) * resolved_limit

    with connect(db_path) as conn:
        total = int(
            conn.execute(
                f"SELECT COUNT(*) AS total FROM projects p {where}",
                params,
            ).fetchone()["total"]
        )
        sort_expression = sort_columns[sort_by]
        nulls_last = "CASE WHEN p.last_updated_at IS NULL THEN 1 ELSE 0 END ASC," if sort_by == "last_updated_at" else ""
        rows = conn.execute(
            f"""
            SELECT p.id, p.name, p.project_path, p.type, p.phase, p.status, p.manager,
                   p.file_count, p.cad_count, p.material_count, p.last_updated_at,
                   CASE WHEN f.entity_id IS NULL THEN 0 ELSE 1 END AS is_favorite
            FROM projects p
            LEFT JOIN favorites f
              ON f.identity_type = 'project' AND f.entity_id = p.id
            {where}
            ORDER BY {nulls_last} {sort_expression} {normalized_order.upper()}, p.name ASC
            LIMIT ? OFFSET ?
            """,
            [*params, resolved_limit, offset],
        ).fetchall()

    return [row_to_dict(row) for row in rows], total, resolved_page, resolved_limit


def set_project_favorite(
    project_id: str,
    is_favorite: bool,
    db_path: Path | None = None,
) -> dict[str, object]:
    with connect(db_path) as conn:
        ensure_project_exists(conn, project_id)
        if is_favorite:
            conn.execute(
                """
                INSERT OR IGNORE INTO favorites (identity_type, entity_id)
                VALUES ('project', ?)
                """,
                (project_id,),
            )
        else:
            conn.execute(
                "DELETE FROM favorites WHERE identity_type = 'project' AND entity_id = ?",
                (project_id,),
            )
    return {"id": project_id, "is_favorite": is_favorite}


def project_overview(project_id: str, db_path: Path | None = None) -> dict[str, object]:
    with connect(db_path) as conn:
        row = conn.execute(
            """
            SELECT p.id, p.name, p.project_path AS path, p.type, p.phase, p.status,
                   p.manager, p.file_count, p.cad_count, p.material_count,
                   p.created_at, p.last_updated_at, m.summary
            FROM projects p
            LEFT JOIN ai_metadata m ON m.project_id = p.id
            WHERE p.id = ?
            """,
            (project_id,),
        ).fetchone()
        if row is None:
            raise ValueError("project_not_found")
        tags = [
            item["tag_name"]
            for item in conn.execute(
                "SELECT tag_name FROM project_tags WHERE project_id = ? ORDER BY tag_name",
                (project_id,),
            ).fetchall()
        ]
    data = row_to_dict(row)
    data["tags"] = tags
    schema_version: int | None = None
    project_json = Path(str(data["path"])) / "project.json"
    try:
        payload = json.loads(project_json.read_text(encoding="utf-8"))
        value = payload.get("schema_version") if isinstance(payload, dict) else None
        schema_version = int(value) if isinstance(value, int | str) and str(value).isdigit() else None
    except (OSError, json.JSONDecodeError, ValueError):
        schema_version = None
    data["schema_version"] = schema_version
    return data


def project_ai_metadata(project_id: str, db_path: Path | None = None) -> dict[str, object]:
    with connect(db_path) as conn:
        row = conn.execute(
            """
            SELECT summary, core_needs, special_reqs, risks, lessons
            FROM ai_metadata
            WHERE project_id = ?
            """,
            (project_id,),
        ).fetchone()
        if row is None:
            raise ValueError("ai_metadata_not_found")
    return {
        "summary": row["summary"] or "",
        "core_needs": parse_json_list(row["core_needs"]),
        "special_reqs": parse_json_list(row["special_reqs"]),
        "risks": parse_json_list(row["risks"]),
        "lessons": parse_json_list(row["lessons"]),
    }
