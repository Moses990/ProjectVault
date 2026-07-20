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
            (root / "03_CAD图纸").mkdir()
            (existing / "project.json").write_text("{}", encoding="utf-8")

            candidates = discover_project_candidates(root)

            self.assertEqual(
                [item.folder_name for item in candidates],
                ["03_CAD图纸", "Candidate", "Container", "Existing"],
            )
            self.assertEqual(candidates[0].category, "suspected_subdirectory")
            self.assertEqual(candidates[-1].category, "existing_project")
            self.assertEqual((candidate / "project.json").exists(), False)
            self.assertNotIn(str(nested), [item.absolute_path for item in candidates])

    def test_project_subdirectories_are_not_project_candidates(self) -> None:
        with TemporaryDirectory() as temp_dir:
            library_root = Path(temp_dir)
            project_root = library_root / "示例展厅"
            project_root.mkdir()
            for name in (
                "00_项目档案",
                "01_项目前期资料",
                "02_需求资料",
                "03_CAD图纸",
                "04_效果图",
                "05_汇报文件",
                "06_材料资料",
                "07_现场资料",
            ):
                (project_root / name).mkdir()

            candidates = discover_project_candidates(library_root)
            self.assertEqual([item.folder_name for item in candidates], ["示例展厅"])
            self.assertEqual(candidates[0].category, "pending_project")
            self.assertTrue(candidates[0].selectable)

            with self.assertRaisesRegex(ValueError, "root_path_looks_like_project"):
                discover_project_candidates(project_root)

    def test_structured_and_ordinary_candidates_include_explanations(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            structured = root / "Structured"
            structured.mkdir()
            for name in ("00_项目档案", "01_项目前期资料", "02_需求资料"):
                (structured / name).mkdir()

            ordinary = root / "普通项目"
            ordinary.mkdir()
            for name in ("平面方案.dwg", "汇报.pdf", "效果图.jpg"):
                (ordinary / name).write_bytes(b"fixture")

            candidates = {item.folder_name: item for item in discover_project_candidates(root)}

            self.assertEqual(candidates["Structured"].candidate_type, "structured_project_candidate")
            self.assertEqual(candidates["Structured"].confidence, "high")
            self.assertTrue(candidates["Structured"].requires_confirmation)
            self.assertEqual(candidates["普通项目"].candidate_type, "ordinary_project_candidate")
            self.assertTrue(candidates["普通项目"].selectable)
            self.assertTrue(candidates["普通项目"].requires_confirmation)
            self.assertFalse(candidates["普通项目"].will_write_project_json)
            self.assertTrue(any("设计类文件" in item for item in candidates["普通项目"].evidence))

    def test_ambiguous_subdirectory_name_is_not_auto_promoted(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            cad = root / "CAD"
            cad.mkdir()
            (cad / "reference.dwg").write_bytes(b"fixture")

            candidate = discover_project_candidates(root)[0]

            self.assertEqual(candidate.candidate_type, "suspected_project_subdirectory")
            self.assertEqual(candidate.confidence, "low")
            self.assertTrue(candidate.requires_confirmation)
            self.assertFalse(candidate.will_write_project_json)

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

            result = initialize_projects(
                [project_dir],
                db_path=db_path,
                default_tags=["retail"],
                confirmed_paths=[project_dir],
            )

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

    def test_initialize_projects_skips_standard_project_directory(self) -> None:
        with TemporaryDirectory() as temp_dir:
            project_dir = Path(temp_dir) / "03_CAD图纸"
            project_dir.mkdir()

            result = initialize_projects([project_dir])

            self.assertEqual(result.initialized_count, 0)
            self.assertEqual(result.project_ids, [])
            self.assertEqual(result.skipped[0].reason, "standard_project_directory")
            self.assertFalse((project_dir / "project.json").exists())

    def test_initialize_projects_skips_system_directory(self) -> None:
        with TemporaryDirectory() as temp_dir:
            project_dir = Path(temp_dir) / ".git"
            project_dir.mkdir()

            result = initialize_projects([project_dir], confirmed_paths=[project_dir])

            self.assertEqual(result.initialized_count, 0)
            self.assertEqual(result.skipped[0].reason, "non_project_directory")
            self.assertFalse((project_dir / "project.json").exists())


if __name__ == "__main__":
    unittest.main()
