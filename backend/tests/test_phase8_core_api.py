import json
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from fastapi import HTTPException
from starlette.responses import FileResponse

from app.api.assets import get_asset_content
from app.api.dashboard import get_dashboard_metrics, get_recent_projects
from app.api.drawings import get_drawing_versions, get_drawings_center, get_project_drawings
from app.api.files import get_project_files
from app.api.history import get_history
from app.api.materials import get_project_materials
from app.api.projects import FavoriteRequest, get_project_overview, get_projects, post_project_favorite
from app.api.scanner import ScanProjectRequest, get_scanner_status, post_scanner_rebuild, post_scanner_scan
from app.api.settings import SettingsRequest, get_settings_api, put_settings_api
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
        "tags": ["flagship", "phase8"],
        "ai": {
            "summary": "Phase 8 sample summary",
            "core_needs": ["lighting"],
            "special_reqs": ["quiet entry"],
            "risks": ["schedule"],
            "lessons": ["mockup early"],
        },
        "schema_version": 1,
    }
    (project_dir / "project.json").write_text(
        json.dumps(data, ensure_ascii=False),
        encoding="utf-8",
    )


def create_project(root: Path, project_id: str = "project-phase8", name: str = "Phase Eight Store") -> Path:
    project_dir = root / name
    project_dir.mkdir()
    write_project_json(project_dir, project_id, name)
    (project_dir / "brief.txt").write_text("hello phase8", encoding="utf-8")
    (project_dir / "drawings").mkdir()
    (project_dir / "drawings" / "floor_plan_v1.dwg").write_bytes(b"dwg")
    (project_dir / "materials").mkdir()
    (project_dir / "materials" / "finish_board.pdf").write_bytes(b"pdf")
    return project_dir


class Phase8CoreApiTests(unittest.TestCase):
    def test_dashboard_projects_detail_files_drawings_materials_and_history(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            db_path = root / "project_vault.db"
            initialize_database(db_path)
            project_dir = create_project(root)
            scan_project(project_dir, db_path=db_path)

            with patch("app.api.dashboard.get_database_path", return_value=db_path):
                metrics = get_dashboard_metrics()
                recent = get_recent_projects(limit=5)
            self.assertEqual(metrics["data"]["project_total"], 1)
            self.assertEqual(metrics["data"]["cad_total"], 1)
            self.assertEqual(recent["data"][0]["id"], "project-phase8")

            with patch("app.api.projects.get_database_path", return_value=db_path):
                projects = get_projects(q="Phase", phase="design", page=1, limit=10)
                favorite = post_project_favorite(
                    "project-phase8",
                    FavoriteRequest(is_favorite=True),
                )
                overview = get_project_overview("project-phase8")
                ai = get_project_ai_metadata("project-phase8")
            self.assertEqual(projects["data"][0]["name"], "Phase Eight Store")
            self.assertEqual(projects["meta"]["total"], 1)
            self.assertTrue(favorite["data"]["is_favorite"])
            self.assertEqual(overview["data"]["path"], str(project_dir.resolve()))
            self.assertEqual(overview["data"]["tags"], ["flagship", "phase8"])
            self.assertEqual(ai["data"]["summary"], "Phase 8 sample summary")

            with patch("app.api.files.get_database_path", return_value=db_path):
                files = get_project_files("project-phase8", extension=".pdf")
            self.assertEqual(files["data"][0]["relative_path"], "materials/finish_board.pdf")
            self.assertNotIn("absolute_path", files["data"][0])

            with patch("app.api.drawings.get_database_path", return_value=db_path):
                drawings = get_project_drawings("project-phase8")
                center = get_drawings_center()
                versions = get_drawing_versions(drawings["data"][0]["id"])
            self.assertEqual(drawings["data"][0]["file_name"], "floor_plan_v1.dwg")
            self.assertEqual(center["data"][0]["project_name"], "Phase Eight Store")
            self.assertEqual(versions["data"]["version_chain"][0]["file_name"], "floor_plan_v1.dwg")

            with patch("app.api.materials.get_database_path", return_value=db_path):
                materials = get_project_materials("project-phase8")
            self.assertEqual(materials["data"][0]["file_name"], "finish_board.pdf")

            with patch("app.api.history.get_database_path", return_value=db_path):
                history = get_history(project_id="project-phase8")
            self.assertEqual(history["data"][0]["event_type"], "full_scan")

    def test_assets_resolve_by_file_id_and_reject_unknown_file(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            db_path = root / "project_vault.db"
            initialize_database(db_path)
            project_dir = create_project(root)
            scan_project(project_dir, db_path=db_path)

            with patch("app.api.files.get_database_path", return_value=db_path):
                files = get_project_files("project-phase8", extension=".txt")
            file_id = files["data"][0]["id"]

            with patch("app.api.assets.get_database_path", return_value=db_path):
                response = get_asset_content(file_id)
                with self.assertRaises(HTTPException) as raised:
                    get_asset_content("missing-file")

            self.assertIsInstance(response, FileResponse)
            self.assertEqual(raised.exception.status_code, 404)

    def test_settings_and_scanner_endpoints(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            db_path = root / "project_vault.db"
            initialize_database(db_path)
            project_dir = create_project(root)
            scan_project(project_dir, db_path=db_path)

            with patch("app.api.settings.get_database_path", return_value=db_path):
                updated = put_settings_api(
                    SettingsRequest(
                        root_path=str(root),
                        scan_interval=30,
                        theme="dark",
                    )
                )
                settings = get_settings_api()
            self.assertEqual(updated["data"]["root_path"], str(root))
            self.assertEqual(settings["data"]["scan_interval"], 30)

            with patch("app.api.scanner.get_database_path", return_value=db_path):
                status = get_scanner_status()
                scanned = post_scanner_scan(ScanProjectRequest(project_id="project-phase8"))
                rebuilt = post_scanner_rebuild(confirm=True)
            self.assertEqual(status["data"]["status"], "IDLE")
            self.assertEqual(scanned["data"]["project_id"], "project-phase8")
            self.assertIn("task_id", rebuilt["data"])


from app.api.projects import get_project_ai_metadata


if __name__ == "__main__":
    unittest.main()
