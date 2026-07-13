import asyncio
import json
import sqlite3
import threading
import unittest
from contextlib import closing, suppress
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from app.db.database import initialize_database
from app.scanner.full_scanner import scan_project
from app.scanner.incremental_scanner import scan_project_incremental
from app.watcher.events import FileEventType, WatchEvent
from app.watcher.processor import run_watcher_loop
from app.watcher.queue import DebouncedEventQueue


class WatcherProcessorTests(unittest.IsolatedAsyncioTestCase):
    async def test_watcher_uses_changed_paths_for_create_modify_delete_and_move(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            db_path = root / "project_vault.db"
            initialize_database(db_path)
            project_dir = root / "Alpha Store"
            project_dir.mkdir()
            (project_dir / "project.json").write_text(
                json.dumps({"project_id": "project-alpha", "name": "Alpha Store"}),
                encoding="utf-8",
            )
            brief = project_dir / "需求说明.txt"
            removed = project_dir / "废弃资料.txt"
            moved_from = project_dir / "移动资料.txt"
            brief.write_text("before", encoding="utf-8")
            removed.write_text("remove", encoding="utf-8")
            moved_from.write_text("move", encoding="utf-8")
            scan_project(project_dir, db_path=db_path)

            created = project_dir / "新增资料.txt"
            moved_to = project_dir / "归档" / "移动资料.txt"
            created.write_text("new", encoding="utf-8")
            brief.write_text("after", encoding="utf-8")
            removed.unlink()
            moved_to.parent.mkdir()
            moved_from.replace(moved_to)

            queue = DebouncedEventQueue(debounce_seconds=0)
            completed = threading.Event()

            def scan_and_signal(*args: object, **kwargs: object) -> object:
                try:
                    return scan_project_incremental(*args, **kwargs)
                finally:
                    completed.set()

            with patch("app.watcher.processor.scan_project_incremental", side_effect=scan_and_signal) as scan:
                task = asyncio.create_task(
                    run_watcher_loop(queue, db_path=db_path, scan_cooldown=0)
                )
                try:
                    await queue.put(WatchEvent(FileEventType.CREATED, created))
                    await queue.put(WatchEvent(FileEventType.MODIFIED, brief))
                    await queue.put(WatchEvent(FileEventType.DELETED, removed))
                    await queue.put(
                        WatchEvent(FileEventType.MOVED, moved_to, source_path=moved_from)
                    )
                    self.assertTrue(await asyncio.to_thread(completed.wait, 1))
                finally:
                    task.cancel()
                    with suppress(asyncio.CancelledError):
                        await task

            self.assertEqual(
                set(scan.call_args.kwargs["changed_paths"]),
                {created, brief, removed, moved_from, moved_to},
            )
            with closing(sqlite3.connect(db_path)) as conn:
                paths = {row[0] for row in conn.execute("SELECT relative_path FROM files")}
            self.assertIn("新增资料.txt", paths)
            self.assertIn("归档/移动资料.txt", paths)
            self.assertNotIn("废弃资料.txt", paths)

    async def test_watcher_delays_instead_of_dropping_events_inside_cooldown(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            db_path = root / "project_vault.db"
            initialize_database(db_path)
            project_dir = root / "Alpha Store"
            project_dir.mkdir()
            (project_dir / "project.json").write_text(
                json.dumps({"project_id": "project-alpha", "name": "Alpha Store"}),
                encoding="utf-8",
            )
            scan_project(project_dir, db_path=db_path)
            first = project_dir / "first.txt"
            second = project_dir / "second.txt"
            queue = DebouncedEventQueue(debounce_seconds=0)
            calls: list[set[Path]] = []
            second_scan_complete = threading.Event()

            def scan_and_record(*args: object, **kwargs: object) -> object:
                try:
                    return scan_project_incremental(*args, **kwargs)
                finally:
                    calls.append(set(kwargs["changed_paths"]))
                    if len(calls) == 2:
                        second_scan_complete.set()

            with patch("app.watcher.processor.scan_project_incremental", side_effect=scan_and_record):
                task = asyncio.create_task(
                    run_watcher_loop(queue, db_path=db_path, scan_cooldown=0.2)
                )
                try:
                    first.write_text("first", encoding="utf-8")
                    await queue.put(WatchEvent(FileEventType.CREATED, first))
                    for _ in range(50):
                        if calls:
                            break
                        await asyncio.sleep(0.01)
                    self.assertEqual(len(calls), 1)
                    await asyncio.sleep(0.05)
                    second.write_text("second", encoding="utf-8")
                    await queue.put(WatchEvent(FileEventType.CREATED, second))
                    self.assertTrue(await asyncio.to_thread(second_scan_complete.wait, 1))
                finally:
                    task.cancel()
                    with suppress(asyncio.CancelledError):
                        await task

            self.assertEqual(calls, [{first}, {second}])


if __name__ == "__main__":
    unittest.main()
