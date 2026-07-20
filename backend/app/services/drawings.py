"""Drawing and material domain."""

from __future__ import annotations

from pathlib import Path

from app.db.database import connect
from app.services import clamp_page, clamp_limit, ensure_project_exists, row_to_dict


def list_project_drawings(
    project_id: str,
    category: str | None = None,
    db_path: Path | None = None,
) -> list[dict[str, object]]:
    filters = ["d.project_id = ?"]
    params: list[object] = [project_id]
    if category:
        filters.append("d.dwg_category = ?")
        params.append(category)
    with connect(db_path) as conn:
        ensure_project_exists(conn, project_id)
        rows = conn.execute(
            f"""
            SELECT d.id, d.file_id, d.project_id, f.file_name, f.relative_path, f.size_bytes, f.extension,
                   d.dwg_category, d.version_group, d.version_number,
                   d.is_current, d.last_modified
            FROM drawings d
            JOIN files f ON f.id = d.file_id
            WHERE {' AND '.join(filters)}
            ORDER BY d.last_modified DESC, f.file_name ASC
            """,
            params,
        ).fetchall()
    return [row_to_dict(row) for row in rows]


def list_project_materials(
    project_id: str,
    material_type: str | None = None,
    db_path: Path | None = None,
) -> list[dict[str, object]]:
    filters = ["m.project_id = ?"]
    params: list[object] = [project_id]
    if material_type:
        filters.append("m.material_type = ?")
        params.append(material_type)
    with connect(db_path) as conn:
        ensure_project_exists(conn, project_id)
        rows = conn.execute(
            f"""
            SELECT m.id, m.file_id, m.project_id, m.material_type, f.file_name,
                   f.relative_path, f.extension, f.size_bytes, f.last_modified,
                   CASE WHEN f.id IS NULL THEN 0 ELSE 1 END AS available
            FROM materials m
            LEFT JOIN files f ON f.id = m.file_id
            WHERE {' AND '.join(filters)}
            ORDER BY f.last_modified DESC, f.file_name ASC
            """,
            params,
        ).fetchall()
    items = [row_to_dict(row) for row in rows]
    for item in items:
        item["available"] = bool(item["available"])
    return items


def drawings_center(
    page: int = 1,
    limit: int = 50,
    sort_by: str = "last_modified",
    category: str | None = None,
    q: str | None = None,
    project_id: str | None = None,
    db_path: Path | None = None,
) -> tuple[list[dict[str, object]], int, int, int, dict[str, int]]:
    sort_columns = {
        "last_modified": "d.last_modified",
        "file_name": "f.file_name",
        "project_name": "p.name",
    }
    if sort_by not in sort_columns:
        raise ValueError("sort_by_invalid")
    base_filters: list[str] = []
    base_params: list[object] = []
    if project_id:
        base_filters.append("d.project_id = ?")
        base_params.append(project_id)
    if q:
        base_filters.append("(f.file_name LIKE ? OR f.relative_path LIKE ? OR p.name LIKE ?)")
        pattern = f"%{q}%"
        base_params.extend([pattern, pattern, pattern])
    filters = [*base_filters]
    params = [*base_params]
    if category:
        filters.append("d.dwg_category = ?")
        params.append(category)
    where = f"WHERE {' AND '.join(filters)}" if filters else ""
    base_where = f"WHERE {' AND '.join(base_filters)}" if base_filters else ""
    resolved_page = clamp_page(page)
    resolved_limit = clamp_limit(limit)
    offset = (resolved_page - 1) * resolved_limit
    with connect(db_path) as conn:
        total = int(
            conn.execute(
                f"""
                SELECT COUNT(*) AS total
                FROM drawings d
                JOIN files f ON f.id = d.file_id
                JOIN projects p ON p.id = d.project_id
                {where}
                """,
                params,
            ).fetchone()["total"]
        )
        rows = conn.execute(
            f"""
            SELECT d.id AS drawing_id, d.project_id, p.name AS project_name,
                   f.file_name, f.relative_path, d.dwg_category, d.version_group,
                   d.version_number, d.last_modified, f.size_bytes
            FROM drawings d
            JOIN files f ON f.id = d.file_id
            JOIN projects p ON p.id = d.project_id
            {where}
            ORDER BY {sort_columns[sort_by]} DESC
            LIMIT ? OFFSET ?
            """,
            [*params, resolved_limit, offset],
        ).fetchall()
        category_rows = conn.execute(
            f"""
            SELECT COALESCE(d.dwg_category, 'UNCLASSIFIED') AS category,
                   COUNT(*) AS total
            FROM drawings d
            JOIN files f ON f.id = d.file_id
            JOIN projects p ON p.id = d.project_id
            {base_where}
            GROUP BY COALESCE(d.dwg_category, 'UNCLASSIFIED')
            """,
            base_params,
        ).fetchall()
    category_counts = {str(row["category"]): int(row["total"]) for row in category_rows}
    return [row_to_dict(row) for row in rows], total, resolved_page, resolved_limit, category_counts


def drawing_versions(drawing_id: str, db_path: Path | None = None) -> dict[str, object]:
    with connect(db_path) as conn:
        drawing = conn.execute(
            "SELECT project_id, version_group FROM drawings WHERE id = ?",
            (drawing_id,),
        ).fetchone()
        if drawing is None:
            raise ValueError("drawing_not_found")
        rows = conn.execute(
            """
            SELECT d.id, f.file_name, d.version_number, d.last_modified, d.is_current
            FROM drawings d
            JOIN files f ON f.id = d.file_id
            WHERE d.project_id = ? AND COALESCE(d.version_group, '') = COALESCE(?, '')
            ORDER BY d.version_number DESC, d.last_modified DESC
            """,
            (drawing["project_id"], drawing["version_group"]),
        ).fetchall()
    return {
        "drawing_id": drawing_id,
        "version_group": drawing["version_group"] or "",
        "version_chain": [row_to_dict(row) for row in rows],
    }
