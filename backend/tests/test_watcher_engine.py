import asyncio
import unittest
from pathlib import Path

from app.watcher.events import FileEventType, WatchEvent, should_ignore_path
from app.watcher.queue import DebouncedEventQueue


class WatcherEngineTests(unittest.IsolatedAsyncioTestCase):
    def test_temporary_files_are_ignored_before_entering_queue(self) -> None:
        ignored_paths = [
            Path("draft.bak"),
            Path("drawing.sv$"),
            Path("cad.ac$"),
            Path("~$proposal.docx"),
            Path("~$budget.xlsx"),
            Path(".DS_Store"),
            Path("Thumbs.db"),
            Path("desktop.ini"),
            Path(".tmp") / "work.bin",
            Path(".cache") / "thumb.webp",
        ]

        self.assertTrue(all(should_ignore_path(path) for path in ignored_paths))
        self.assertFalse(should_ignore_path(Path("drawings") / "floor_plan.dwg"))

    async def test_create_modify_delete_and_move_events_enter_queue(self) -> None:
        queue = DebouncedEventQueue(debounce_seconds=0)

        await queue.put(WatchEvent(FileEventType.CREATED, Path("new.pdf")))
        await queue.put(WatchEvent(FileEventType.MODIFIED, Path("brief.txt")))
        await queue.put(WatchEvent(FileEventType.DELETED, Path("old.pdf")))
        await queue.put(
            WatchEvent(
                FileEventType.MOVED,
                Path("archive") / "brief.txt",
                source_path=Path("brief.txt"),
            )
        )

        events = await queue.drain_ready()

        self.assertEqual(
            [event.event_type for event in events],
            [
                FileEventType.CREATED,
                FileEventType.MODIFIED,
                FileEventType.DELETED,
                FileEventType.MOVED,
            ],
        )
        self.assertEqual(events[-1].source_path, Path("brief.txt"))
        self.assertEqual(events[-1].path, Path("archive") / "brief.txt")

    async def test_debounce_merges_repeated_events_for_same_path(self) -> None:
        queue = DebouncedEventQueue(debounce_seconds=2)

        await queue.put(WatchEvent(FileEventType.CREATED, Path("brief.txt")), now=100.0)
        await queue.put(WatchEvent(FileEventType.MODIFIED, Path("brief.txt")), now=101.0)

        self.assertEqual(await queue.drain_ready(now=101.5), [])
        events = await queue.drain_ready(now=103.1)

        self.assertEqual(len(events), 1)
        self.assertEqual(events[0].event_type, FileEventType.MODIFIED)
        self.assertEqual(events[0].path, Path("brief.txt"))

    async def test_ignored_events_never_enter_queue(self) -> None:
        queue = DebouncedEventQueue(debounce_seconds=0)

        await queue.put(WatchEvent(FileEventType.CREATED, Path("Thumbs.db")))

        self.assertEqual(await queue.drain_ready(), [])
        self.assertEqual(queue.pending_count, 0)

    async def test_queue_can_wait_for_ready_events(self) -> None:
        queue = DebouncedEventQueue(debounce_seconds=0)
        await queue.put(WatchEvent(FileEventType.CREATED, Path("brief.txt")))

        events = await asyncio.wait_for(queue.get_ready(), timeout=0.5)

        self.assertEqual(len(events), 1)
        self.assertEqual(events[0].path, Path("brief.txt"))


if __name__ == "__main__":
    unittest.main()
