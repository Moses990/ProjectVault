from dataclasses import dataclass
from pathlib import Path
from typing import Any

from app.db.database import connect


@dataclass(frozen=True)
class SearchIndexResult:
    indexed_count: int
    project_id: str | None = None


def _text(*values: Any) -> str:
    parts: list[str] = []
    for value in values:
        if value is None:
            continue
        text = str(value).strip()
        if text:
            parts.append(text)
    return " ".join(parts)


def _insert_fts(
    conn: Any,
    *,
    entity_id: str,
    entity_type: str,
    title: str,
    content: str,
    project_id: str,
) -> None:
    conn.execute(
        """
        INSERT INTO fts_global (entity_id, entity_type, title, content, project_id)
        VALUES (?, ?, ?, ?, ?)
        """,
        (entity_id, entity_type, title, content, project_id),
    )


def _index_projects(conn: Any, project_id: str | None) -> int:
    params: tuple[str, ...] = (project_id,) if project_id else ()
    where = "WHERE p.id = ?" if project_id else ""
    rows = conn.execute(
        f"""
        SELECT p.id,
               p.name,
               p.type,
               p.phase,
               p.status,
               p.manager,
               p.project_hash,
               m.summary,
               m.core_needs,
               m.special_reqs,
               m.risks,
               m.lessons,
               GROUP_CONCAT(t.tag_name, ' ') AS tags
        FROM projects p
        LEFT JOIN ai_metadata m ON m.project_id = p.id
        LEFT JOIN project_tags t ON t.project_id = p.id
        {where}
        GROUP BY p.id
        """,
        params,
    ).fetchall()
    for row in rows:
        _insert_fts(
            conn,
            entity_id=row["id"],
            entity_type="project",
            title=row["name"],
            content=_text(
                row["id"],
                row["name"],
                row["type"],
                row["phase"],
                row["status"],
                row["manager"],
                row["project_hash"],
                row["tags"],
                row["summary"],
                row["core_needs"],
                row["special_reqs"],
                row["risks"],
                row["lessons"],
            ),
            project_id=row["id"],
        )
    return len(rows)


def _index_knowledge(conn: Any, project_id: str | None) -> int:
    params: tuple[str, ...] = (project_id,) if project_id else ()
    where = "WHERE p.id = ?" if project_id else ""
    rows = conn.execute(
        f"""
        SELECT p.id,
               p.name,
               m.summary,
               m.core_needs,
               m.special_reqs,
               m.risks,
               m.lessons,
               GROUP_CONCAT(t.tag_name, ' ') AS tags
        FROM projects p
        LEFT JOIN ai_metadata m ON m.project_id = p.id
        LEFT JOIN project_tags t ON t.project_id = p.id
        {where}
        GROUP BY p.id
        """,
        params,
    ).fetchall()
    count = 0
    for row in rows:
        content = _text(
            row["summary"],
            row["core_needs"],
            row["special_reqs"],
            row["risks"],
            row["lessons"],
            row["tags"],
        )
        if not content:
            continue
        _insert_fts(
            conn,
            entity_id=f"knowledge:{row['id']}",
            entity_type="knowledge",
            title=f"{row['name']} Knowledge",
            content=content,
            project_id=row["id"],
        )
        count += 1
    return count


def _index_files(conn: Any, project_id: str | None) -> int:
    params: tuple[str, ...] = (project_id,) if project_id else ()
    where = "WHERE project_id = ?" if project_id else ""
    rows = conn.execute(
        f"""
        SELECT id, project_id, relative_path, relative_dir, file_name, extension
        FROM files
        {where}
        """,
        params,
    ).fetchall()
    for row in rows:
        _insert_fts(
            conn,
            entity_id=row["id"],
            entity_type="file",
            title=row["file_name"],
            content=_text(
                row["file_name"],
                row["relative_path"],
                row["relative_dir"],
                row["extension"],
            ),
            project_id=row["project_id"],
        )
    return len(rows)


def _index_drawings(conn: Any, project_id: str | None) -> int:
    params: tuple[str, ...] = (project_id,) if project_id else ()
    where = "WHERE d.project_id = ?" if project_id else ""
    rows = conn.execute(
        f"""
        SELECT d.id,
               d.project_id,
               d.dwg_category,
               d.version_group,
               d.version_number,
               f.file_name,
               f.relative_path
        FROM drawings d
        JOIN files f ON f.id = d.file_id
        {where}
        """,
        params,
    ).fetchall()
    for row in rows:
        _insert_fts(
            conn,
            entity_id=row["id"],
            entity_type="cad",
            title=row["file_name"],
            content=_text(
                row["file_name"],
                row["relative_path"],
                row["dwg_category"],
                row["version_group"],
                row["version_number"],
            ),
            project_id=row["project_id"],
        )
    return len(rows)


def _index_materials(conn: Any, project_id: str | None) -> int:
    params: tuple[str, ...] = (project_id,) if project_id else ()
    where = "WHERE m.project_id = ?" if project_id else ""
    rows = conn.execute(
        f"""
        SELECT m.id,
               m.project_id,
               m.material_type,
               f.file_name,
               f.relative_path,
               f.extension
        FROM materials m
        JOIN files f ON f.id = m.file_id
        {where}
        """,
        params,
    ).fetchall()
    for row in rows:
        _insert_fts(
            conn,
            entity_id=row["id"],
            entity_type="material",
            title=row["file_name"],
            content=_text(
                row["file_name"],
                row["relative_path"],
                row["material_type"],
                row["extension"],
            ),
            project_id=row["project_id"],
        )
    return len(rows)


def rebuild_search_index(
    db_path: Path | None = None,
    project_id: str | None = None,
) -> SearchIndexResult:
    with connect(db_path) as conn:
        if project_id:
            conn.execute("DELETE FROM fts_global WHERE project_id = ?", (project_id,))
        else:
            conn.execute("DELETE FROM fts_global")

        indexed_count = 0
        indexed_count += _index_projects(conn, project_id)
        indexed_count += _index_knowledge(conn, project_id)
        indexed_count += _index_files(conn, project_id)
        indexed_count += _index_drawings(conn, project_id)
        indexed_count += _index_materials(conn, project_id)
        conn.execute("INSERT INTO fts_global(fts_global) VALUES('optimize')")

    return SearchIndexResult(indexed_count=indexed_count, project_id=project_id)


def refresh_search_index_entities(
    *,
    project_id: str,
    entity_ids: set[str],
    db_path: Path | None = None,
) -> SearchIndexResult:
    if not entity_ids:
        return SearchIndexResult(indexed_count=0, project_id=project_id)

    placeholders = ",".join("?" for _ in entity_ids)
    entity_params = tuple(sorted(entity_ids))

    with connect(db_path) as conn:
        conn.execute(
            f"""
            DELETE FROM fts_global
            WHERE project_id = ?
              AND entity_id IN ({placeholders})
            """,
            (project_id, *entity_params),
        )

        indexed_count = 0
        project_rows = conn.execute(
            f"""
            SELECT p.id,
                   p.name,
                   p.type,
                   p.phase,
                   p.status,
                   p.manager,
                   p.project_hash,
                   m.summary,
                   m.core_needs,
                   m.special_reqs,
                   m.risks,
                   m.lessons,
                   GROUP_CONCAT(t.tag_name, ' ') AS tags
            FROM projects p
            LEFT JOIN ai_metadata m ON m.project_id = p.id
            LEFT JOIN project_tags t ON t.project_id = p.id
            WHERE p.id = ?
              AND p.id IN ({placeholders})
            GROUP BY p.id
            """,
            (project_id, *entity_params),
        ).fetchall()
        for row in project_rows:
            _insert_fts(
                conn,
                entity_id=row["id"],
                entity_type="project",
                title=row["name"],
                content=_text(
                    row["id"],
                    row["name"],
                    row["type"],
                    row["phase"],
                    row["status"],
                    row["manager"],
                    row["project_hash"],
                    row["tags"],
                    row["summary"],
                    row["core_needs"],
                    row["special_reqs"],
                    row["risks"],
                    row["lessons"],
                ),
                project_id=row["id"],
            )
            indexed_count += 1

        if f"knowledge:{project_id}" in entity_ids:
            indexed_count += _index_knowledge(conn, project_id)

        file_rows = conn.execute(
            f"""
            SELECT id, project_id, relative_path, relative_dir, file_name, extension
            FROM files
            WHERE project_id = ?
              AND id IN ({placeholders})
            """,
            (project_id, *entity_params),
        ).fetchall()
        for row in file_rows:
            _insert_fts(
                conn,
                entity_id=row["id"],
                entity_type="file",
                title=row["file_name"],
                content=_text(
                    row["file_name"],
                    row["relative_path"],
                    row["relative_dir"],
                    row["extension"],
                ),
                project_id=row["project_id"],
            )
            indexed_count += 1

        drawing_rows = conn.execute(
            f"""
            SELECT d.id,
                   d.project_id,
                   d.dwg_category,
                   d.version_group,
                   d.version_number,
                   f.file_name,
                   f.relative_path
            FROM drawings d
            JOIN files f ON f.id = d.file_id
            WHERE d.project_id = ?
              AND d.id IN ({placeholders})
            """,
            (project_id, *entity_params),
        ).fetchall()
        for row in drawing_rows:
            _insert_fts(
                conn,
                entity_id=row["id"],
                entity_type="cad",
                title=row["file_name"],
                content=_text(
                    row["file_name"],
                    row["relative_path"],
                    row["dwg_category"],
                    row["version_group"],
                    row["version_number"],
                ),
                project_id=row["project_id"],
            )
            indexed_count += 1

        material_rows = conn.execute(
            f"""
            SELECT m.id,
                   m.project_id,
                   m.material_type,
                   f.file_name,
                   f.relative_path,
                   f.extension
            FROM materials m
            JOIN files f ON f.id = m.file_id
            WHERE m.project_id = ?
              AND m.id IN ({placeholders})
            """,
            (project_id, *entity_params),
        ).fetchall()
        for row in material_rows:
            _insert_fts(
                conn,
                entity_id=row["id"],
                entity_type="material",
                title=row["file_name"],
                content=_text(
                    row["file_name"],
                    row["relative_path"],
                    row["material_type"],
                    row["extension"],
                ),
                project_id=row["project_id"],
            )
            indexed_count += 1

        conn.execute("INSERT INTO fts_global(fts_global) VALUES('optimize')")

    return SearchIndexResult(indexed_count=indexed_count, project_id=project_id)
