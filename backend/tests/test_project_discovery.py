import json
import sqlite3
import unittest
from contextlib import closing
from pathlib import Path
from tempfile import TemporaryDirectory

from app.db.database import initialize_database
from app.projects.discovery import discover_project_candidates
from app.projects.initializer import initialize_projects


class ProjectDiscoveryTests(unittest.TestCase):
    def test_candidates_only_include_first_level_folders_without_project_json(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            candidate = root / "Candidate"
            existing = root / "Existing"
            nested = root / "Container" / "NestedCandidate"
            candidate.mkdir()
            existing.mkdir()
            nested.mkdir(parents=True)
            (existing / "project.json").write_text("{}", encoding="utf-8")

            candidates = discover_project_candidates(root)

            self.assertEqual([item.folder_name for item in candidates], ["Candidate", "Container"])
            self.assertEqual((candidate / "project.json").exists(), False)
            self.assertNotIn(str(nested), [item.absolute_path for item in candidates])

    def test_candidate_discovery_does_not_write_database(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            (root / "Candidate").mkdir()
            db_path = root / "project_vault.db"
            initialize_database(db_path)

            discover_project_candidates(root)

            with closing(sqlite3.connect(db_path)) as conn:
                count = conn.execute("SELECT COUNT(*) FROM projects").fetchone()[0]
                self.assertEqual(count, 0)

    def test_initialize_projects_writes_project_json_and_project_record(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            project_dir = root / "Lobby Renovation"
            project_dir.mkdir()
            db_path = root / "project_vault.db"
            initialize_database(db_path)

            result = initialize_projects([project_dir], db_path=db_path, default_tags=["retail"])

            self.assertEqual(result.initialized_count, 1)
            self.assertEqual(result.skipped, [])
            project_json = project_dir / "project.json"
            self.assertTrue(project_json.exists())

            data = json.loads(project_json.read_text(encoding="utf-8"))
            self.assertEqual(data["name"], "Lobby Renovation")
            self.assertEqual(data["tags"], ["retail"])
            self.assertIn(data["project_id"], result.project_ids)

            with closing(sqlite3.connect(db_path)) as conn:
                row = conn.execute(
                    "SELECT id, name, project_path FROM projects"
                ).fetchone()
                self.assertEqual(row[0], data["project_id"])
                self.assertEqual(row[1], "Lobby Renovation")
                self.assertEqual(row[2], str(project_dir.resolve()))

    def test_initialize_projects_skips_existing_project_json(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            project_dir = root / "Existing"
            project_dir.mkdir()
            (project_dir / "project.json").write_text("{}", encoding="utf-8")
            db_path = root / "project_vault.db"
            initialize_database(db_path)

            result = initialize_projects([project_dir], db_path=db_path)

            self.assertEqual(result.initialized_count, 0)
            self.assertEqual(result.project_ids, [])
            self.assertEqual(result.skipped[0].reason, "project_json_exists")


if __name__ == "__main__":
    unittest.main()
