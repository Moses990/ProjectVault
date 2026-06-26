"""Project domain: listing, overview, favorites, AI metadata."""

from __future__ import annotations

from pathlib import Path

from app.db.database import connect
from app.services import clamp_limit, clamp_page, ensure_project_exists, parse_json_list, row_to_dict


def dashboard_metrics(db_path: Path | None = None) -> dict[str, int]:
    with connect(db_path) as conn:
        row = conn.execute(
            """
            SELECT COUNT(*) AS project_total,
                   COALESCE(SUM(cad_count), 0) AS cad_total,
                   COALESCE(SUM(material_count), 0) AS material_total
            FROM projects
            """
        ).fetchone()
    return {
        "project_total": int(row["project_total"]),
        "cad_total": int(row["cad_total"]),
        "material_total": int(row["material_total"]),
    }


def recent_projects(limit: int = 10, db_path: Path | None = None) -> list[dict[str, object]]:
    with connect(db_path) as conn:
        rows = conn.execute(
            """
            SELECT id, name, phase, last_updated_at, file_count
            FROM projects
            ORDER BY COALESCE(last_updated_at, created_at) DESC, name ASC
            LIMIT ?
            """,
            (clamp_limit(limit),),
        ).fetchall()
    return [row_to_dict(row) for row in rows]


def list_projects(
    *,
    q: str | None = None,
    project_type: str | None = None,
    phase: str | None = None,
    page: int = 1,
    limit: int = 50,
    sort_by: str = "last_updated_at",
    order: str = "desc",
    db_path: Path | None = None,
) -> tuple[list[dict[str, object]], int, int, int]:
    sort_columns = {
        "name": "p.name",
        "type": "p.type",
        "phase": "p.phase",
        "last_updated_at": "p.last_updated_at",
        "file_count": "p.file_count",
        "cad_count": "p.cad_count",
        "material_count": "p.material_count",
    }
    if sort_by not in sort_columns:
        raise ValueError("sort_by_invalid")
    normalized_order = order.lower()
    if normalized_order not in {"asc", "desc"}:
        raise ValueError("order_invalid")

    filters: list[str] = []
    params: list[object] = []
    if q:
        filters.append("(p.name LIKE ? OR p.id LIKE ? OR p.manager LIKE ?)")
        pattern = f"%{q}%"
        params.extend([pattern, pattern, pattern])
    if project_type:
        filters.append("p.type = ?")
        params.append(project_type)
    if phase:
        filters.append("p.phase = ?")
        params.append(phase)
    where = f"WHERE {' AND '.join(filters)}" if filters else ""
    resolved_page = clamp_page(page)
    resolved_limit = clamp_limit(limit)
    offset = (resolved_page - 1) * resolved_limit

    with connect(db_path) as conn:
        total = int(
            conn.execute(
                f"SELECT COUNT(*) AS total FROM projects p {where}",
                params,
            ).fetchone()["total"]
        )
        rows = conn.execute(
            f"""
            SELECT p.id, p.name, p.type, p.phase, p.status, p.manager,
                   p.file_count, p.cad_count, p.material_count, p.last_updated_at,
                   CASE WHEN f.entity_id IS NULL THEN 0 ELSE 1 END AS is_favorite
            FROM projects p
            LEFT JOIN favorites f
              ON f.identity_type = 'project' AND f.entity_id = p.id
            {where}
            ORDER BY {sort_columns[sort_by]} {normalized_order.upper()}, p.name ASC
            LIMIT ? OFFSET ?
            """,
            [*params, resolved_limit, offset],
        ).fetchall()

    return [row_to_dict(row) for row in rows], total, resolved_page, resolved_limit


def set_project_favorite(
    project_id: str,
    is_favorite: bool,
    db_path: Path | None = None,
) -> dict[str, object]:
    with connect(db_path) as conn:
        ensure_project_exists(conn, project_id)
        if is_favorite:
            conn.execute(
                """
                INSERT OR IGNORE INTO favorites (identity_type, entity_id)
                VALUES ('project', ?)
                """,
                (project_id,),
            )
        else:
            conn.execute(
                "DELETE FROM favorites WHERE identity_type = 'project' AND entity_id = ?",
                (project_id,),
            )
    return {"id": project_id, "is_favorite": is_favorite}


def project_overview(project_id: str, db_path: Path | None = None) -> dict[str, object]:
    with connect(db_path) as conn:
        row = conn.execute(
            """
            SELECT p.id, p.name, p.project_path AS path, p.type, p.phase, p.status,
                   p.manager, p.file_count, p.cad_count, p.material_count,
                   p.last_updated_at, m.summary
            FROM projects p
            LEFT JOIN ai_metadata m ON m.project_id = p.id
            WHERE p.id = ?
            """,
            (project_id,),
        ).fetchone()
        if row is None:
            raise ValueError("project_not_found")
        tags = [
            item["tag_name"]
            for item in conn.execute(
                "SELECT tag_name FROM project_tags WHERE project_id = ? ORDER BY tag_name",
                (project_id,),
            ).fetchall()
        ]
    data = row_to_dict(row)
    data["tags"] = tags
    return data


def project_ai_metadata(project_id: str, db_path: Path | None = None) -> dict[str, object]:
    with connect(db_path) as conn:
        row = conn.execute(
            """
            SELECT summary, core_needs, special_reqs, risks, lessons
            FROM ai_metadata
            WHERE project_id = ?
            """,
            (project_id,),
        ).fetchone()
        if row is None:
            raise ValueError("ai_metadata_not_found")
    return {
        "summary": row["summary"] or "",
        "core_needs": parse_json_list(row["core_needs"]),
        "special_reqs": parse_json_list(row["special_reqs"]),
        "risks": parse_json_list(row["risks"]),
        "lessons": parse_json_list(row["lessons"]),
    }
