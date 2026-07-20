import json
import sqlite3
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from fastapi import HTTPException

from app.api.files import get_project_resources
from app.api.materials import get_project_materials
from app.api.projects import get_project_overview, get_projects
from app.db.database import initialize_database
from app.scanner.full_scanner import scan_project


def create_project(root: Path) -> Path:
    project = root / "项目 12"
    project.mkdir()
    (project / "project.json").write_text(json.dumps({"project_id": "p8-library", "name": "项目 12", "schema_version": 1}), encoding="utf-8")
    (project / "alpha2.txt").write_text("two", encoding="utf-8")
    (project / "alpha10.txt").write_text("ten", encoding="utf-8")
    (project / "beta2.txt").write_text("two", encoding="utf-8")
    (project / "beta10.txt").write_text("ten", encoding="utf-8")
    (project / "空目录").mkdir()
    nested = project / "资料"
    nested.mkdir()
    (nested / "已索引.txt").write_text("indexed", encoding="utf-8")
    return project


class Phase8ProjectLibraryTests(unittest.TestCase):
    def test_resources_preserve_empty_directories_and_index_provenance(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            db_path = root / "vault.db"
            initialize_database(db_path)
            project = create_project(root)
            scan_project(project, db_path=db_path)
            (project / "未索引.txt").write_text("new", encoding="utf-8")
            (project / "alpha2.txt").unlink()

            with patch("app.api.files.get_database_path", return_value=db_path):
                response = get_project_resources("p8-library")
                nested = get_project_resources("p8-library", directory="资料")

            data = response["data"]
            self.assertIn("空目录", [folder["name"] for folder in data["folders"]])
            files = {item["file_name"]: item for item in data["files"]}
            names = [item["file_name"] for item in data["files"]]
            self.assertLess(names.index("beta2.txt"), names.index("beta10.txt"))
            self.assertFalse(files["未索引.txt"]["indexed"])
            self.assertFalse(files["alpha2.txt"]["available"])
            self.assertTrue(files["alpha2.txt"]["indexed"])
            self.assertEqual(nested["data"]["files"][0]["file_name"], "已索引.txt")
            self.assertNotIn("absolute_path", files["未索引.txt"])

    def test_resources_reject_escape_paths_and_project_list_searches_path(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            db_path = root / "vault.db"
            initialize_database(db_path)
            project = create_project(root)
            scan_project(project, db_path=db_path)

            with patch("app.api.files.get_database_path", return_value=db_path):
                with self.assertRaises(HTTPException) as parent_escape:
                    get_project_resources("p8-library", directory="../outside")
                with self.assertRaises(HTTPException) as absolute_escape:
                    get_project_resources("p8-library", directory="C:\\outside")
            with patch("app.api.projects.get_database_path", return_value=db_path):
                listed = get_projects(q=str(root.resolve()), page=1, limit=10)
                overview = get_project_overview("p8-library")

            self.assertEqual(parent_escape.exception.status_code, 400)
            self.assertEqual(absolute_escape.exception.status_code, 400)
            self.assertEqual(listed["meta"]["total"], 1)
            self.assertEqual(overview["data"]["schema_version"], 1)
            self.assertIn("created_at", overview["data"])

    def test_materials_keep_missing_file_rows(self) -> None:
        with TemporaryDirectory() as temp_dir:
            db_path = Path(temp_dir) / "vault.db"
            initialize_database(db_path)
            conn = sqlite3.connect(db_path)
            try:
                conn.execute(
                    "INSERT INTO projects (id, project_path, name) VALUES (?, ?, ?)",
                    ("p8-materials", str(Path(temp_dir) / "项目"), "材料项目"),
                )
                # Fixture represents a stale material row from an older index.
                conn.execute(
                    "INSERT INTO materials (id, project_id, file_id, material_type) VALUES (?, ?, ?, ?)",
                    ("m8-missing", "p8-materials", "f8-missing", "pdf"),
                )
                conn.commit()
            finally:
                conn.close()

            with patch("app.api.materials.get_database_path", return_value=db_path):
                response = get_project_materials("p8-materials")

            self.assertEqual(len(response["data"]), 1)
            material = response["data"][0]
            self.assertFalse(material["available"])
            self.assertIsNone(material["file_name"])

    def test_resources_reject_reparse_directories(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            db_path = root / "vault.db"
            initialize_database(db_path)
            project = create_project(root)
            scan_project(project, db_path=db_path)
            linked = project / "链接目录"
            linked.mkdir()

            with patch("app.api.files.get_database_path", return_value=db_path), patch(
                "app.services.files.Path.is_junction", new=lambda path: path.name == "链接目录"
            ):
                with self.assertRaises(HTTPException) as reparse_directory:
                    get_project_resources("p8-library", directory="链接目录")

            self.assertEqual(reparse_directory.exception.status_code, 400)


if __name__ == "__main__":
    unittest.main()
