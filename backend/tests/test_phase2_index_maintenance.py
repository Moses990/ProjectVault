import hashlib
import json
import sqlite3
import tempfile
import unittest
from unittest.mock import patch
from pathlib import Path

from app.db.database import connect, initialize_database
from app.scanner.full_scanner import scan_project
from app.services.index_maintenance import audit_project_indexes, rebuild_project_indexes


class Phase2IndexMaintenanceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_dir.name) / "TestVault"
        self.root.mkdir()
        self.db_path = Path(self.temp_dir.name) / "project_vault.db"
        initialize_database(self.db_path)
        self.project_dir = self.root / "示例展厅"
        for name in ("00_项目档案", "01_项目前期资料", "02_需求资料", "03_CAD图纸"):
            (self.project_dir / name).mkdir(parents=True)
        self.project_id = "project-real"
        self.project_json = self.project_dir / "project.json"
        self.project_json.write_text(
            json.dumps(
                {
                    "project_id": self.project_id,
                    "name": "示例展厅",
                    "type": "展厅",
                    "phase": "深化",
                    "status": "healthy",
                    "manager": "",
                    "tags": ["真实项目"],
                    "ai": {"summary": "测试项目"},
                    "schema_version": 1,
                },
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )
        (self.project_dir / "03_CAD图纸" / "A-01 平面布置图.dwg").write_bytes(b"cad")
        (self.project_dir / "01_项目前期资料" / "需求说明.pdf").write_bytes(b"pdf")
        self.nested_dir = self.project_dir / "03_CAD图纸"
        self.nested_json = self.nested_dir / "project.json"
        self.nested_json.write_text(
            json.dumps({"project_id": "project-wrong", "name": "03_CAD图纸"}),
            encoding="utf-8",
        )
        scan_project(self.project_dir, db_path=self.db_path)
        with connect(self.db_path) as conn:
            conn.execute(
                """
                INSERT INTO projects (id, project_path, name, status)
                VALUES (?, ?, ?, 'healthy')
                """,
                ("project-wrong", str(self.nested_dir), "03_CAD图纸"),
            )

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def _file_hash(self, path: Path) -> str:
        return hashlib.sha256(path.read_bytes()).hexdigest()

    def test_audit_identifies_nested_project_and_invalid_index(self) -> None:
        before_json = self._file_hash(self.nested_json)
        result = audit_project_indexes(root_path=self.root, db_path=self.db_path)

        self.assertEqual(result["valid_projects"], 1)
        self.assertEqual(result["suspected_invalid_project_count"], 1)
        self.assertEqual(result["suspected_nested_project_json_count"], 1)
        self.assertEqual(result["filesystem_changes"], 0)
        self.assertEqual(result["project_json_changes"], 0)
        self.assertEqual(before_json, self._file_hash(self.nested_json))
        with connect(self.db_path) as conn:
            self.assertEqual(conn.execute("SELECT COUNT(*) FROM projects").fetchone()[0], 2)

    def test_rebuild_removes_invalid_index_and_preserves_files(self) -> None:
        before_project_json = self._file_hash(self.project_json)
        before_nested_json = self._file_hash(self.nested_json)
        before_files = {
            str(path.relative_to(self.root)): self._file_hash(path)
            for path in self.root.rglob("*")
            if path.is_file()
        }

        result = rebuild_project_indexes(
            root_path=self.root,
            confirm=True,
            db_path=self.db_path,
        )

        self.assertEqual(result["valid_projects"], 1)
        self.assertEqual(result["excluded_invalid_projects"], 1)
        self.assertEqual(result["filesystem_changes"], 0)
        self.assertEqual(result["project_json_changes"], 0)
        backup_path = Path(result["backup_path"])
        self.assertTrue(backup_path.exists())
        self.assertGreater(backup_path.stat().st_size, 0)
        with connect(self.db_path) as conn:
            self.assertIsNotNone(conn.execute("SELECT id FROM projects WHERE id = ?", (self.project_id,)).fetchone())
            self.assertIsNone(conn.execute("SELECT id FROM projects WHERE id = 'project-wrong'").fetchone())
            self.assertIsNone(
                conn.execute(
                    "SELECT id FROM files WHERE project_id = ? AND relative_path = ?",
                    (self.project_id, "03_CAD图纸/project.json"),
                ).fetchone()
            )

        after_files = {
            str(path.relative_to(self.root)): self._file_hash(path)
            for path in self.root.rglob("*")
            if path.is_file()
        }
        self.assertEqual(before_files, after_files)
        self.assertEqual(before_project_json, self._file_hash(self.project_json))
        self.assertEqual(before_nested_json, self._file_hash(self.nested_json))

        second = rebuild_project_indexes(root_path=self.root, confirm=True, db_path=self.db_path)
        self.assertEqual(second["valid_projects"], 1)
        with connect(self.db_path) as conn:
            self.assertEqual(conn.execute("SELECT COUNT(*) FROM projects").fetchone()[0], 1)
            self.assertEqual(conn.execute("SELECT COUNT(*) FROM drawings").fetchone()[0], 1)

    def test_dry_run_does_not_change_database(self) -> None:
        with connect(self.db_path) as conn:
            before = conn.execute(
                "SELECT COUNT(*) AS projects, (SELECT COUNT(*) FROM files) AS files FROM projects"
            ).fetchone()
        audit_project_indexes(root_path=self.root, db_path=self.db_path)
        with connect(self.db_path) as conn:
            after = conn.execute(
                "SELECT COUNT(*) AS projects, (SELECT COUNT(*) FROM files) AS files FROM projects"
            ).fetchone()
        self.assertEqual(tuple(before), tuple(after))

    def test_rebuild_blocks_protected_data_and_rolls_back(self) -> None:
        with connect(self.db_path) as conn:
            conn.execute(
                """
                INSERT INTO knowledge_drafts
                    (id, project_id, draft_json, status, created_at, updated_at)
                VALUES ('draft-1', 'project-wrong', '{}', 'draft', 'now', 'now')
                """
            )
        with self.assertRaisesRegex(ValueError, "rebuild_blocked_protected_project_data"):
            rebuild_project_indexes(root_path=self.root, confirm=True, db_path=self.db_path)
        with connect(self.db_path) as conn:
            self.assertIsNotNone(conn.execute("SELECT id FROM projects WHERE id = 'project-wrong'").fetchone())
            self.assertIsNotNone(conn.execute("SELECT id FROM knowledge_drafts WHERE id = 'draft-1'").fetchone())

    def test_scanner_failure_rolls_back_sqlite_transaction(self) -> None:
        with connect(self.db_path) as conn:
            before = conn.execute("SELECT COUNT(*) FROM projects").fetchone()[0]
        with patch(
            "app.services.index_maintenance._copy_project_index",
            side_effect=RuntimeError("scanner_failure"),
        ):
            with self.assertRaisesRegex(RuntimeError, "scanner_failure"):
                rebuild_project_indexes(root_path=self.root, confirm=True, db_path=self.db_path)
        with connect(self.db_path) as conn:
            self.assertEqual(conn.execute("SELECT COUNT(*) FROM projects").fetchone()[0], before)
            self.assertIsNotNone(conn.execute("SELECT id FROM projects WHERE id = 'project-wrong'").fetchone())

    def test_rebuild_requires_confirmation(self) -> None:
        with self.assertRaisesRegex(ValueError, "index_rebuild_confirmation_required"):
            rebuild_project_indexes(root_path=self.root, confirm=False, db_path=self.db_path)


if __name__ == "__main__":
    unittest.main()
