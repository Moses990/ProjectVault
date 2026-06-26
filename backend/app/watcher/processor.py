"""Consumes debounced watcher events and triggers incremental scans."""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path

from app.db.database import connect
from app.scanner.incremental_scanner import scan_project_incremental
from app.watcher.queue import DebouncedEventQueue

logger = logging.getLogger(__name__)


def _find_project_for_path(file_path: Path, db_path: Path | None = None) -> str | None:
    """Return the project_id whose project_path is a parent of *file_path*."""
    with connect(db_path) as conn:
        rows = conn.execute(
            "SELECT id, project_path FROM projects WHERE project_path IS NOT NULL"
        ).fetchall()
    for row in rows:
        project_root = Path(row["project_path"]).resolve()
        try:
            file_path.resolve().relative_to(project_root)
            return row["id"]
        except ValueError:
            continue
    return None


async def run_watcher_loop(
    queue: DebouncedEventQueue,
    db_path: Path | None = None,
    scan_cooldown: float = 10.0,
) -> None:
    """Long-running consumer: pull events → resolve projects → scan.

    *scan_cooldown* prevents the same project from being scanned more than
    once within the given window (seconds).
    """
    last_scan: dict[str, float] = {}

    while True:
        events = await queue.get_ready()
        affected_projects: set[str] = set()

        for event in events:
            project_id = _find_project_for_path(event.path, db_path=db_path)
            if project_id:
                affected_projects.add(project_id)

        import time

        now = time.monotonic()
        for project_id in affected_projects:
            if now - last_scan.get(project_id, 0) < scan_cooldown:
                logger.debug("Skipping scan for %s (cooldown)", project_id)
                continue
            try:
                project_path = _get_project_path(project_id, db_path=db_path)
                if project_path is None:
                    continue
                logger.info("Watcher triggered scan for project %s", project_id)
                await asyncio.to_thread(scan_project_incremental, project_path, db_path)
                last_scan[project_id] = time.monotonic()
            except Exception:
                logger.exception("Watcher scan failed for project %s", project_id)


def _get_project_path(project_id: str, db_path: Path | None = None) -> str | None:
    with connect(db_path) as conn:
        row = conn.execute(
            "SELECT project_path FROM projects WHERE id = ?", (project_id,)
        ).fetchone()
    return row["project_path"] if row else None
