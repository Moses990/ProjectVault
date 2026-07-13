import json
import sqlite3
import time
import unittest
from contextlib import closing
from pathlib import Path
from tempfile import TemporaryDirectory

from app.db.database import initialize_database
from app.scanner.full_scanner import scan_project
from app.scanner import incremental_scanner
from app.scanner.incremental_scanner import scan_project_incremental
from app.search.service import search


def write_project_json(project_dir: Path, project_id: str = "project-alpha") -> None:
    data = {
        "project_id": project_id,
        "name": "Alpha Store",
        "type": "retail",
        "phase": "design",
        "status": "healthy",
        "manager": "Mina",
        "tags": ["flagship"],
        "ai": {
            "summary": "",
            "core_needs": [],
            "special_reqs": [],
            "risks": [],
            "lessons": [],
        },
        "schema_version": 1,
    }
    (project_dir / "project.json").write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


class IncrementalScannerTests(unittest.TestCase):
    def create_project(self, root: Path) -> Path:
        project_dir = root / "Alpha Store"
        project_dir.mkdir()
        write_project_json(project_dir)
        (project_dir / "brief.txt").write_text("hello", encoding="utf-8")
        (project_dir / "drawings").mkdir()
        (project_dir / "drawings" / "floor_plan.dwg").write_bytes(b"dwg")
        (project_dir / "materials").mkdir()
        (project_dir / "materials" / "spec.pdf").write_bytes(b"pdf")
        return project_dir

    def fetch_files(self, db_path: Path) -> dict[str, tuple[str, int]]:
        with closing(sqlite3.connect(db_path)) as conn:
            rows = conn.execute(
                "SELECT relative_path, file_hash, size_bytes FROM files"
            ).fetchall()
        return {row[0]: (row[1], row[2]) for row in rows}

    def test_incremental_scan_updates_created_modified_and_deleted_files(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            db_path = root / "project_vault.db"
            initialize_database(db_path)
            project_dir = self.create_project(root)
            scan_project(project_dir, db_path=db_path)
            before = self.fetch_files(db_path)

            time.sleep(0.02)
            (project_dir / "materials" / "new-image.jpg").write_bytes(b"jpg")
            (project_dir / "brief.txt").write_text("hello updated", encoding="utf-8")
            (project_dir / "materials" / "spec.pdf").unlink()

            result = scan_project_incremental(project_dir, db_path=db_path)

            self.assertEqual(result.created_count, 1)
            self.assertEqual(result.updated_count, 1)
            self.assertEqual(result.deleted_count, 1)
            self.assertEqual(result.moved_count, 0)

            after = self.fetch_files(db_path)
            self.assertIn("materials/new-image.jpg", after)
            self.assertNotIn("materials/spec.pdf", after)
            self.assertNotEqual(before["brief.txt"][0], after["brief.txt"][0])

            with closing(sqlite3.connect(db_path)) as conn:
                project_counts = conn.execute(
                    """
                    SELECT file_count, cad_count, material_count
                    FROM projects
                    WHERE id = 'project-alpha'
                    """
                ).fetchone()
                history = conn.execute(
                    """
                    SELECT event_type, status, affected_files, message
                    FROM scan_history
                    ORDER BY created_at DESC
                    LIMIT 1
                    """
                ).fetchone()

            self.assertEqual(project_counts, (4, 1, 1))
            self.assertEqual(history[0], "incremental_scan")
            self.assertEqual(history[1], "success")
            self.assertEqual(history[2], 3)
            self.assertIn("created=1", history[3])

    def test_incremental_scan_detects_file_moves_by_preserving_file_identity(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            db_path = root / "project_vault.db"
            initialize_database(db_path)
            project_dir = self.create_project(root)
            scan_project(project_dir, db_path=db_path)

            with closing(sqlite3.connect(db_path)) as conn:
                original_id = conn.execute(
                    "SELECT id FROM files WHERE relative_path = 'brief.txt'"
                ).fetchone()[0]

            (project_dir / "archive").mkdir()
            (project_dir / "brief.txt").replace(project_dir / "archive" / "brief.txt")

            result = scan_project_incremental(project_dir, db_path=db_path)

            self.assertEqual(result.created_count, 0)
            self.assertEqual(result.updated_count, 0)
            self.assertEqual(result.deleted_count, 0)
            self.assertEqual(result.moved_count, 1)

            with closing(sqlite3.connect(db_path)) as conn:
                moved = conn.execute(
                    "SELECT id, relative_path FROM files WHERE file_name = 'brief.txt'"
                ).fetchone()

            self.assertEqual(moved, (original_id, "archive/brief.txt"))

    def test_changed_paths_incremental_scan_detects_move_and_preserves_file_identity(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            db_path = root / "project_vault.db"
            initialize_database(db_path)
            project_dir = self.create_project(root)
            scan_project(project_dir, db_path=db_path)

            with closing(sqlite3.connect(db_path)) as conn:
                original_id = conn.execute(
                    "SELECT id FROM files WHERE relative_path = 'brief.txt'"
                ).fetchone()[0]

            archive = project_dir / "archive"
            archive.mkdir()
            old_path = project_dir / "brief.txt"
            new_path = archive / "brief.txt"
            old_path.replace(new_path)
            result = scan_project_incremental(
                project_dir,
                db_path=db_path,
                changed_paths=[old_path, new_path],
            )

            self.assertEqual(result.created_count, 0)
            self.assertEqual(result.deleted_count, 0)
            self.assertEqual(result.moved_count, 1)
            with closing(sqlite3.connect(db_path)) as conn:
                moved = conn.execute(
                    "SELECT id, relative_path FROM files WHERE file_name = 'brief.txt'"
                ).fetchone()
            self.assertEqual(moved, (original_id, "archive/brief.txt"))

    def test_incremental_scan_treats_same_project_id_at_new_path_as_relocation(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            db_path = root / "project_vault.db"
            initialize_database(db_path)
            original_dir = self.create_project(root)
            scan_project(original_dir, db_path=db_path)

            relocated_dir = root / "Moved Disk" / "Alpha Store"
            relocated_dir.parent.mkdir()
            original_dir.replace(relocated_dir)

            result = scan_project_incremental(relocated_dir, db_path=db_path)

            self.assertTrue(result.relocated)
            self.assertEqual(result.created_count, 0)
            self.assertEqual(result.updated_count, 0)
            self.assertEqual(result.deleted_count, 0)

            with closing(sqlite3.connect(db_path)) as conn:
                project = conn.execute(
                    "SELECT project_path, file_count FROM projects WHERE id = 'project-alpha'"
                ).fetchone()
                file_count = conn.execute("SELECT COUNT(*) FROM files").fetchone()[0]
                history = conn.execute(
                    """
                    SELECT event_type, status, message
                    FROM scan_history
                    ORDER BY created_at DESC
                    LIMIT 1
                    """
                ).fetchone()

            self.assertEqual(project[0], str(relocated_dir.resolve()))
            self.assertEqual(project[1], 4)
            self.assertEqual(file_count, 4)
            self.assertEqual(history[0], "incremental_scan")
            self.assertEqual(history[1], "success")
            self.assertIn("relocated=True", history[2])

    def test_incremental_scan_does_not_delete_existing_index_when_new_path_has_no_project_json(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            db_path = root / "project_vault.db"
            initialize_database(db_path)
            project_dir = self.create_project(root)
            scan_project(project_dir, db_path=db_path)
            unsafe_dir = root / "Missing Metadata"
            unsafe_dir.mkdir()

            with self.assertRaises(ValueError):
                scan_project_incremental(unsafe_dir, db_path=db_path)

            with closing(sqlite3.connect(db_path)) as conn:
                self.assertEqual(conn.execute("SELECT COUNT(*) FROM projects").fetchone()[0], 1)
                self.assertEqual(conn.execute("SELECT COUNT(*) FROM files").fetchone()[0], 4)
                history = conn.execute(
                    """
                    SELECT event_type, status, message
                    FROM scan_history
                    ORDER BY created_at DESC
                    LIMIT 1
                    """
                ).fetchone()

            self.assertEqual(history[0], "incremental_scan")
            self.assertEqual(history[1], "error")
            self.assertIn("project_json_missing", history[2])

    def test_incremental_scan_changed_paths_fast_path_avoids_full_project_walk(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            db_path = root / "project_vault.db"
            initialize_database(db_path)
            project_dir = self.create_project(root)
            bulk = project_dir / "bulk"
            bulk.mkdir()
            for index in range(1200):
                (bulk / f"stable_{index:04d}.txt").write_text("stable", encoding="utf-8")
            scan_project(project_dir, db_path=db_path)

            new_material = project_dir / "materials" / "fast-path-spec.pdf"
            new_material.write_bytes(b"fast path needle pdf")

            original_build_file_records = incremental_scanner.build_file_records

            def fail_if_full_walk(*_args: object, **_kwargs: object) -> list[dict[str, object]]:
                raise AssertionError("changed_paths mode must not enumerate the full project")

            incremental_scanner.build_file_records = fail_if_full_walk
            try:
                result = scan_project_incremental(
                    project_dir,
                    db_path=db_path,
                    changed_paths=[new_material],
                )
            finally:
                incremental_scanner.build_file_records = original_build_file_records

            self.assertEqual(result.created_count, 1)
            self.assertEqual(result.updated_count, 0)
            self.assertEqual(result.deleted_count, 0)
            self.assertLess(result.duration_ms, 5000)

            with closing(sqlite3.connect(db_path)) as conn:
                file_row = conn.execute(
                    "SELECT id FROM files WHERE relative_path = 'materials/fast-path-spec.pdf'"
                ).fetchone()
                material_count = conn.execute(
                    """
                    SELECT COUNT(*)
                    FROM materials
                    WHERE file_id = ?
                    """,
                    (file_row[0],),
                ).fetchone()[0]
                project_count = conn.execute(
                    "SELECT file_count, material_count FROM projects WHERE id = 'project-alpha'"
                ).fetchone()
                history = conn.execute(
                    """
                    SELECT event_type, affected_files, message
                    FROM scan_history
                    ORDER BY created_at DESC
                    LIMIT 1
                    """
                ).fetchone()

            self.assertEqual(material_count, 1)
            self.assertEqual(project_count, (1205, 2))
            self.assertEqual(history[0], "incremental_scan")
            self.assertEqual(history[1], 1)
            self.assertIn("mode=changed_paths", history[2])
            self.assertTrue(
                any(item.title == "fast-path-spec.pdf" for item in search("fast-path-spec", db_path=db_path))
            )

    def test_incremental_scan_syncs_project_json_knowledge_and_search(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            db_path = root / "project_vault.db"
            initialize_database(db_path)
            project_dir = self.create_project(root)
            scan_project(project_dir, db_path=db_path)

            project_json = project_dir / "project.json"
            data = json.loads(project_json.read_text(encoding="utf-8"))
            data["ai"]["summary"] = "new approved circulation summary"
            data["tags"] = ["wayfinding"]
            project_json.write_text(
                json.dumps(data, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )

            scan_project_incremental(
                project_dir,
                db_path=db_path,
                changed_paths=[project_json],
            )

            with closing(sqlite3.connect(db_path)) as conn:
                summary = conn.execute(
                    "SELECT summary FROM ai_metadata WHERE project_id = 'project-alpha'",
                ).fetchone()[0]
                tags = conn.execute(
                    "SELECT tag_name FROM project_tags WHERE project_id = 'project-alpha'",
                ).fetchall()
            self.assertEqual(summary, "new approved circulation summary")
            self.assertEqual(tags, [("wayfinding",)])
            self.assertTrue(
                any(item.entity_type == "knowledge" for item in search("circulation", category="knowledge", db_path=db_path))
            )


if __name__ == "__main__":
    unittest.main()
