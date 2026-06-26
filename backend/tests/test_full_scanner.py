import json
import sqlite3
import unittest
from contextlib import closing
from pathlib import Path
from tempfile import TemporaryDirectory

from app.db.database import initialize_database
from app.scanner.full_scanner import scan_project


def write_project_json(project_dir: Path, project_id: str = "project-alpha") -> None:
    data = {
        "project_id": project_id,
        "name": "Alpha Store",
        "type": "retail",
        "phase": "design",
        "status": "healthy",
        "manager": "Mina",
        "tags": ["flagship", "2026"],
        "ai": {
            "summary": "Retail concept refresh",
            "core_needs": ["lighting"],
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


class FullScannerTests(unittest.TestCase):
    def create_sample_project(self, root: Path) -> Path:
        project_dir = root / "Alpha Store"
        project_dir.mkdir()
        write_project_json(project_dir)
        (project_dir / "brief.txt").write_text("hello", encoding="utf-8")
        (project_dir / "drawings").mkdir()
        (project_dir / "drawings" / "floor_plan_v2.dwg").write_bytes(b"dwg")
        (project_dir / "materials").mkdir()
        (project_dir / "materials" / "spec.pdf").write_bytes(b"pdf")
        (project_dir / "materials" / "cost.xlsx").write_bytes(b"xlsx")
        (project_dir / "materials" / "render.jpg").write_bytes(b"jpg")
        return project_dir

    def test_scan_project_indexes_project_files_drawings_materials_and_history(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            db_path = root / "project_vault.db"
            initialize_database(db_path)
            project_dir = self.create_sample_project(root)

            result = scan_project(project_dir, db_path=db_path)

            self.assertEqual(result.project_id, "project-alpha")
            self.assertEqual(result.file_count, 6)
            self.assertEqual(result.drawing_count, 1)
            self.assertEqual(result.material_count, 3)

            with closing(sqlite3.connect(db_path)) as conn:
                project = conn.execute(
                    """
                    SELECT id, project_path, name, type, phase, status, manager,
                           file_count, cad_count, material_count
                    FROM projects
                    WHERE id = 'project-alpha'
                    """
                ).fetchone()
                self.assertEqual(project[0], "project-alpha")
                self.assertEqual(project[1], str(project_dir.resolve()))
                self.assertEqual(project[2:7], ("Alpha Store", "retail", "design", "healthy", "Mina"))
                self.assertEqual(project[7:10], (6, 1, 3))

                relative_paths = [
                    row[0]
                    for row in conn.execute(
                        "SELECT relative_path FROM files ORDER BY relative_path"
                    ).fetchall()
                ]
                self.assertEqual(
                    relative_paths,
                    [
                        "brief.txt",
                        "drawings/floor_plan_v2.dwg",
                        "materials/cost.xlsx",
                        "materials/render.jpg",
                        "materials/spec.pdf",
                        "project.json",
                    ],
                )
                self.assertTrue(all(not Path(path).is_absolute() for path in relative_paths))

                drawing_count = conn.execute("SELECT COUNT(*) FROM drawings").fetchone()[0]
                material_types = [
                    row[0]
                    for row in conn.execute(
                        "SELECT material_type FROM materials ORDER BY material_type"
                    ).fetchall()
                ]
                history = conn.execute(
                    """
                    SELECT event_type, status, affected_files
                    FROM scan_history
                    WHERE project_id = 'project-alpha'
                    """
                ).fetchone()

                self.assertEqual(drawing_count, 1)
                self.assertEqual(material_types, ["excel", "image", "pdf"])
                self.assertEqual(history, ("full_scan", "success", 6))

    def test_scan_project_is_idempotent_for_repeated_full_scans(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            db_path = root / "project_vault.db"
            initialize_database(db_path)
            project_dir = self.create_sample_project(root)

            scan_project(project_dir, db_path=db_path)
            scan_project(project_dir, db_path=db_path)

            with closing(sqlite3.connect(db_path)) as conn:
                self.assertEqual(conn.execute("SELECT COUNT(*) FROM projects").fetchone()[0], 1)
                self.assertEqual(conn.execute("SELECT COUNT(*) FROM files").fetchone()[0], 6)
                self.assertEqual(conn.execute("SELECT COUNT(*) FROM drawings").fetchone()[0], 1)
                self.assertEqual(conn.execute("SELECT COUNT(*) FROM materials").fetchone()[0], 3)
                self.assertEqual(
                    conn.execute("SELECT COUNT(*) FROM scan_history").fetchone()[0],
                    2,
                )

    def test_scan_project_records_error_when_project_json_is_missing(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            db_path = root / "project_vault.db"
            initialize_database(db_path)
            project_dir = root / "No Metadata"
            project_dir.mkdir()

            with self.assertRaises(ValueError):
                scan_project(project_dir, db_path=db_path)

            with closing(sqlite3.connect(db_path)) as conn:
                history = conn.execute(
                    "SELECT event_type, status, message FROM scan_history"
                ).fetchone()
                self.assertEqual(history[0], "full_scan")
                self.assertEqual(history[1], "error")
                self.assertIn("project_json_missing", history[2])


if __name__ == "__main__":
    unittest.main()
