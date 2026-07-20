"""Safe audit and rebuild operations for the disposable SQLite index."""

from __future__ import annotations

import json
import os
import sqlite3
import tempfile
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

from app.db.database import get_database_path, initialize_database
from app.projects.project_structure import (
    EXISTING_PROJECT,
    classify_project_directory,
    is_standard_project_directory,
    looks_like_project_root,
)
from app.scanner.full_scanner import (
    build_file_records,
    load_project_json,
    project_hash,
    scan_project,
    stable_id,
)
from app.scanner.classifiers import is_drawing, material_type
from app.search.indexer import (
    _index_drawings,
    _index_files,
    _index_knowledge,
    _index_materials,
    _index_projects,
)
from app.services.system import create_database_backup


PROTECTED_PROJECT_TABLES = ("knowledge_sources", "knowledge_drafts", "knowledge_history")


def _resolved_path(value: str | Path) -> Path:
    return Path(value).expanduser().resolve()


def _path_key(value: str | Path) -> str:
    return os.path.normcase(str(_resolved_path(value)))


def _read_only_connection(database_path: Path) -> sqlite3.Connection:
    if not database_path.exists() or not database_path.is_file():
        raise FileNotFoundError("database_not_found")
    uri = f"file:{database_path.as_posix()}?mode=ro"
    conn = sqlite3.connect(uri, uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def _relative_path(path: Path, root: Path) -> str:
    return path.relative_to(root).as_posix()


def _nested_project_metadata(project_dir: Path) -> list[dict[str, str]]:
    nested: list[dict[str, str]] = []
    for path in project_dir.rglob("project.json"):
        if path.parent == project_dir:
            continue
        nested.append(
            {
                "path": str(path.resolve()),
                "project_path": str(project_dir),
                "reason": "检测到项目目录内部的 project.json",
            }
        )
    return nested


def _valid_projects(root_path: Path) -> tuple[list[dict[str, Any]], list[dict[str, str]]]:
    projects: list[dict[str, Any]] = []
    nested_metadata: list[dict[str, str]] = []
    for child in sorted(root_path.iterdir(), key=lambda item: item.name.casefold()):
        if not child.is_dir():
            continue
        structure = classify_project_directory(child)
        if structure.category != EXISTING_PROJECT:
            continue
        try:
            data = load_project_json(child)
        except ValueError as exc:
            nested_metadata.append(
                {
                    "path": str((child / "project.json").resolve()),
                    "project_path": str(child.resolve()),
                    "reason": str(exc),
                }
            )
            continue
        project_id = str(data["project_id"])
        projects.append(
            {
                "id": project_id,
                "name": str(data.get("name", child.name)),
                "path": str(child.resolve()),
                "data": data,
            }
        )
        nested_metadata.extend(_nested_project_metadata(child))
    return projects, nested_metadata


def _row_dict(row: sqlite3.Row | None) -> dict[str, Any] | None:
    return dict(row) if row is not None else None


def _project_index_anomalies(
    conn: sqlite3.Connection,
    valid_projects: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[str]]:
    valid_by_id = {item["id"]: item for item in valid_projects}
    valid_paths = {_path_key(item["path"]): item["id"] for item in valid_projects}
    suspected: list[dict[str, Any]] = []
    missing_paths: list[dict[str, Any]] = []
    invalid_ids: list[str] = []

    for row in conn.execute("SELECT * FROM projects ORDER BY name COLLATE NOCASE").fetchall():
        item = dict(row)
        path = _resolved_path(item["project_path"])
        is_current = item["id"] in valid_by_id and valid_paths.get(_path_key(path)) == item["id"]
        if is_current:
            continue
        invalid_ids.append(str(item["id"]))
        if not path.exists():
            missing_paths.append({
                "project_id": item["id"],
                "name": item["name"],
                "path": str(path),
                "reason": "项目路径不存在",
            })
        reason = "疑似错误项目索引"
        if is_standard_project_directory(path):
            reason = "项目路径是标准资料子目录"
        elif any(_path_key(path.parent) == _path_key(item["path"]) for item in valid_projects):
            reason = "项目路径位于有效项目内部"
        suspected.append({
            "project_id": item["id"],
            "name": item["name"],
            "path": str(path),
            "reason": reason,
        })
    return suspected, missing_paths, invalid_ids


def _ownership_anomalies(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    anomalies: list[dict[str, Any]] = []
    for row in conn.execute(
        """
        SELECT f.id, f.project_id, f.relative_path, p.project_path
        FROM files f
        LEFT JOIN projects p ON p.id = f.project_id
        """
    ).fetchall():
        expected = _resolved_path(row["project_path"]) / Path(row["relative_path"]) if row["project_path"] else None
        if row["project_path"] is None or expected is None or not expected.exists():
            anomalies.append({
                "entity": "file",
                "entity_id": row["id"],
                "project_id": row["project_id"],
                "relative_path": row["relative_path"],
                "reason": "文件不存在或项目归属不存在",
            })
    for table in ("drawings", "materials"):
        for row in conn.execute(
            f"""
            SELECT {table}.id, {table}.project_id, {table}.file_id,
                   f.project_id AS file_project_id
            FROM {table}
            LEFT JOIN files f ON f.id = {table}.file_id
            WHERE f.id IS NULL OR f.project_id <> {table}.project_id
            """
        ).fetchall():
            anomalies.append({
                "entity": table,
                "entity_id": row["id"],
                "project_id": row["project_id"],
                "file_id": row["file_id"],
                "reason": "实体与文件的项目归属不一致",
            })
    return anomalies


def audit_project_indexes(
    *,
    root_path: str | Path,
    db_path: Path | None = None,
) -> dict[str, Any]:
    root = _resolved_path(root_path)
    if not root.exists() or not root.is_dir():
        raise ValueError("root_path_invalid")
    if (
        (root / "project.json").exists()
        or classify_project_directory(root).category == EXISTING_PROJECT
        or looks_like_project_root(root)
    ):
        raise ValueError("root_path_is_project")

    database_path = _resolved_path(db_path or get_database_path())
    valid_projects, nested_metadata = _valid_projects(root)
    with closing(_read_only_connection(database_path)) as conn:
        suspected, missing_paths, invalid_ids = _project_index_anomalies(conn, valid_projects)
        db_ids = {str(row["id"]) for row in conn.execute("SELECT id FROM projects")}
        valid_ids = {str(item["id"]) for item in valid_projects}
        missing_indexes = [
            {
                "project_id": item["id"],
                "name": item["name"],
                "path": item["path"],
                "reason": "有效项目尚未建立索引",
            }
            for item in valid_projects
            if item["id"] not in db_ids
        ]
        anomalies = _ownership_anomalies(conn)

    file_count = drawing_count = material_count = 0
    for item in valid_projects:
        records = _filtered_file_records(Path(item["path"]), item["id"])
        file_count += len(records)
        drawing_count += sum(1 for record in records if is_drawing(record["absolute_path"]))
        material_count += sum(1 for record in records if material_type(record["absolute_path"]))

    return {
        "status": "ready",
        "database_path": str(database_path),
        "root_path": str(root),
        "valid_projects": len(valid_projects),
        "valid_project_details": [
            {"project_id": item["id"], "name": item["name"], "path": item["path"]}
            for item in valid_projects
        ],
        "suspected_invalid_projects": suspected,
        "suspected_invalid_project_count": len(suspected),
        "missing_indexes": missing_indexes,
        "missing_index_count": len(missing_indexes),
        "missing_project_paths": missing_paths,
        "missing_project_path_count": len(missing_paths),
        "suspected_nested_project_json": nested_metadata,
        "suspected_nested_project_json_count": len(nested_metadata),
        "project_ownership_anomalies": anomalies,
        "project_ownership_anomaly_count": len(anomalies),
        "invalid_project_ids": invalid_ids,
        "files_to_reindex": file_count,
        "drawings_to_reindex": drawing_count,
        "materials_to_reindex": material_count,
        "filesystem_changes": 0,
        "project_json_changes": 0,
        "database_schema_changes": 0,
    }


def _filtered_file_records(project_dir: Path, project_id: str) -> list[dict[str, Any]]:
    records = build_file_records(project_dir, project_id)
    return [
        record
        for record in records
        if record["relative_path"].casefold() == "project.json"
        or not record["relative_path"].casefold().endswith("/project.json")
    ]


def _protected_project_rows(conn: sqlite3.Connection, project_ids: Iterable[str]) -> dict[str, int]:
    ids = tuple(sorted(set(project_ids)))
    if not ids:
        return {}
    placeholders = ",".join("?" for _ in ids)
    protected: dict[str, int] = {}
    for table in PROTECTED_PROJECT_TABLES:
        rows = conn.execute(
            f"SELECT project_id, COUNT(*) AS total FROM {table} WHERE project_id IN ({placeholders}) GROUP BY project_id",
            ids,
        ).fetchall()
        for row in rows:
            protected[f"{table}:{row['project_id']}"] = int(row["total"])
    return protected


def _copy_project_index(
    conn: sqlite3.Connection,
    *,
    project_dir: Path,
    project_id: str,
) -> dict[str, int]:
    project_data = load_project_json(project_dir)
    records = _filtered_file_records(project_dir, project_id)
    file_ids = {record["id"] for record in records}

    with tempfile.TemporaryDirectory(prefix="project-vault-index-") as temp_dir:
        temp_db = Path(temp_dir) / "index.db"
        initialize_database(temp_db)
        scan_project(project_dir, db_path=temp_db)
        with closing(sqlite3.connect(temp_db)) as temp_conn:
            temp_conn.row_factory = sqlite3.Row
            project_row = temp_conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
            drawing_rows = temp_conn.execute(
                "SELECT * FROM drawings WHERE project_id = ?", (project_id,)
            ).fetchall()
            material_rows = temp_conn.execute(
                "SELECT * FROM materials WHERE project_id = ?", (project_id,)
            ).fetchall()

    if project_row is None:
        raise ValueError("rebuild_project_missing_temp_index")

    existing_files = conn.execute(
        "SELECT id, relative_path FROM files WHERE project_id = ?", (project_id,)
    ).fetchall()
    new_paths = {record["relative_path"] for record in records}
    stale_ids = [row["id"] for row in existing_files if row["relative_path"] not in new_paths]
    if stale_ids:
        placeholders = ",".join("?" for _ in stale_ids)
        protected_count = conn.execute(
            f"SELECT COUNT(*) AS total FROM knowledge_sources WHERE file_id IN ({placeholders})",
            stale_ids,
        ).fetchone()["total"]
        if int(protected_count) > 0:
            raise ValueError("rebuild_blocked_protected_file_data")

    data = project_data
    conn.execute(
        """
        INSERT INTO projects (
            id, project_hash, project_path, name, type, phase, status, manager,
            file_count, cad_count, material_count, last_updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            project_hash = excluded.project_hash,
            project_path = excluded.project_path,
            name = excluded.name,
            type = excluded.type,
            phase = excluded.phase,
            status = excluded.status,
            manager = excluded.manager,
            file_count = excluded.file_count,
            cad_count = excluded.cad_count,
            material_count = excluded.material_count,
            last_updated_at = excluded.last_updated_at
        """,
        (
            project_id,
            project_hash(records, data),
            str(project_dir),
            str(data.get("name", project_dir.name)),
            str(data.get("type", "")),
            str(data.get("phase", "")),
            str(data.get("status", "healthy")),
            str(data.get("manager", "")),
            len(records),
            sum(1 for record in records if is_drawing(record["absolute_path"])),
            sum(1 for record in records if material_type(record["absolute_path"])),
            project_row["last_updated_at"],
        ),
    )

    conn.execute("DELETE FROM project_tags WHERE project_id = ?", (project_id,))
    for tag_name in data.get("tags", []):
        conn.execute(
            "INSERT OR IGNORE INTO project_tags (project_id, tag_name) VALUES (?, ?)",
            (project_id, str(tag_name)),
        )
    ai_data = data.get("ai", {})
    if isinstance(ai_data, dict):
        conn.execute(
            """
            INSERT INTO ai_metadata (
                project_id, summary, core_needs, special_reqs, risks, lessons, metadata_version
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(project_id) DO UPDATE SET
                summary = excluded.summary,
                core_needs = excluded.core_needs,
                special_reqs = excluded.special_reqs,
                risks = excluded.risks,
                lessons = excluded.lessons,
                metadata_version = excluded.metadata_version
            """,
            (
                project_id,
                str(ai_data.get("summary", "")),
                json.dumps(ai_data.get("core_needs", []), ensure_ascii=False),
                json.dumps(ai_data.get("special_reqs", []), ensure_ascii=False),
                json.dumps(ai_data.get("risks", []), ensure_ascii=False),
                json.dumps(ai_data.get("lessons", []), ensure_ascii=False),
                str(data.get("schema_version", 1)),
            ),
        )

    conn.execute("DELETE FROM drawings WHERE project_id = ?", (project_id,))
    conn.execute("DELETE FROM materials WHERE project_id = ?", (project_id,))
    if stale_ids:
        placeholders = ",".join("?" for _ in stale_ids)
        conn.execute(f"DELETE FROM files WHERE id IN ({placeholders})", stale_ids)

    for record in records:
        conn.execute(
            """
            INSERT INTO files (
                id, project_id, file_hash, relative_path, relative_dir, file_name,
                extension, size_bytes, last_modified
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(project_id, relative_path) DO UPDATE SET
                file_hash = excluded.file_hash,
                relative_dir = excluded.relative_dir,
                file_name = excluded.file_name,
                extension = excluded.extension,
                size_bytes = excluded.size_bytes,
                last_modified = excluded.last_modified
            """,
            (
                record["id"], project_id, record["file_hash"], record["relative_path"],
                record["relative_dir"], record["file_name"], record["extension"],
                record["size_bytes"], record["last_modified"],
            ),
        )

    actual_file_ids = {
        row["relative_path"]: row["id"]
        for row in conn.execute(
            "SELECT id, relative_path FROM files WHERE project_id = ?", (project_id,)
        ).fetchall()
    }
    for row in drawing_rows:
        relative_path = conn.execute(
            "SELECT relative_path FROM files WHERE id = ?", (row["file_id"],)
        ).fetchone()
        if relative_path is None or relative_path["relative_path"] not in actual_file_ids:
            continue
        path_name = relative_path["relative_path"]
        if path_name.casefold().endswith("/project.json"):
            continue
        conn.execute(
            """
            INSERT INTO drawings (
                id, project_id, file_id, dwg_category, version_group,
                version_number, is_current, parent_drawing_id, last_modified
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                stable_id(project_id, "drawing", path_name), project_id,
                actual_file_ids[path_name], row["dwg_category"], row["version_group"],
                row["version_number"], row["is_current"], None, row["last_modified"],
            ),
        )
    for row in material_rows:
        relative_path = conn.execute(
            "SELECT relative_path FROM files WHERE id = ?", (row["file_id"],)
        ).fetchone()
        if relative_path is None or relative_path["relative_path"] not in actual_file_ids:
            continue
        path_name = relative_path["relative_path"]
        if path_name.casefold().endswith("/project.json"):
            continue
        conn.execute(
            "INSERT INTO materials (id, project_id, file_id, material_type) VALUES (?, ?, ?, ?)",
            (
                stable_id(project_id, "material", path_name), project_id,
                actual_file_ids[path_name], row["material_type"],
            ),
        )
    return {
        "files": len(records),
        "drawings": conn.execute("SELECT COUNT(*) AS total FROM drawings WHERE project_id = ?", (project_id,)).fetchone()["total"],
        "materials": conn.execute("SELECT COUNT(*) AS total FROM materials WHERE project_id = ?", (project_id,)).fetchone()["total"],
    }


def _rebuild_fts_in_transaction(conn: sqlite3.Connection) -> int:
    conn.execute("DELETE FROM fts_global")
    indexed_count = 0
    indexed_count += _index_projects(conn, None)
    indexed_count += _index_knowledge(conn, None)
    indexed_count += _index_files(conn, None)
    indexed_count += _index_drawings(conn, None)
    indexed_count += _index_materials(conn, None)
    conn.execute("INSERT INTO fts_global(fts_global) VALUES('optimize')")
    return indexed_count


def rebuild_project_indexes(
    *,
    root_path: str | Path,
    confirm: bool,
    db_path: Path | None = None,
) -> dict[str, Any]:
    if not confirm:
        raise ValueError("index_rebuild_confirmation_required")
    audit = audit_project_indexes(root_path=root_path, db_path=db_path)
    database_path = _resolved_path(db_path or get_database_path())
    backup = create_database_backup(db_path=database_path, label="before_index_rebuild")
    backup_path = database_path.parent / "backups" / str(backup["name"])
    if not backup_path.exists() or backup_path.stat().st_size <= 0:
        raise RuntimeError("index_backup_invalid")

    valid_projects, _ = _valid_projects(_resolved_path(root_path))
    valid_ids = {item["id"] for item in valid_projects}
    started = datetime.now(timezone.utc)
    result_projects: list[dict[str, Any]] = []
    conn = sqlite3.connect(database_path)
    try:
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        protected = _protected_project_rows(conn, set(audit["invalid_project_ids"]))
        if protected:
            raise ValueError("rebuild_blocked_protected_project_data")
        for item in valid_projects:
            counts = _copy_project_index(
                conn,
                project_dir=Path(item["path"]),
                project_id=item["id"],
            )
            result_projects.append({"project_id": item["id"], **counts})

        invalid_ids = tuple(sorted(set(audit["invalid_project_ids"]) - valid_ids))
        if invalid_ids:
            placeholders = ",".join("?" for _ in invalid_ids)
            conn.execute(
                f"DELETE FROM favorites WHERE identity_type = 'project' AND entity_id IN ({placeholders})",
                invalid_ids,
            )
            conn.execute(f"DELETE FROM projects WHERE id IN ({placeholders})", invalid_ids)
        indexed_count = _rebuild_fts_in_transaction(conn)
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    return {
        "status": "rebuilt",
        "database_path": str(database_path),
        "root_path": str(_resolved_path(root_path)),
        "backup": backup,
        "backup_path": str(backup_path),
        "valid_projects": len(valid_projects),
        "projects": result_projects,
        "excluded_invalid_projects": len(invalid_ids),
        "excluded_nested_project_json": audit["suspected_nested_project_json_count"],
        "indexed_count": indexed_count,
        "filesystem_changes": 0,
        "project_json_changes": 0,
        "database_schema_changes": 0,
        "duration_ms": int((datetime.now(timezone.utc) - started).total_seconds() * 1000),
    }
