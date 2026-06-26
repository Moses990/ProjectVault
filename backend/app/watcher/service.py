from pathlib import Path

from watchdog.observers import Observer

from app.watcher.adapter import WatchdogEventAdapter


class FileWatcherService:
    def __init__(self, queue: object) -> None:
        self.queue = queue
        self._observer: Observer | None = None

    @property
    def is_running(self) -> bool:
        return self._observer is not None and self._observer.is_alive()

    def start(self, root_path: str | Path) -> None:
        if self._observer is not None:
            raise RuntimeError("watcher_already_running")
        root = Path(root_path).expanduser().resolve()
        if not root.exists() or not root.is_dir():
            raise ValueError("root_path_invalid")

        observer = Observer()
        observer.schedule(WatchdogEventAdapter(self.queue), str(root), recursive=True)
        observer.start()
        self._observer = observer

    def stop(self) -> None:
        if self._observer is None:
            return
        observer = self._observer
        self._observer = None
        observer.stop()
        observer.join(timeout=5)
