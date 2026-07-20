import json
import sqlite3
import unittest
from contextlib import closing
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from app.db.database import connect as database_connect
from app.db.database import initialize_database
from app.scanner.full_scanner import scan_project
from app.search.indexer import rebuild_search_index
from app.search.service import search_page


def write_project(path: Path, project_id: str, name: str) -> None:
    path.mkdir()
    (path / "project.json").write_text(json.dumps({
        "project_id": project_id,
        "name": name,
        "type": "retail",
        "phase": "design",
        "status": "healthy",
        "manager": "",
        "tags": ["展厅"],
        "ai": {"summary": ""},
        "schema_version": 1,
    }, ensure_ascii=False), encoding="utf-8")


class Phase9SearchContractTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.db_path = self.root / "project_vault.db"
        initialize_database(self.db_path)
        self.project = self.root / "示例项目甲"
        write_project(self.project, "p-alpha", "示例项目甲")
        (self.project / "0522").mkdir()
        (self.project / "0522" / "A1平面图.dwg").write_bytes(b"dwg")
        (self.project / "0608").mkdir()
        (self.project / "0608" / "玻璃清单.pdf").write_bytes(b"pdf")
        (self.project / "0608" / "说明.txt").write_text("note", encoding="utf-8")
        self.other = self.root / "示例项目乙"
        write_project(self.other, "p-beta", "示例项目乙")
        (self.other / "0522").mkdir()
        (self.other / "0522" / "平面方案.dwg").write_bytes(b"dwg")
        scan_project(self.project, db_path=self.db_path)
        scan_project(self.other, db_path=self.db_path)
        rebuild_search_index(db_path=self.db_path)

    def tearDown(self) -> None:
        self.temp.cleanup()

    def test_unified_results_merge_physical_files_and_keep_real_fields(self) -> None:
        page = search_page("平面", limit=20, db_path=self.db_path)
        drawing = next(item for item in page.items if item.title == "A1平面图.dwg")
        self.assertEqual(drawing.entity_type, "drawing")
        self.assertEqual(drawing.project_name, "示例项目甲")
        self.assertEqual(drawing.relative_path, "0522/A1平面图.dwg")
        self.assertEqual(drawing.parent_path, "0522")
        self.assertEqual(drawing.extension, ".dwg")
        self.assertTrue(drawing.file_id)
        self.assertTrue(drawing.available)
        self.assertEqual(drawing.labels, ("file", "drawing"))
        self.assertEqual(sum(item.title == "A1平面图.dwg" for item in page.items), 1)

    def test_type_project_pagination_and_stable_order(self) -> None:
        all_items = search_page("平面", limit=20, db_path=self.db_path)
        drawing_only = search_page("平面", entity_type="drawing", limit=1, offset=0, db_path=self.db_path)
        next_page = search_page("平面", limit=1, offset=1, db_path=self.db_path)
        repeated = search_page("平面", limit=20, db_path=self.db_path)
        self.assertGreaterEqual(all_items.total, 2)
        self.assertEqual(drawing_only.total, 2)
        self.assertTrue(drawing_only.has_more)
        self.assertEqual(next_page.offset, 1)
        self.assertEqual([item.result_id for item in all_items.items], [item.result_id for item in repeated.items])
        self.assertTrue(all(item.entity_type == "drawing" for item in drawing_only.items))

    def test_project_filter_and_aliases(self) -> None:
        page = search_page("CAD", entity_type="drawing", project_id="p-alpha", db_path=self.db_path)
        self.assertEqual(page.total, 1)
        self.assertEqual(page.items[0].project_id, "p-alpha")
        self.assertEqual(page.items[0].match_source, "alias")

    def test_unified_results_keep_indexed_knowledge(self) -> None:
        with database_connect(self.db_path) as conn:
            conn.execute(
                "UPDATE ai_metadata SET summary = ? WHERE project_id = ?",
                ("handover strategy", "p-alpha"),
            )
        rebuild_search_index(db_path=self.db_path)

        page = search_page("handover", entity_type="knowledge", db_path=self.db_path)

        self.assertEqual(page.total, 1)
        self.assertEqual(page.items[0].entity_type, "knowledge")
        self.assertEqual(page.items[0].project_id, "p-alpha")
        self.assertEqual(page.items[0].labels, ("knowledge",))
        self.assertTrue(page.items[0].available)

    def test_unavailable_file_and_read_only_search(self) -> None:
        path = self.project / "0608" / "玻璃清单.pdf"
        path.unlink()
        before = self._counts()
        page = search_page("玻璃", db_path=self.db_path)
        after = self._counts()
        material = next(item for item in page.items if item.entity_type == "material")
        self.assertFalse(material.available)
        self.assertEqual(before, after)

    def test_highlighted_content_is_plain_safe_text(self) -> None:
        with closing(sqlite3.connect(self.db_path)) as conn:
            conn.execute("UPDATE fts_global SET content = '说明 <script>alert(1)</script>' WHERE entity_type = 'file' AND title = '说明.txt'")
            conn.commit()
        page = search_page("说明", db_path=self.db_path)
        self.assertEqual(page.total, 1)
        self.assertNotIn("<script>", page.items[0].highlighted_content)
        self.assertIn("&lt;script&gt;", page.items[0].highlighted_content)

    def test_metadata_queries_do_not_scale_with_result_count(self) -> None:
        statements: list[str] = []

        def counted_connect(path: Path):
            manager = database_connect(path)

            class CountingContext:
                def __enter__(self):
                    conn = manager.__enter__()
                    conn.set_trace_callback(statements.append)
                    return conn

                def __exit__(self, *args):
                    return manager.__exit__(*args)

            return CountingContext()

        with patch("app.search.service.connect", counted_connect):
            page = search_page("平面", limit=20, db_path=self.db_path)

        selects = [statement for statement in statements if statement.lstrip().upper().startswith("SELECT")]
        self.assertGreater(len(page.items), 1)
        self.assertLessEqual(len(selects), 6)

    def test_large_result_set_batches_metadata_lookups(self) -> None:
        count = 33_000
        files = [
            (f"bulk-{index}", "p-alpha", f"bulk/{index}.txt", "bulk", f"bulk-{index}.txt", ".txt")
            for index in range(count)
        ]
        with database_connect(self.db_path) as conn:
            conn.executemany(
                """
                INSERT INTO files(id, project_id, relative_path, relative_dir, file_name, extension)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                files,
            )
            conn.executemany(
                """
                INSERT INTO fts_global(entity_id, entity_type, title, content, project_id)
                VALUES (?, 'file', ?, 'bulkcommon', 'p-alpha')
                """,
                ((file_id, file_name) for file_id, _, _, _, file_name, _ in files),
            )

        page = search_page("bulkcommon", limit=20, db_path=self.db_path)

        self.assertEqual(page.total, count)
        self.assertEqual(len(page.items), 20)

    def _counts(self) -> tuple[int, int, int, int, int]:
        with closing(sqlite3.connect(self.db_path)) as conn:
            return tuple(conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0] for table in ("projects", "files", "drawings", "materials", "fts_global"))


if __name__ == "__main__":
    unittest.main()
