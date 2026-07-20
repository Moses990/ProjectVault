import json
import sqlite3
import unittest
from contextlib import closing
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from app.api.projects import InitializeProjectsRequest
from app.api.projects import get_project_candidates, post_initialize_projects
from app.db.database import initialize_database


class ProjectsApiTests(unittest.TestCase):
    def test_candidates_endpoint_returns_first_level_candidates(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            (root / "Candidate").mkdir()
            existing = root / "Existing"
            existing.mkdir()
            (existing / "project.json").write_text("{}", encoding="utf-8")

            body = get_project_candidates(str(root))

            self.assertEqual(body["status"], "success")
            self.assertEqual(body["data"][0]["folder_name"], "Candidate")
            self.assertIn("candidate_type", body["data"][0])
            self.assertIn("evidence", body["data"][0])
            self.assertFalse(body["data"][0]["will_write_project_json"])

    def test_initialize_endpoint_writes_project_json(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            project_dir = root / "Showroom"
            project_dir.mkdir()
            db_path = root / "project_vault.db"
            initialize_database(db_path)

            with patch("app.api.projects.initialize_projects") as mocked_initialize:
                from app.projects.initializer import initialize_projects
                from app.projects.initializer import result_to_dict

                def initialize_with_test_db(paths, default_tags, confirmed_paths):
                    return initialize_projects(
                        paths,
                        db_path=db_path,
                        default_tags=default_tags,
                        confirmed_paths=confirmed_paths,
                    )

                mocked_initialize.side_effect = initialize_with_test_db
                body = post_initialize_projects(
                    InitializeProjectsRequest(
                        paths=[str(project_dir)],
                        default_tags=["retail"],
                        confirmed_paths=[str(project_dir)],
                    )
                )

            self.assertEqual(body["status"], "success")
            self.assertEqual(body["data"]["initialized_count"], 1)
            project_json = json.loads(
                (project_dir / "project.json").read_text(encoding="utf-8")
            )
            self.assertEqual(project_json["tags"], ["retail"])
            with closing(sqlite3.connect(db_path)) as conn:
                count = conn.execute("SELECT COUNT(*) FROM projects").fetchone()[0]
                self.assertEqual(count, 1)


if __name__ == "__main__":
    unittest.main()
