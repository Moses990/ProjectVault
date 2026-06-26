import asyncio
from pathlib import Path
from typing import Any

from watchdog.events import FileSystemEventHandler

from app.watcher.events import FileEventType, WatchEvent, should_ignore_path


EVENT_TYPE_MAP = {
    "created": FileEventType.CREATED,
    "modified": FileEventType.MODIFIED,
    "deleted": FileEventType.DELETED,
    "moved": FileEventType.MOVED,
}


class WatchdogEventAdapter(FileSystemEventHandler):
    def __init__(self, queue: Any) -> None:
        self.queue = queue

    def dispatch(self, event: Any) -> None:
        if getattr(event, "is_directory", False):
            return

        event_type = EVENT_TYPE_MAP.get(getattr(event, "event_type", ""))
        if event_type is None:
            return

        source_path = Path(event.src_path) if getattr(event, "src_path", "") else None
        target_path = Path(getattr(event, "dest_path", "") or event.src_path)
        if should_ignore_path(target_path):
            return
        if source_path is not None and should_ignore_path(source_path):
            return

        watch_event = WatchEvent(
            event_type=event_type,
            path=target_path,
            source_path=source_path if event_type == FileEventType.MOVED else None,
        )
        self._enqueue(watch_event)

    def _enqueue(self, event: WatchEvent) -> None:
        if hasattr(self.queue, "put_nowait"):
            self.queue.put_nowait(event)
            return

        result = self.queue.put(event)
        if asyncio.iscoroutine(result):
            try:
                loop = asyncio.get_running_loop()
            except RuntimeError:
                asyncio.run(result)
            else:
                loop.create_task(result)
