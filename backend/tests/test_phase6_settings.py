import asyncio
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from pydantic import ValidationError

from app.api.settings import SettingsRequest
from app.db.database import connect, initialize_database
from app.main import lifespan
from app.services.settings import settings_get, settings_put


class Phase6SettingsTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = TemporaryDirectory()
        self.root = Path(self.temp.name) / "项目库"
        self.root.mkdir()
        self.db_path = Path(self.temp.name) / "project_vault.db"
        initialize_database(self.db_path)

    def tearDown(self) -> None:
        self.temp.cleanup()

    def test_all_settings_persist_and_legacy_table_is_supported(self) -> None:
        with connect(self.db_path) as conn:
            conn.execute("DROP TABLE system_settings")
            conn.execute("CREATE TABLE system_settings (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)")

        saved = settings_put({
            "root_path": f"  {self.root}  ",
            "scan_interval": 45,
            "auto_scan": False,
            "backup_retention": 7,
            "theme": "light",
            "onboarding_completed": True,
        }, db_path=self.db_path)
        restarted = settings_get(self.db_path)

        self.assertEqual(saved, restarted)
        self.assertEqual(restarted["root_path"], str(self.root.resolve()))
        self.assertTrue(restarted["root_path_accessible"])
        self.assertEqual(restarted["scan_interval"], 45)
        self.assertFalse(restarted["auto_scan"])
        self.assertEqual(restarted["backup_retention"], 7)
        self.assertEqual(restarted["theme"], "light")
        self.assertTrue(restarted["onboarding_completed"])

    def test_root_path_and_numeric_validation(self) -> None:
        invalid_file = Path(self.temp.name) / "file.txt"
        invalid_file.write_text("x", encoding="utf-8")
        base = {"root_path": str(self.root)}
        cases = [
            ({"root_path": "   "}, "root_path_required"),
            ({"root_path": str(Path(self.temp.name) / "missing")}, "root_path_invalid"),
            ({"root_path": str(invalid_file)}, "root_path_unreadable"),
            ({**base, "scan_interval": 0}, "scan_interval_invalid"),
            ({**base, "scan_interval": "bad"}, "scan_interval_invalid"),
            ({**base, "backup_retention": 0}, "backup_retention_invalid"),
            ({**base, "theme": "sepia"}, "theme_invalid"),
        ]
        for payload, message in cases:
            with self.subTest(message=message), self.assertRaisesRegex(ValueError, message):
                settings_put(payload, db_path=self.db_path)

    def test_unknown_api_fields_are_rejected(self) -> None:
        with self.assertRaises(ValidationError):
            SettingsRequest.model_validate({"root_path": str(self.root), "unknown": True})


class Phase6WatcherStartupTests(unittest.IsolatedAsyncioTestCase):
    async def test_auto_scan_false_does_not_start_watcher(self) -> None:
        with patch("app.main.initialize_database"), patch(
            "app.main.settings_get",
            return_value={"root_path": "D:\\Library", "auto_scan": False, "scan_interval": 60},
        ), patch("app.main.FileWatcherService") as watcher:
            async with lifespan(MagicMock()):
                await asyncio.sleep(0)
        watcher.assert_not_called()

    async def test_scan_interval_is_used_as_watcher_cooldown(self) -> None:
        service = MagicMock()
        processor = AsyncMock(return_value=None)
        with patch("app.main.initialize_database"), patch(
            "app.main.settings_get",
            return_value={"root_path": str(Path.cwd()), "auto_scan": True, "scan_interval": 75},
        ), patch("app.main.FileWatcherService", return_value=service), patch("app.main.run_watcher_loop", processor):
            async with lifespan(MagicMock()):
                await asyncio.sleep(0)
        service.start.assert_called_once()
        self.assertEqual(processor.await_args.kwargs["scan_cooldown"], 75.0)


if __name__ == "__main__":
    unittest.main()
