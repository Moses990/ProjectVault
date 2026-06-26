"""System domain: scanner, maintenance, backup."""

from __future__ import annotations

import shutil
import sqlite3
import uuid
from datetime import datetime, timedelta
from pathlib import Path

from app.db.database import connect
from app.services import _parse_datetime


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
    from app.scanner.incremental_scanner import scan_project_incremental

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
    from app.search.indexer import rebuild_search_index

    result = rebuild_search_index(db_path=db_path)
    return {"task_id": str(uuid.uuid4()), "indexed_count": result.indexed_count}


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
