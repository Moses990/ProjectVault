import json
import sqlite3
import time
import unittest
from contextlib import closing
from pathlib import Path
from tempfile import TemporaryDirectory

from app.db.database import initialize_database
from app.scanner.full_scanner import scan_project
from app.search.indexer import rebuild_search_index
from app.search.service import search


def write_project_json(project_dir: Path, project_id: str = "project-search") -> None:
    data = {
        "project_id": project_id,
        "name": "Beacon Retail Lab",
        "type": "retail",
        "phase": "concept",
        "status": "healthy",
        "manager": "Lena",
        "tags": ["flagship", "lighting"],
        "ai": {
            "summary": "Warm lighting concept with acoustic material strategy",
            "core_needs": ["wayfinding"],
            "special_reqs": ["night facade"],
            "risks": ["lead time"],
            "lessons": ["mockup early"],
        },
        "schema_version": 1,
    }
    (project_dir / "project.json").write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


class SearchIndexTests(unittest.TestCase):
    def create_sample_project(self, root: Path) -> Path:
        project_dir = root / "Beacon Retail Lab"
        project_dir.mkdir()
        write_project_json(project_dir)
        (project_dir / "brief.txt").write_text("brand narrative", encoding="utf-8")
        (project_dir / "drawings").mkdir()
        (project_dir / "drawings" / "ceiling_lighting_plan.dwg").write_bytes(b"dwg")
        (project_dir / "materials").mkdir()
        (project_dir / "materials" / "acoustic_panel_spec.pdf").write_bytes(b"pdf")
        return project_dir

    def test_rebuild_search_index_populates_all_v1_entity_types(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            db_path = root / "project_vault.db"
            initialize_database(db_path)
            project_dir = self.create_sample_project(root)
            scan_project(project_dir, db_path=db_path)

            result = rebuild_search_index(db_path=db_path)

            self.assertEqual(result.indexed_count, 7)
            with closing(sqlite3.connect(db_path)) as conn:
                rows = conn.execute(
                    """
                    SELECT entity_type, title
                    FROM fts_global
                    ORDER BY entity_type, title
                    """
                ).fetchall()
            self.assertEqual(
                rows,
                [
                    ("cad", "ceiling_lighting_plan.dwg"),
                    ("file", "acoustic_panel_spec.pdf"),
                    ("file", "brief.txt"),
                    ("file", "ceiling_lighting_plan.dwg"),
                    ("file", "project.json"),
                    ("material", "acoustic_panel_spec.pdf"),
                    ("project", "Beacon Retail Lab"),
                ],
            )

    def test_search_finds_project_file_cad_material_tags_and_summary(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            db_path = root / "project_vault.db"
            initialize_database(db_path)
            scan_project(self.create_sample_project(root), db_path=db_path)
            rebuild_search_index(db_path=db_path)

            self.assertEqual(search("Beacon", db_path=db_path)[0].entity_type, "project")
            self.assertTrue(
                any(
                    item.entity_id == "project-search"
                    for item in search("project-search", db_path=db_path)
                )
            )
            self.assertTrue(
                any(item.entity_type == "file" for item in search("brief", db_path=db_path))
            )
            self.assertTrue(
                any(item.entity_type == "cad" for item in search("ceiling", db_path=db_path))
            )
            self.assertTrue(
                any(
                    item.entity_type == "material"
                    for item in search("acoustic", category="materials", db_path=db_path)
                )
            )
            self.assertTrue(
                any(item.entity_type == "project" for item in search("flagship", db_path=db_path))
            )
            self.assertTrue(
                any(item.entity_type == "project" for item in search("strategy", db_path=db_path))
            )

    def test_search_10000_files_returns_under_100ms(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            db_path = root / "project_vault.db"
            initialize_database(db_path)
            project_dir = root / "Large Project"
            project_dir.mkdir()
            write_project_json(project_dir, project_id="project-large")
            batch_dir = project_dir / "batch"
            batch_dir.mkdir()
            for index in range(10000):
                (batch_dir / f"fixture_{index:05d}.txt").write_text(
                    f"ordinary file {index}",
                    encoding="utf-8",
                )
            (batch_dir / "needle_global_search.txt").write_text(
                "phase seven needle content",
                encoding="utf-8",
            )
            scan_project(project_dir, db_path=db_path)
            rebuild_search_index(db_path=db_path)

            started = time.perf_counter()
            results = search("needle", db_path=db_path, limit=10)
            elapsed_ms = (time.perf_counter() - started) * 1000

            self.assertTrue(any(item.title == "needle_global_search.txt" for item in results))
            self.assertLess(elapsed_ms, 100)


if __name__ == "__main__":
    unittest.main()
