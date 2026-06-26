import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from app.watcher.service import FileWatcherService


class WatcherServiceTests(unittest.TestCase):
    def test_service_starts_and_stops_on_valid_directory(self) -> None:
        with TemporaryDirectory() as temp_dir:
            service = FileWatcherService(queue=object())

            service.start(Path(temp_dir))
            self.assertTrue(service.is_running)

            service.stop()
            self.assertFalse(service.is_running)

    def test_service_rejects_invalid_directory(self) -> None:
        with TemporaryDirectory() as temp_dir:
            service = FileWatcherService(queue=object())

            with self.assertRaises(ValueError):
                service.start(Path(temp_dir) / "missing")

    def test_service_rejects_double_start(self) -> None:
        with TemporaryDirectory() as temp_dir:
            service = FileWatcherService(queue=object())
            service.start(Path(temp_dir))

            try:
                with self.assertRaises(RuntimeError):
                    service.start(Path(temp_dir))
            finally:
                service.stop()


if __name__ == "__main__":
    unittest.main()
