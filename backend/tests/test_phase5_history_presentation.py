import sqlite3
import unittest
from contextlib import closing, contextmanager
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from app.db.database import initialize_database
from app.services.settings import history_list


class Phase5HistoryPresentationTests(unittest.TestCase):
    def seed_history(self, db_path: Path) -> None:
        with closing(sqlite3.connect(db_path)) as conn:
            conn.execute(
                "INSERT INTO projects (id, project_path, name) VALUES ('project-1', '/fixture/one', '示例项目')"
            )
            conn.executemany(
                """
                INSERT INTO scan_history (
                    id, project_id, event_type, status, message, duration_ms,
                    affected_files, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    ("history-1", "project-1", "full_scan", "success", "full_scan_success", 8, 4, "2026-07-13T07:00:00+00:00"),
                    ("history-2", "project-1", "incremental_scan", "success", "created=1;updated=0;deleted=0;moved=0", 5, 1, "2026-07-13T08:00:00+00:00"),
                    ("history-system", None, "full_scan", "warning", None, None, None, "2026-07-13T09:00:00+00:00"),
                    ("history-missing", "removed-project", "incremental_scan", "failed", "technical detail", 3, 0, "2026-07-13T10:00:00+00:00"),
                ],
            )
            conn.commit()

    def test_history_join_handles_project_system_and_missing_project(self) -> None:
        with TemporaryDirectory() as temp_dir:
            db_path = Path(temp_dir) / "project_vault.db"
            initialize_database(db_path)
            self.seed_history(db_path)

            items, total, page, limit = history_list(db_path=db_path)

            self.assertEqual((total, page, limit), (4, 1, 50))
            self.assertEqual([item["id"] for item in items], ["history-missing", "history-system", "history-2", "history-1"])
            by_id = {item["id"]: item for item in items}
            self.assertEqual(by_id["history-1"]["project_name"], "示例项目")
            self.assertIsNone(by_id["history-system"]["project_name"])
            self.assertEqual(by_id["history-missing"]["project_id"], "removed-project")
            self.assertIsNone(by_id["history-missing"]["project_name"])

    def test_history_filter_pagination_sorting_and_join_use_two_queries(self) -> None:
        with TemporaryDirectory() as temp_dir:
            db_path = Path(temp_dir) / "project_vault.db"
            initialize_database(db_path)
            self.seed_history(db_path)
            statements: list[str] = []

            @contextmanager
            def traced_connect(_: Path | None = None):
                conn = sqlite3.connect(db_path)
                conn.row_factory = sqlite3.Row
                conn.set_trace_callback(statements.append)
                try:
                    yield conn
                finally:
                    conn.close()

            with patch("app.services.settings.connect", traced_connect):
                items, total, page, limit = history_list(
                    project_id="project-1", page=2, limit=1, db_path=db_path
                )

            selects = [statement for statement in statements if statement.lstrip().upper().startswith("SELECT")]
            self.assertEqual((total, page, limit), (2, 2, 1))
            self.assertEqual(items[0]["id"], "history-1")
            self.assertEqual(len(selects), 2)
            self.assertTrue(any("LEFT JOIN projects" in statement for statement in selects))


if __name__ == "__main__":
    unittest.main()
