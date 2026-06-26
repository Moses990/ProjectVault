import json
import sqlite3
import unittest
from contextlib import closing
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from app.api.drawings import get_drawing_versions, get_drawings_center
from app.db.database import initialize_database
from app.scanner.full_scanner import scan_project


def write_project_json(project_dir: Path, project_id: str, name: str) -> None:
    data = {
        "project_id": project_id,
        "name": name,
        "type": "retail",
        "phase": "design",
        "status": "healthy",
        "manager": "Mina",
        "tags": ["cad-center"],
        "ai": {"summary": "CAD Center sample"},
        "schema_version": 1,
    }
    (project_dir / "project.json").write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")


def create_cad_project(root: Path, project_id: str, name: str) -> Path:
    project_dir = root / name
    project_dir.mkdir()
    write_project_json(project_dir, project_id, name)
    drawings_dir = project_dir / "drawings"
    drawings_dir.mkdir()
    for file_name in [
        "A101_floor_plan_V1.dwg",
        "A101_floor_plan_V2.dwg",
        "A101_floor_plan_FINAL.dwg",
        "B201_立面_V1.dwg",
        "C301_天花_V1.dwg",
        "D401_节点_V1.dwg",
        "E501_构造_V1.dwg",
        "Z999_reference.dwg",
    ]:
        (drawings_dir / file_name).write_bytes(b"dwg")
    return project_dir


class Phase10CADCenterTests(unittest.TestCase):
    def test_scanner_classifies_phase10_categories_and_groups_version_chains(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            db_path = root / "project_vault.db"
            initialize_database(db_path)
            project_dir = create_cad_project(root, "project-cad10", "CAD Ten Store")

            scan_project(project_dir, db_path=db_path)

            with closing(sqlite3.connect(db_path)) as conn:
                conn.row_factory = sqlite3.Row
                rows = conn.execute(
                    """
                    SELECT f.file_name, d.dwg_category, d.version_group, d.version_number
                    FROM drawings d
                    JOIN files f ON f.id = d.file_id
                    ORDER BY f.file_name
                    """
                ).fetchall()

            by_name = {row["file_name"]: dict(row) for row in rows}
            self.assertEqual(by_name["A101_floor_plan_V1.dwg"]["dwg_category"], "PLAN")
            self.assertEqual(by_name["B201_立面_V1.dwg"]["dwg_category"], "ELEVATION")
            self.assertEqual(by_name["C301_天花_V1.dwg"]["dwg_category"], "CEILING")
            self.assertEqual(by_name["D401_节点_V1.dwg"]["dwg_category"], "DETAIL")
            self.assertEqual(by_name["E501_构造_V1.dwg"]["dwg_category"], "CONSTRUCTION")
            self.assertEqual(by_name["Z999_reference.dwg"]["dwg_category"], "UNKNOWN")

            self.assertEqual(by_name["A101_floor_plan_V1.dwg"]["version_group"], "a101_floor_plan")
            self.assertEqual(by_name["A101_floor_plan_V2.dwg"]["version_group"], "a101_floor_plan")
            self.assertEqual(by_name["A101_floor_plan_FINAL.dwg"]["version_group"], "a101_floor_plan")
            self.assertEqual(by_name["A101_floor_plan_V1.dwg"]["version_number"], 1)
            self.assertEqual(by_name["A101_floor_plan_V2.dwg"]["version_number"], 2)
            self.assertEqual(by_name["A101_floor_plan_FINAL.dwg"]["version_number"], 9999)

    def test_drawing_versions_return_same_project_chain_sorted_by_current_version(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            db_path = root / "project_vault.db"
            initialize_database(db_path)
            project_dir = create_cad_project(root, "project-cad10", "CAD Ten Store")
            scan_project(project_dir, db_path=db_path)

            with patch("app.api.drawings.get_database_path", return_value=db_path):
                center = get_drawings_center(category="PLAN", q="A101", sort_by="file_name")
                selected_id = center["data"][0]["drawing_id"]
                versions = get_drawing_versions(selected_id)

            self.assertEqual(center["meta"]["total"], 3)
            self.assertEqual(
                [item["file_name"] for item in versions["data"]["version_chain"]],
                [
                    "A101_floor_plan_FINAL.dwg",
                    "A101_floor_plan_V2.dwg",
                    "A101_floor_plan_V1.dwg",
                ],
            )
            self.assertEqual(versions["data"]["version_group"], "a101_floor_plan")


if __name__ == "__main__":
    unittest.main()