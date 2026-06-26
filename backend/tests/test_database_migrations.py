import sqlite3
import unittest
from contextlib import closing
from pathlib import Path
from tempfile import TemporaryDirectory

from app.db.database import initialize_database


EXPECTED_TABLES = {
    "projects",
    "files",
    "drawings",
    "materials",
    "ai_metadata",
    "project_tags",
    "ai_providers",
    "scan_history",
    "system_settings",
    "app_metadata",
    "favorites",
    "schema_migrations",
    "fts_global",
}


def table_names(conn: sqlite3.Connection) -> set[str]:
    rows = conn.execute(
        "SELECT name FROM sqlite_master WHERE type IN ('table', 'virtual')"
    ).fetchall()
    return {row[0] for row in rows}


def index_names(conn: sqlite3.Connection) -> set[str]:
    rows = conn.execute("SELECT name FROM sqlite_master WHERE type = 'index'").fetchall()
    return {row[0] for row in rows}


class DatabaseMigrationTests(unittest.TestCase):
    def db_path(self, temp_dir: TemporaryDirectory[str]) -> Path:
        return Path(temp_dir.name) / "project_vault.db"

    def test_initialize_database_creates_complete_v1_schema(self) -> None:
        with TemporaryDirectory() as temp_dir:
            db_path = Path(temp_dir) / "project_vault.db"

            initialize_database(db_path)

            with closing(sqlite3.connect(db_path)) as conn:
                existing_tables = table_names(conn)
                self.assertTrue(EXPECTED_TABLES.issubset(existing_tables))
                self.assertEqual(conn.execute("PRAGMA user_version").fetchone()[0], 1)
                self.assertEqual(
                    conn.execute("PRAGMA journal_mode").fetchone()[0].lower(),
                    "wal",
                )
                self.assertEqual(conn.execute("PRAGMA auto_vacuum").fetchone()[0], 2)

    def test_initialize_database_records_migration_and_is_idempotent(self) -> None:
        with TemporaryDirectory() as temp_dir:
            db_path = Path(temp_dir) / "project_vault.db"

            initialize_database(db_path)
            initialize_database(db_path)

            with closing(sqlite3.connect(db_path)) as conn:
                rows = conn.execute(
                    "SELECT version FROM schema_migrations ORDER BY version"
                ).fetchall()
                self.assertEqual([row[0] for row in rows], ["1"])

    def test_files_use_project_relative_path_as_unique_identity(self) -> None:
        with TemporaryDirectory() as temp_dir:
            db_path = Path(temp_dir) / "project_vault.db"
            initialize_database(db_path)

            with closing(sqlite3.connect(db_path)) as conn:
                conn.execute(
                    """
                    INSERT INTO projects (id, project_path, name)
                    VALUES ('project-1', 'D:/Example/Project', 'Example')
                    """
                )
                conn.execute(
                    """
                    INSERT INTO files (id, project_id, relative_path, file_name)
                    VALUES ('file-1', 'project-1', 'drawings/a.dwg', 'a.dwg')
                    """
                )

                with self.assertRaises(sqlite3.IntegrityError):
                    conn.execute(
                        """
                        INSERT INTO files (id, project_id, relative_path, file_name)
                        VALUES ('file-2', 'project-1', 'drawings/a.dwg', 'a-copy.dwg')
                        """
                    )

    def test_schema_contains_required_indexes_and_no_file_path_column(self) -> None:
        with TemporaryDirectory() as temp_dir:
            db_path = Path(temp_dir) / "project_vault.db"
            initialize_database(db_path)

            with closing(sqlite3.connect(db_path)) as conn:
                indexes = index_names(conn)
                self.assertTrue(
                    {
                        "idx_projects_name",
                        "idx_projects_phase_updated",
                        "idx_files_project_modified",
                        "idx_drawings_group_modified",
                        "idx_history_project_created",
                    }.issubset(indexes)
                )

                file_columns = {
                    row[1] for row in conn.execute("PRAGMA table_info(files)").fetchall()
                }
                self.assertNotIn("file_path", file_columns)
                self.assertIn("relative_path", file_columns)

    def test_database_can_be_recreated_after_delete(self) -> None:
        with TemporaryDirectory() as temp_dir:
            db_path = Path(temp_dir) / "project_vault.db"

            initialize_database(db_path)
            db_path.unlink()
            initialize_database(db_path)

            with closing(sqlite3.connect(db_path)) as conn:
                self.assertTrue(EXPECTED_TABLES.issubset(table_names(conn)))

    def test_existing_database_is_converted_to_incremental_auto_vacuum(self) -> None:
        with TemporaryDirectory() as temp_dir:
            db_path = Path(temp_dir) / "project_vault.db"
            with closing(sqlite3.connect(db_path)) as conn:
                conn.execute("CREATE TABLE legacy_table (id TEXT PRIMARY KEY)")
                conn.commit()

            initialize_database(db_path)

            with closing(sqlite3.connect(db_path)) as conn:
                self.assertEqual(conn.execute("PRAGMA auto_vacuum").fetchone()[0], 2)


if __name__ == "__main__":
    unittest.main()
