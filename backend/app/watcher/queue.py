import asyncio
import time

from app.watcher.events import WatchEvent, should_ignore_path


class DebouncedEventQueue:
    def __init__(self, debounce_seconds: float = 2.0) -> None:
        self.debounce_seconds = debounce_seconds
        self._pending: dict[tuple[str, str], tuple[WatchEvent, float]] = {}
        self._ready = asyncio.Event()

    @property
    def pending_count(self) -> int:
        return len(self._pending)

    async def put(self, event: WatchEvent, now: float | None = None) -> None:
        if should_ignore_path(event.path):
            return
        if event.source_path is not None and should_ignore_path(event.source_path):
            return

        event_time = time.monotonic() if now is None else now
        self._pending[event.dedupe_key] = (event, event_time)
        self._ready.set()

    async def drain_ready(self, now: float | None = None) -> list[WatchEvent]:
        current_time = time.monotonic() if now is None else now
        ready_keys = [
            key
            for key, (_, event_time) in self._pending.items()
            if current_time - event_time >= self.debounce_seconds
        ]
        ready_events = [self._pending.pop(key)[0] for key in ready_keys]
        if not self._pending:
            self._ready.clear()
        return ready_events

    async def get_ready(self) -> list[WatchEvent]:
        while True:
            events = await self.drain_ready()
            if events:
                return events
            await self._ready.wait()
            if self.debounce_seconds > 0:
                await asyncio.sleep(self.debounce_seconds)
