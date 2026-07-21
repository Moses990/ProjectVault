import json
import sqlite3
import unittest
from contextlib import closing
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from fastapi import HTTPException

from app.api.system import (
    BackupRestoreRequest,
    ExplorerOpenRequest,
    MaintenanceRequest,
    post_backup_create,
    post_explorer_open,
    post_maintenance_run,
    post_restore_backup,
)
from app.db.database import initialize_database
from app.scanner.full_scanner import scan_project


def write_project_json(project_dir: Path, project_id: str, name: str) -> None:
    data = {
        "project_id": project_id,
        "name": name,
        "type": "retail",
        "phase": "handover",
        "status": "healthy",
        "manager": "Mina",
        "tags": ["phase11"],
        "ai": {"summary": "Phase 11 sample"},
        "schema_version": 1,
    }
    (project_dir / "project.json").write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")


def create_project(root: Path, project_id: str = "project-phase11", name: str = "Phase Eleven Store") -> Path:
    project_dir = root / name
    project_dir.mkdir()
    write_project_json(project_dir, project_id, name)
    (project_dir / "brief.txt").write_text("phase11", encoding="utf-8")
    return project_dir


def insert_history(
    db_path: Path,
    history_id: str,
    status: str,
    created_at: str,
    project_id: str | None = "project-phase11",
) -> None:
    with closing(sqlite3.connect(db_path)) as conn:
        conn.execute(
            """
            INSERT INTO scan_history (id, project_id, event_type, status, created_at, message)
            VALUES (?, ?, 'maintenance_test', ?, ?, ?)
            """,
            (history_id, project_id, status, created_at, history_id),
        )
        conn.commit()


class Phase11SystemMaintenanceTests(unittest.TestCase):
    def test_explorer_open_uses_file_id_and_rejects_missing_or_unsafe_paths(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            db_path = root / "project_vault.db"
            initialize_database(db_path)
            project_dir = create_project(root)
            scan_project(project_dir, db_path=db_path)

            with closing(sqlite3.connect(db_path)) as conn:
                conn.row_factory = sqlite3.Row
                file_id = conn.execute(
                    "SELECT id FROM files WHERE relative_path = 'brief.txt'"
                ).fetchone()["id"]

            with patch("app.api.system.get_database_path", return_value=db_path), patch(
                "app.services.files._launch_system_path", return_value=True
            ) as launcher:
                opened = post_explorer_open(ExplorerOpenRequest(file_id=file_id, mode="open_file"))
                revealed = post_explorer_open(ExplorerOpenRequest(file_id=file_id, mode="reveal_folder"))
                with self.assertRaises(HTTPException) as missing:
                    post_explorer_open(ExplorerOpenRequest(file_id="missing-file", mode="open_file"))

            self.assertTrue(opened["data"]["success"])
            self.assertTrue(revealed["data"]["success"])
            self.assertEqual(launcher.call_count, 2)
            self.assertEqual(launcher.call_args_list[0].args[0], (project_dir / "brief.txt").resolve())
            self.assertEqual(launcher.call_args_list[1].args[0], (project_dir / "brief.txt").resolve())
            self.assertTrue(launcher.call_args_list[1].kwargs.get("select_only"))
            self.assertEqual(missing.exception.status_code, 404)

            with closing(sqlite3.connect(db_path)) as conn:
                conn.execute(
                    """
                    UPDATE files
                    SET relative_path = '../outside.txt'
                    WHERE id = ?
                    """,
                    (file_id,),
                )
                conn.commit()

            with patch("app.api.system.get_database_path", return_value=db_path):
                with self.assertRaises(HTTPException) as unsafe:
                    post_explorer_open(ExplorerOpenRequest(file_id=file_id, mode="open_file"))
            self.assertEqual(unsafe.exception.status_code, 403)

    def test_maintenance_cleans_history_retention_and_runs_incremental_vacuum(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            db_path = root / "project_vault.db"
            initialize_database(db_path)
            project_dir = create_project(root)
            scan_project(project_dir, db_path=db_path)
            insert_history(db_path, "old-success", "success", "2026-04-01T00:00:00")
            insert_history(db_path, "recent-success", "success", "2026-06-10T00:00:00")
            insert_history(db_path, "old-error", "error", "2025-12-01T00:00:00")
            insert_history(db_path, "recent-error", "error", "2026-03-01T00:00:00")

            with patch("app.api.system.get_database_path", return_value=db_path):
                result = post_maintenance_run(MaintenanceRequest(now="2026-06-25T00:00:00"))

            self.assertGreaterEqual(result["data"]["deleted_count"], 2)
            self.assertTrue(result["data"]["incremental_vacuum"])

            with closing(sqlite3.connect(db_path)) as conn:
                remaining = {
                    row[0]
                    for row in conn.execute("SELECT id FROM scan_history WHERE id LIKE '%-%'").fetchall()
                }

            self.assertNotIn("old-success", remaining)
            self.assertIn("recent-success", remaining)
            self.assertNotIn("old-error", remaining)
            self.assertIn("recent-error", remaining)

    def test_backup_create_and_restore_replace_only_database_cache(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            db_path = root / "project_vault.db"
            initialize_database(db_path)
            project_dir = create_project(root)
            scan_project(project_dir, db_path=db_path)

            with patch("app.api.system.get_database_path", return_value=db_path):
                backup = post_backup_create()

            backup_name = backup["data"]["name"]
            self.assertTrue((root / "backups" / backup_name).exists())

            with closing(sqlite3.connect(db_path)) as conn:
                conn.execute("DELETE FROM projects WHERE id = 'project-phase11'")
                conn.commit()

            self.assertTrue((project_dir / "brief.txt").exists())

            with patch("app.api.system.get_database_path", return_value=db_path):
                restored = post_restore_backup(BackupRestoreRequest(name=backup_name, confirm=True))

            self.assertEqual(restored["data"]["restored"], True)
            self.assertTrue((project_dir / "brief.txt").exists())
            with closing(sqlite3.connect(db_path)) as conn:
                count = conn.execute(
                    "SELECT COUNT(*) FROM projects WHERE id = 'project-phase11'"
                ).fetchone()[0]
            self.assertEqual(count, 1)


if __name__ == "__main__":
    unittest.main()
