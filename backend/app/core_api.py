import json
import mimetypes
import os
import shutil
import sqlite3
import subprocess
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from app.db.database import connect
from app.scanner.incremental_scanner import scan_project_incremental
from app.search.indexer import rebuild_search_index

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
        filters.append("(p.name LIKE ? OR p.id LIKE ? OR p.manager LIKE ?)")
        pattern = f"%{q}%"
        params.extend([pattern, pattern, pattern])
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
        rows = conn.execute(
            f"""
            SELECT p.id, p.name, p.type, p.phase, p.status, p.manager,
                   p.file_count, p.cad_count, p.material_count, p.last_updated_at,
                   CASE WHEN f.entity_id IS NULL THEN 0 ELSE 1 END AS is_favorite
            FROM projects p
            LEFT JOIN favorites f
              ON f.identity_type = 'project' AND f.entity_id = p.id
            {where}
            ORDER BY {sort_columns[sort_by]} {normalized_order.upper()}, p.name ASC
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
                   p.last_updated_at, m.summary
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


def list_project_files(
    project_id: str,
    *,
    directory: str | None = None,
    extension: str | None = None,
    page: int = 1,
    limit: int = 50,
    sort_by: str = "name",
    order: str = "asc",
    db_path: Path | None = None,
) -> tuple[list[dict[str, object]], int, int, int]:
    sort_columns = {
        "name": "file_name",
        "size": "size_bytes",
        "modified": "last_modified",
        "relative_path": "relative_path",
    }
    if sort_by not in sort_columns:
        raise ValueError("sort_by_invalid")
    normalized_order = order.lower()
    if normalized_order not in {"asc", "desc"}:
        raise ValueError("order_invalid")

    filters = ["project_id = ?"]
    params: list[object] = [project_id]
    if directory is not None:
        filters.append("relative_dir = ?")
        params.append(directory.strip("/"))
    if extension:
        filters.append("extension = ?")
        normalized_extension = extension.lower()
        if not normalized_extension.startswith("."):
            normalized_extension = f".{normalized_extension}"
        params.append(normalized_extension)
    where = " AND ".join(filters)
    resolved_page = clamp_page(page)
    resolved_limit = clamp_limit(limit)
    offset = (resolved_page - 1) * resolved_limit

    with connect(db_path) as conn:
        ensure_project_exists(conn, project_id)
        total = int(
            conn.execute(
                f"SELECT COUNT(*) AS total FROM files WHERE {where}",
                params,
            ).fetchone()["total"]
        )
        rows = conn.execute(
            f"""
            SELECT id, file_name, relative_path, relative_dir, extension,
                   size_bytes, last_modified
            FROM files
            WHERE {where}
            ORDER BY {sort_columns[sort_by]} {normalized_order.upper()}
            LIMIT ? OFFSET ?
            """,
            [*params, resolved_limit, offset],
        ).fetchall()
    return [row_to_dict(row) for row in rows], total, resolved_page, resolved_limit


def list_project_drawings(
    project_id: str,
    category: str | None = None,
    db_path: Path | None = None,
) -> list[dict[str, object]]:
    filters = ["d.project_id = ?"]
    params: list[object] = [project_id]
    if category:
        filters.append("d.dwg_category = ?")
        params.append(category)
    with connect(db_path) as conn:
        ensure_project_exists(conn, project_id)
        rows = conn.execute(
            f"""
            SELECT d.id, d.project_id, f.file_name, f.relative_path,
                   d.dwg_category, d.version_group, d.version_number,
                   d.is_current, d.last_modified
            FROM drawings d
            JOIN files f ON f.id = d.file_id
            WHERE {' AND '.join(filters)}
            ORDER BY d.last_modified DESC, f.file_name ASC
            """,
            params,
        ).fetchall()
    return [row_to_dict(row) for row in rows]


def list_project_materials(
    project_id: str,
    material_type: str | None = None,
    db_path: Path | None = None,
) -> list[dict[str, object]]:
    filters = ["m.project_id = ?"]
    params: list[object] = [project_id]
    if material_type:
        filters.append("m.material_type = ?")
        params.append(material_type)
    with connect(db_path) as conn:
        ensure_project_exists(conn, project_id)
        rows = conn.execute(
            f"""
            SELECT m.id, m.project_id, m.material_type, f.file_name,
                   f.relative_path, f.extension, f.size_bytes, f.last_modified
            FROM materials m
            JOIN files f ON f.id = m.file_id
            WHERE {' AND '.join(filters)}
            ORDER BY f.last_modified DESC, f.file_name ASC
            """,
            params,
        ).fetchall()
    return [row_to_dict(row) for row in rows]


def drawings_center(
    page: int = 1,
    limit: int = 50,
    sort_by: str = "last_modified",
    category: str | None = None,
    q: str | None = None,
    db_path: Path | None = None,
) -> tuple[list[dict[str, object]], int, int, int]:
    sort_columns = {"last_modified": "d.last_modified", "file_name": "f.file_name", "project_name": "p.name"}
    if sort_by not in sort_columns:
        raise ValueError("sort_by_invalid")
    filters: list[str] = []
    params: list[object] = []
    if category:
        filters.append("d.dwg_category = ?")
        params.append(category)
    if q:
        filters.append("(f.file_name LIKE ? OR f.relative_path LIKE ? OR p.name LIKE ?)")
        pattern = f"%{q}%"
        params.extend([pattern, pattern, pattern])
    where = f"WHERE {' AND '.join(filters)}" if filters else ""
    resolved_page = clamp_page(page)
    resolved_limit = clamp_limit(limit)
    offset = (resolved_page - 1) * resolved_limit
    with connect(db_path) as conn:
        total = int(
            conn.execute(
                f"""
                SELECT COUNT(*) AS total
                FROM drawings d
                JOIN files f ON f.id = d.file_id
                JOIN projects p ON p.id = d.project_id
                {where}
                """,
                params,
            ).fetchone()["total"]
        )
        rows = conn.execute(
            f"""
            SELECT d.id AS drawing_id, d.project_id, p.name AS project_name,
                   f.file_name, f.relative_path, d.dwg_category, d.version_group,
                   d.version_number, d.last_modified
            FROM drawings d
            JOIN files f ON f.id = d.file_id
            JOIN projects p ON p.id = d.project_id
            {where}
            ORDER BY {sort_columns[sort_by]} DESC
            LIMIT ? OFFSET ?
            """,
            [*params, resolved_limit, offset],
        ).fetchall()
    return [row_to_dict(row) for row in rows], total, resolved_page, resolved_limit


def drawing_versions(drawing_id: str, db_path: Path | None = None) -> dict[str, object]:
    with connect(db_path) as conn:
        drawing = conn.execute(
            "SELECT project_id, version_group FROM drawings WHERE id = ?",
            (drawing_id,),
        ).fetchone()
        if drawing is None:
            raise ValueError("drawing_not_found")
        rows = conn.execute(
            """
            SELECT d.id, f.file_name, d.version_number, d.last_modified, d.is_current
            FROM drawings d
            JOIN files f ON f.id = d.file_id
            WHERE d.project_id = ? AND COALESCE(d.version_group, '') = COALESCE(?, '')
            ORDER BY d.version_number DESC, d.last_modified DESC
            """,
            (drawing["project_id"], drawing["version_group"]),
        ).fetchall()
    return {
        "drawing_id": drawing_id,
        "version_group": drawing["version_group"] or "",
        "version_chain": [row_to_dict(row) for row in rows],
    }


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


def resolve_asset(file_id: str, db_path: Path | None = None) -> ResolvedAsset:
    with connect(db_path) as conn:
        row = conn.execute(
            """
            SELECT f.id, f.project_id, f.relative_path, p.project_path
            FROM files f
            JOIN projects p ON p.id = f.project_id
            WHERE f.id = ?
            """,
            (file_id,),
        ).fetchone()
        if row is None:
            raise ValueError("file_not_found")
    project_root = Path(row["project_path"]).resolve()
    absolute_path = (project_root / row["relative_path"]).resolve()
    if project_root != absolute_path and project_root not in absolute_path.parents:
        raise ValueError("file_outside_project")
    if not absolute_path.exists() or not absolute_path.is_file():
        raise FileNotFoundError("physical_file_missing")
    media_type = mimetypes.guess_type(str(absolute_path))[0] or "application/octet-stream"
    return ResolvedAsset(
        file_id=row["id"],
        project_id=row["project_id"],
        path=absolute_path,
        media_type=media_type,
    )


def launch_system_path(path: Path) -> bool:
    if os.name == "nt":
        os.startfile(str(path))  # type: ignore[attr-defined]
        return True
    if shutil.which("open"):
        subprocess.Popen(["open", str(path)])
        return True
    if shutil.which("xdg-open"):
        subprocess.Popen(["xdg-open", str(path)])
        return True
    raise RuntimeError("system_open_unavailable")


def open_explorer_target(file_id: str, mode: str, db_path: Path | None = None) -> dict[str, object]:
    if mode not in {"open_file", "reveal_folder"}:
        raise ValueError("mode_invalid")
    asset = resolve_asset(file_id, db_path=db_path)
    target = asset.path if mode == "open_file" else asset.path.parent
    launch_system_path(target)
    return {"success": True, "mode": mode, "file_id": asset.file_id}


def run_database_maintenance(
    *,
    now: str | None = None,
    db_path: Path | None = None,
) -> dict[str, object]:
    reference = _parse_datetime(now) if now else datetime.now()
    normal_cutoff = (reference - timedelta(days=30)).isoformat()
    problem_cutoff = (reference - timedelta(days=180)).isoformat()
    deleted_count = 0
    with connect(db_path) as conn:
        cursor = conn.execute(
            """
            DELETE FROM scan_history
            WHERE lower(status) NOT IN ('warning', 'error')
              AND created_at < ?
            """,
            (normal_cutoff,),
        )
        deleted_count += int(cursor.rowcount if cursor.rowcount != -1 else 0)
        cursor = conn.execute(
            """
            DELETE FROM scan_history
            WHERE lower(status) IN ('warning', 'error')
              AND created_at < ?
            """,
            (problem_cutoff,),
        )
        deleted_count += int(cursor.rowcount if cursor.rowcount != -1 else 0)
        ordinary_count = int(
            conn.execute(
                """
                SELECT COUNT(*) AS total
                FROM scan_history
                WHERE lower(status) NOT IN ('warning', 'error')
                """
            ).fetchone()["total"]
        )
        overflow = max(0, ordinary_count - 50000)
        if overflow:
            cursor = conn.execute(
                """
                DELETE FROM scan_history
                WHERE id IN (
                    SELECT id
                    FROM scan_history
                    WHERE lower(status) NOT IN ('warning', 'error')
                    ORDER BY created_at ASC
                    LIMIT ?
                )
                """,
                (overflow,),
            )
            deleted_count += int(cursor.rowcount if cursor.rowcount != -1 else 0)
        conn.execute("PRAGMA incremental_vacuum;")
        conn.execute(
            """
            INSERT OR REPLACE INTO app_metadata (key, value)
            VALUES ('last_database_maintenance_at', ?)
            """,
            (reference.isoformat(),),
        )
    return {
        "deleted_count": deleted_count,
        "incremental_vacuum": True,
        "normal_retention_days": 30,
        "problem_retention_days": 180,
    }


def _backup_dir_for_database(database_path: Path) -> Path:
    return database_path.resolve().parent / "backups"


def _validate_backup_name(name: str) -> str:
    candidate = Path(name)
    if candidate.name != name or candidate.suffix.lower() != ".db":
        raise ValueError("backup_name_invalid")
    return name


def create_database_backup(db_path: Path | None = None) -> dict[str, object]:
    source = (db_path or Path()).resolve() if db_path else None
    if source is None:
        from app.db.database import get_database_path

        source = get_database_path()
    backup_dir = _backup_dir_for_database(source)
    backup_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = backup_dir / f"project_vault_{timestamp}.db"

    src = sqlite3.connect(source)
    dst = sqlite3.connect(backup_path)
    try:
        src.execute("PRAGMA wal_checkpoint(FULL);")
        src.backup(dst)
        dst.commit()
    finally:
        dst.close()
        src.close()

    backups = sorted(backup_dir.glob("project_vault_*.db"), key=lambda p: p.stat().st_mtime, reverse=True)
    for old_backup in backups[10:]:
        old_backup.unlink(missing_ok=True)

    return {
        "name": backup_path.name,
        "size_bytes": backup_path.stat().st_size,
        "retention_count": 10,
    }


def restore_database_backup(
    name: str,
    *,
    confirm: bool,
    db_path: Path | None = None,
) -> dict[str, object]:
    if not confirm:
        raise ValueError("restore_confirmation_required")
    database_path = (db_path or Path()).resolve() if db_path else None
    if database_path is None:
        from app.db.database import get_database_path

        database_path = get_database_path()
    safe_name = _validate_backup_name(name)
    backup_path = (_backup_dir_for_database(database_path) / safe_name).resolve()
    backup_dir = _backup_dir_for_database(database_path).resolve()
    if backup_dir != backup_path.parent:
        raise ValueError("backup_name_invalid")
    if not backup_path.exists() or not backup_path.is_file():
        raise FileNotFoundError("backup_not_found")
    for suffix in ("-wal", "-shm"):
        database_path.with_name(database_path.name + suffix).unlink(missing_ok=True)
    shutil.copy2(backup_path, database_path)
    return {"restored": True, "name": safe_name}


def scanner_status() -> dict[str, object]:
    return {
        "status": "IDLE",
        "progress": 0.0,
        "queue_length": 0,
        "pending_projects": 0,
        "current_project": "",
        "current_file": "",
    }


def scan_project_by_id(project_id: str, db_path: Path | None = None) -> dict[str, object]:
    with connect(db_path) as conn:
        row = conn.execute(
            "SELECT project_path FROM projects WHERE id = ?",
            (project_id,),
        ).fetchone()
        if row is None:
            raise ValueError("project_not_found")
    result = scan_project_incremental(row["project_path"], db_path=db_path)
    return {
        "project_id": result.project_id,
        "created_count": result.created_count,
        "updated_count": result.updated_count,
        "deleted_count": result.deleted_count,
        "moved_count": result.moved_count,
        "relocated": result.relocated,
        "duration_ms": result.duration_ms,
    }


def rebuild_indexes(db_path: Path | None = None) -> dict[str, object]:
    result = rebuild_search_index(db_path=db_path)
    return {"task_id": str(uuid.uuid4()), "indexed_count": result.indexed_count}


def _provider_row_to_dict(row: Any) -> dict[str, object]:
    """Strip the raw key_reference; expose only whether a key is set."""
    return {
        "id": row["id"],
        "name": row["name"],
        "base_url": row["base_url"],
        "default_model": row["default_model"] or "",
        "is_enabled": bool(row["is_enabled"]),
        "has_key": bool(row["key_reference"]),
    }


def list_ai_providers(db_path: Path | None = None) -> list[dict[str, object]]:
    with connect(db_path) as conn:
        rows = conn.execute(
            "SELECT id, name, base_url, default_model, is_enabled, key_reference "
            "FROM ai_providers ORDER BY is_enabled DESC, name ASC"
        ).fetchall()
    return [_provider_row_to_dict(row) for row in rows]


def create_ai_provider(
    name: str,
    base_url: str,
    default_model: str = "",
    key_reference: str = "",
    db_path: Path | None = None,
) -> dict[str, object]:
    if not name.strip() or not base_url.strip():
        raise ValueError("name_and_base_url_required")
    provider_id = str(uuid.uuid4())
    with connect(db_path) as conn:
        conn.execute(
            "INSERT INTO ai_providers (id, name, base_url, default_model, is_enabled, key_reference) "
            "VALUES (?, ?, ?, ?, 1, ?)",
            (provider_id, name.strip(), base_url.strip(), default_model.strip() or None, key_reference or None),
        )
        row = conn.execute(
            "SELECT id, name, base_url, default_model, is_enabled, key_reference "
            "FROM ai_providers WHERE id = ?",
            (provider_id,),
        ).fetchone()
    return _provider_row_to_dict(row)


def update_ai_provider(
    provider_id: str,
    *,
    name: str | None = None,
    base_url: str | None = None,
    default_model: str | None = None,
    is_enabled: bool | None = None,
    key_reference: str | None = None,
    db_path: Path | None = None,
) -> dict[str, object]:
    with connect(db_path) as conn:
        existing = conn.execute(
            "SELECT id FROM ai_providers WHERE id = ?", (provider_id,)
        ).fetchone()
        if existing is None:
            raise ValueError("provider_not_found")
        fields: list[str] = []
        params: list[object] = []
        if name is not None:
            if not name.strip():
                raise ValueError("name_required")
            fields.append("name = ?")
            params.append(name.strip())
        if base_url is not None:
            if not base_url.strip():
                raise ValueError("base_url_required")
            fields.append("base_url = ?")
            params.append(base_url.strip())
        if default_model is not None:
            fields.append("default_model = ?")
            params.append(default_model.strip() or None)
        if is_enabled is not None:
            fields.append("is_enabled = ?")
            params.append(1 if is_enabled else 0)
        if key_reference is not None:
            fields.append("key_reference = ?")
            params.append(key_reference or None)
        if fields:
            params.append(provider_id)
            conn.execute(
                f"UPDATE ai_providers SET {', '.join(fields)} WHERE id = ?",
                params,
            )
        row = conn.execute(
            "SELECT id, name, base_url, default_model, is_enabled, key_reference "
            "FROM ai_providers WHERE id = ?",
            (provider_id,),
        ).fetchone()
    return _provider_row_to_dict(row)


def delete_ai_provider(provider_id: str, db_path: Path | None = None) -> dict[str, object]:
    with connect(db_path) as conn:
        existing = conn.execute(
            "SELECT id FROM ai_providers WHERE id = ?", (provider_id,)
        ).fetchone()
        if existing is None:
            raise ValueError("provider_not_found")
        conn.execute("DELETE FROM ai_providers WHERE id = ?", (provider_id,))
    return {"id": provider_id, "deleted": True}


def test_ai_provider(provider_id: str, db_path: Path | None = None) -> dict[str, object]:
    """Lightweight connectivity check: validates the provider record exists and
    has the minimum fields needed to make a request. A real network call is
    deferred to a later phase; this returns a structural readiness result."""
    with connect(db_path) as conn:
        row = conn.execute(
            "SELECT id, name, base_url, default_model, is_enabled, key_reference "
            "FROM ai_providers WHERE id = ?",
            (provider_id,),
        ).fetchone()
        if row is None:
            raise ValueError("provider_not_found")
    ready = bool(row["base_url"]) and bool(row["key_reference"])
    return {
        "id": provider_id,
        "name": row["name"],
        "ready": ready,
        "message": "provider_ready" if ready else "missing_base_url_or_key",
    }
