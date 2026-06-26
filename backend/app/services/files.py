"""File domain: listing, asset resolution, explorer operations."""

from __future__ import annotations

import mimetypes
import os
import shutil
import subprocess
from pathlib import Path

from app.db.database import connect
from app.services import ResolvedAsset, clamp_page, clamp_limit, ensure_project_exists, row_to_dict


def list_project_files(
    project_id: str,
    *,
    directory: str | None = None,
    extension: str | None = None,
    page: int = 1,
    limit: int = 50,
    sort_by: str = "name",
    order: str = "asc",
    db_path: Path | None = None,
) -> tuple[list[dict[str, object]], int, int, int]:
    sort_columns = {
        "name": "file_name",
        "size": "size_bytes",
        "modified": "last_modified",
        "relative_path": "relative_path",
    }
    if sort_by not in sort_columns:
        raise ValueError("sort_by_invalid")
    normalized_order = order.lower()
    if normalized_order not in {"asc", "desc"}:
        raise ValueError("order_invalid")

    filters = ["project_id = ?"]
    params: list[object] = [project_id]
    if directory is not None:
        filters.append("relative_dir = ?")
        params.append(directory.strip("/"))
    if extension:
        filters.append("extension = ?")
        normalized_extension = extension.lower()
        if not normalized_extension.startswith("."):
            normalized_extension = f".{normalized_extension}"
        params.append(normalized_extension)
    where = " AND ".join(filters)
    resolved_page = clamp_page(page)
    resolved_limit = clamp_limit(limit)
    offset = (resolved_page - 1) * resolved_limit

    with connect(db_path) as conn:
        ensure_project_exists(conn, project_id)
        total = int(
            conn.execute(
                f"SELECT COUNT(*) AS total FROM files WHERE {where}",
                params,
            ).fetchone()["total"]
        )
        rows = conn.execute(
            f"""
            SELECT id, file_name, relative_path, relative_dir, extension,
                   size_bytes, last_modified
            FROM files
            WHERE {where}
            ORDER BY {sort_columns[sort_by]} {normalized_order.upper()}
            LIMIT ? OFFSET ?
            """,
            [*params, resolved_limit, offset],
        ).fetchall()
    return [row_to_dict(row) for row in rows], total, resolved_page, resolved_limit


def resolve_asset(file_id: str, db_path: Path | None = None) -> ResolvedAsset:
    with connect(db_path) as conn:
        row = conn.execute(
            """
            SELECT f.id, f.project_id, f.relative_path, p.project_path
            FROM files f
            JOIN projects p ON p.id = f.project_id
            WHERE f.id = ?
            """,
            (file_id,),
        ).fetchone()
        if row is None:
            raise ValueError("file_not_found")
    project_root = Path(row["project_path"]).resolve()
    absolute_path = (project_root / row["relative_path"]).resolve()
    if project_root != absolute_path and project_root not in absolute_path.parents:
        raise ValueError("file_outside_project")
    if not absolute_path.exists() or not absolute_path.is_file():
        raise FileNotFoundError("physical_file_missing")
    media_type = mimetypes.guess_type(str(absolute_path))[0] or "application/octet-stream"
    return ResolvedAsset(
        file_id=row["id"],
        project_id=row["project_id"],
        path=absolute_path,
        media_type=media_type,
    )


def _launch_system_path(path: Path) -> bool:
    if os.name == "nt":
        os.startfile(str(path))  # type: ignore[attr-defined]
        return True
    if shutil.which("open"):
        subprocess.Popen(["open", str(path)])
        return True
    if shutil.which("xdg-open"):
        subprocess.Popen(["xdg-open", str(path)])
        return True
    raise RuntimeError("system_open_unavailable")


def open_explorer_target(file_id: str, mode: str, db_path: Path | None = None) -> dict[str, object]:
    if mode not in {"open_file", "reveal_folder"}:
        raise ValueError("mode_invalid")
    asset = resolve_asset(file_id, db_path=db_path)
    target = asset.path if mode == "open_file" else asset.path.parent
    _launch_system_path(target)
    return {"success": True, "mode": mode, "file_id": asset.file_id}
