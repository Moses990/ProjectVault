import unittest
from dataclasses import dataclass
from pathlib import Path

from app.watcher.adapter import WatchdogEventAdapter
from app.watcher.events import FileEventType, WatchEvent


class RecordingQueue:
    def __init__(self) -> None:
        self.events: list[WatchEvent] = []

    def put_nowait(self, event: WatchEvent) -> None:
        self.events.append(event)


@dataclass(frozen=True)
class FakeWatchdogEvent:
    event_type: str
    src_path: str
    dest_path: str = ""
    is_directory: bool = False


class WatchdogAdapterTests(unittest.TestCase):
    def test_adapter_converts_file_events_without_database_access(self) -> None:
        queue = RecordingQueue()
        adapter = WatchdogEventAdapter(queue)

        adapter.dispatch(FakeWatchdogEvent("created", "D:/Project/new.pdf"))
        adapter.dispatch(FakeWatchdogEvent("modified", "D:/Project/brief.txt"))
        adapter.dispatch(FakeWatchdogEvent("deleted", "D:/Project/old.pdf"))
        adapter.dispatch(
            FakeWatchdogEvent(
                "moved",
                "D:/Project/brief.txt",
                "D:/Project/archive/brief.txt",
            )
        )

        self.assertEqual(
            [event.event_type for event in queue.events],
            [
                FileEventType.CREATED,
                FileEventType.MODIFIED,
                FileEventType.DELETED,
                FileEventType.MOVED,
            ],
        )
        self.assertEqual(queue.events[-1].source_path, Path("D:/Project/brief.txt"))
        self.assertEqual(queue.events[-1].path, Path("D:/Project/archive/brief.txt"))

    def test_adapter_ignores_directories_and_temporary_files(self) -> None:
        queue = RecordingQueue()
        adapter = WatchdogEventAdapter(queue)

        adapter.dispatch(FakeWatchdogEvent("created", "D:/Project/New Folder", is_directory=True))
        adapter.dispatch(FakeWatchdogEvent("created", "D:/Project/Thumbs.db"))

        self.assertEqual(queue.events, [])


if __name__ == "__main__":
    unittest.main()
