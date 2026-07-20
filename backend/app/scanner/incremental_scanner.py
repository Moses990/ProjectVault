import time
import uuid
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from app.db.database import connect
from app.scanner.classifiers import drawing_category, extract_version_group, guess_version_number, is_drawing, material_type
from app.scanner.full_scanner import (
    SCANNER_VERSION,
    build_file_records,
    file_hash,
    load_project_json,
    normalize_relative_path,
    project_hash,
    stable_id,
    utc_now,
    write_scan_history,
)
from app.search.indexer import rebuild_search_index, refresh_search_index_entities


@dataclass(frozen=True)
class IncrementalScanResult:
    project_id: str
    created_count: int
    updated_count: int
    deleted_count: int
    moved_count: int
    relocated: bool
    duration_ms: int

    @property
    def affected_files(self) -> int:
        return (
            self.created_count
            + self.updated_count
            + self.deleted_count
            + self.moved_count
        )


def content_signature(record: dict[str, Any]) -> tuple[int, str]:
    return (int(record["size_bytes"]), str(record["file_hash"]).split("|", 1)[-1])


def file_state_signature(record: dict[str, Any]) -> tuple[str, int, str]:
    return (
        str(record["relative_path"]),
        int(record["size_bytes"]),
        str(record["file_hash"]),
    )


def fetch_existing_files(conn: Any, project_id: str) -> dict[str, dict[str, Any]]:
    rows = conn.execute(
        """
        SELECT id, file_hash, relative_path, relative_dir, file_name, extension,
               size_bytes, last_modified
        FROM files
        WHERE project_id = ?
        """,
        (project_id,),
    ).fetchall()
    return {
        row["relative_path"]: {
            "id": row["id"],
            "file_hash": row["file_hash"],
            "relative_path": row["relative_path"],
            "relative_dir": row["relative_dir"],
            "file_name": row["file_name"],
            "extension": row["extension"],
            "size_bytes": row["size_bytes"],
            "last_modified": row["last_modified"],
        }
        for row in rows
    }


def fetch_existing_files_by_paths(
    conn: Any,
    project_id: str,
    relative_paths: set[str],
) -> dict[str, dict[str, Any]]:
    if not relative_paths:
        return {}
    placeholders = ",".join("?" for _ in relative_paths)
    rows = conn.execute(
        f"""
        SELECT id, file_hash, relative_path, relative_dir, file_name, extension,
               size_bytes, last_modified
        FROM files
        WHERE project_id = ?
          AND relative_path IN ({placeholders})
        """,
        (project_id, *tuple(sorted(relative_paths))),
    ).fetchall()
    return {
        row["relative_path"]: {
            "id": row["id"],
            "file_hash": row["file_hash"],
            "relative_path": row["relative_path"],
            "relative_dir": row["relative_dir"],
            "file_name": row["file_name"],
            "extension": row["extension"],
            "size_bytes": row["size_bytes"],
            "last_modified": row["last_modified"],
        }
        for row in rows
    }


def normalize_changed_path(project_dir: Path, path: str | Path) -> str | None:
    candidate = Path(path)
    if candidate.is_absolute():
        try:
            relative = candidate.resolve().relative_to(project_dir)
        except ValueError:
            return None
    else:
        relative = candidate
    if any(part == ".." for part in relative.parts):
        return None
    return normalize_relative_path(relative)


def build_single_file_record(
    project_dir: Path,
    project_id: str,
    relative_path: str,
) -> dict[str, Any] | None:
    absolute_path = (project_dir / relative_path).resolve()
    try:
        absolute_path.relative_to(project_dir)
    except ValueError:
        return None
    if not absolute_path.exists() or not absolute_path.is_file():
        return None
    stat = absolute_path.stat()
    from datetime import datetime, timezone

    modified = datetime.fromtimestamp(stat.st_mtime, timezone.utc).isoformat()
    relative_dir = normalize_relative_path(Path(relative_path).parent)
    if relative_dir == ".":
        relative_dir = ""
    return {
        "id": stable_id(project_id, relative_path),
        "project_id": project_id,
        "file_hash": file_hash(relative_path, stat.st_size, modified),
        "relative_path": relative_path,
        "relative_dir": relative_dir,
        "file_name": absolute_path.name,
        "extension": absolute_path.suffix.lower(),
        "size_bytes": stat.st_size,
        "last_modified": modified,
        "absolute_path": absolute_path,
    }


def file_content_fingerprint(record: dict[str, Any]) -> str:
    return f"{record['size_bytes']}::{record['last_modified']}"


def upsert_file(conn: Any, record: dict[str, Any], *, file_id: str | None = None) -> str:
    resolved_file_id = file_id or record["id"]
    conn.execute(
        """
        INSERT INTO files (
            id,
            project_id,
            file_hash,
            relative_path,
            relative_dir,
            file_name,
            extension,
            size_bytes,
            last_modified
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(project_id, relative_path) DO UPDATE SET
            file_hash = excluded.file_hash,
            relative_dir = excluded.relative_dir,
            file_name = excluded.file_name,
            extension = excluded.extension,
            size_bytes = excluded.size_bytes,
            last_modified = excluded.last_modified
        """,
        (
            resolved_file_id,
            record["project_id"],
            record["file_hash"],
            record["relative_path"],
            record["relative_dir"],
            record["file_name"],
            record["extension"],
            record["size_bytes"],
            record["last_modified"],
        ),
    )
    return resolved_file_id


def remove_file_dependents(conn: Any, file_id: str) -> None:
    conn.execute("DELETE FROM drawings WHERE file_id = ?", (file_id,))
    conn.execute("DELETE FROM materials WHERE file_id = ?", (file_id,))


def file_dependent_entity_ids(conn: Any, file_id: str) -> set[str]:
    rows = conn.execute(
        """
        SELECT id FROM drawings WHERE file_id = ?
        UNION
        SELECT id FROM materials WHERE file_id = ?
        """,
        (file_id, file_id),
    ).fetchall()
    return {row["id"] for row in rows}


def refresh_file_dependents(conn: Any, project_id: str, file_id: str, record: dict[str, Any]) -> None:
    remove_file_dependents(conn, file_id)
    absolute_path = record["absolute_path"]
    if is_drawing(absolute_path):
        conn.execute(
            """
            INSERT INTO drawings (
                id,
                project_id,
                file_id,
                dwg_category,
                version_group,
                version_number,
                is_current,
                last_modified
            )
            VALUES (?, ?, ?, ?, ?, ?, 1, ?)
            """,
            (
                stable_id(project_id, "drawing", record["relative_path"]),
                project_id,
                file_id,
                drawing_category(Path(record["relative_path"])),
                extract_version_group(absolute_path.name) or "",
                guess_version_number(absolute_path.name),
                record["last_modified"],
            ),
        )
    classified_material = material_type(absolute_path)
    if classified_material:
        conn.execute(
            """
            INSERT INTO materials (id, project_id, file_id, material_type)
            VALUES (?, ?, ?, ?)
            """,
            (
                stable_id(project_id, "material", record["relative_path"]),
                project_id,
                file_id,
                classified_material,
            ),
        )


def update_project_summary_from_database(
    conn: Any,
    project_dir: Path,
    project_data: dict[str, Any],
) -> None:
    project_id = str(project_data["project_id"])
    counts = conn.execute(
        """
        SELECT
            (SELECT COUNT(*) FROM files WHERE project_id = ?) AS file_count,
            (SELECT COUNT(*) FROM drawings WHERE project_id = ?) AS cad_count,
            (SELECT COUNT(*) FROM materials WHERE project_id = ?) AS material_count
        """,
        (project_id, project_id, project_id),
    ).fetchone()
    conn.execute(
        """
        UPDATE projects
        SET project_path = ?,
            name = ?,
            type = ?,
            phase = ?,
            status = ?,
            manager = ?,
            file_count = ?,
            cad_count = ?,
            material_count = ?,
            last_updated_at = ?
        WHERE id = ?
        """,
        (
            str(project_dir),
            str(project_data.get("name", "")),
            str(project_data.get("type", "")),
            str(project_data.get("phase", "")),
            str(project_data.get("status", "healthy")),
            str(project_data.get("manager", "")),
            int(counts["file_count"]),
            int(counts["cad_count"]),
            int(counts["material_count"]),
            utc_now(),
            project_id,
        ),
    )


def update_project_summary(
    conn: Any,
    project_dir: Path,
    project_data: dict[str, Any],
    file_records: list[dict[str, Any]],
) -> None:
    project_id = str(project_data["project_id"])
    cad_count = sum(1 for record in file_records if is_drawing(record["absolute_path"]))
    material_count = sum(1 for record in file_records if material_type(record["absolute_path"]))
    conn.execute(
        """
        UPDATE projects
        SET project_hash = ?,
            project_path = ?,
            name = ?,
            type = ?,
            phase = ?,
            status = ?,
            manager = ?,
            file_count = ?,
            cad_count = ?,
            material_count = ?,
            last_updated_at = ?
        WHERE id = ?
        """,
        (
            project_hash(file_records, project_data),
            str(project_dir),
            str(project_data.get("name", "")),
            str(project_data.get("type", "")),
            str(project_data.get("phase", "")),
            str(project_data.get("status", "healthy")),
            str(project_data.get("manager", "")),
            len(file_records),
            cad_count,
            material_count,
            utc_now(),
            project_id,
        ),
    )


def sync_project_metadata(conn: Any, project_data: dict[str, Any]) -> None:
    project_id = str(project_data["project_id"])
    conn.execute("DELETE FROM project_tags WHERE project_id = ?", (project_id,))
    for tag_name in project_data.get("tags", []):
        conn.execute(
            "INSERT OR IGNORE INTO project_tags (project_id, tag_name) VALUES (?, ?)",
            (project_id, str(tag_name)),
        )

    ai_data = project_data.get("ai", {})
    if not isinstance(ai_data, dict):
        ai_data = {}
    conn.execute(
        """
        INSERT INTO ai_metadata (
            project_id, summary, core_needs, special_reqs, risks, lessons, metadata_version
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(project_id) DO UPDATE SET
            summary = excluded.summary,
            core_needs = excluded.core_needs,
            special_reqs = excluded.special_reqs,
            risks = excluded.risks,
            lessons = excluded.lessons,
            metadata_version = excluded.metadata_version
        """,
        (
            project_id,
            str(ai_data.get("summary", "")),
            json.dumps(ai_data.get("core_needs", []), ensure_ascii=False),
            json.dumps(ai_data.get("special_reqs", []), ensure_ascii=False),
            json.dumps(ai_data.get("risks", []), ensure_ascii=False),
            json.dumps(ai_data.get("lessons", []), ensure_ascii=False),
            str(project_data.get("schema_version", 1)),
        ),
    )


def scan_project_incremental(
    project_path: str | Path,
    db_path: Path | None = None,
    changed_paths: list[str | Path] | None = None,
) -> IncrementalScanResult:
    started = time.perf_counter()
    project_dir = Path(project_path).expanduser().resolve()
    project_id: str | None = None
    fast_path_result: IncrementalScanResult | None = None
    fast_path_entity_ids: set[str] = set()
    created_count = 0
    updated_count = 0
    deleted_count = 0
    moved_count = 0
    relocated = False

    try:
        if not project_dir.exists() or not project_dir.is_dir():
            raise ValueError("project_path_invalid")

        project_data = load_project_json(project_dir)
        project_id = str(project_data["project_id"])
        normalized_changed_paths: set[str] | None = None
        if changed_paths is not None:
            normalized_changed_paths = {
                normalized
                for item in changed_paths
                if (normalized := normalize_changed_path(project_dir, item)) is not None
            }
            normalized_changed_paths.add("project.json")

        with connect(db_path) as conn:
            project_row = conn.execute(
                "SELECT project_path FROM projects WHERE id = ?",
                (project_id,),
            ).fetchone()
            if project_row is None:
                raise ValueError("project_not_indexed")

            relocated = str(Path(project_row["project_path"]).resolve()) != str(project_dir)
            if normalized_changed_paths is not None and not relocated:
                existing_by_path = fetch_existing_files_by_paths(
                    conn,
                    project_id,
                    normalized_changed_paths,
                )
                current_by_path = {
                    relative_path: build_single_file_record(project_dir, project_id, relative_path)
                    for relative_path in normalized_changed_paths
                }
                handled_paths: set[str] = set()
                existing_by_fingerprint: dict[str, str] = {}
                for relative_path, existing in existing_by_path.items():
                    if current_by_path[relative_path] is None:
                        existing_by_fingerprint.setdefault(
                            file_content_fingerprint(existing),
                            relative_path,
                        )

                for relative_path, current in current_by_path.items():
                    if current is None or relative_path in existing_by_path:
                        continue
                    old_relative_path = existing_by_fingerprint.pop(
                        file_content_fingerprint(current),
                        None,
                    )
                    if old_relative_path is None:
                        continue
                    existing = existing_by_path[old_relative_path]
                    fast_path_entity_ids.add(existing["id"])
                    fast_path_entity_ids.update(file_dependent_entity_ids(conn, existing["id"]))
                    conn.execute(
                        """
                        UPDATE files
                        SET file_hash = ?, relative_path = ?, relative_dir = ?, file_name = ?,
                            extension = ?, size_bytes = ?, last_modified = ?
                        WHERE id = ?
                        """,
                        (
                            current["file_hash"], current["relative_path"], current["relative_dir"],
                            current["file_name"], current["extension"], current["size_bytes"],
                            current["last_modified"], existing["id"],
                        ),
                    )
                    conn.execute(
                        "UPDATE knowledge_sources SET relative_path = ? WHERE file_id = ?",
                        (current["relative_path"], existing["id"]),
                    )
                    refresh_file_dependents(conn, project_id, existing["id"], current)
                    fast_path_entity_ids.add(stable_id(project_id, "drawing", current["relative_path"]))
                    fast_path_entity_ids.add(stable_id(project_id, "material", current["relative_path"]))
                    handled_paths.update({old_relative_path, relative_path})
                    moved_count += 1

                for relative_path in sorted(normalized_changed_paths):
                    if relative_path in handled_paths:
                        continue
                    current = current_by_path[relative_path]
                    existing = existing_by_path.get(relative_path)
                    if current is None:
                        if existing is None:
                            continue
                        fast_path_entity_ids.add(existing["id"])
                        fast_path_entity_ids.update(file_dependent_entity_ids(conn, existing["id"]))
                        remove_file_dependents(conn, existing["id"])
                        conn.execute("DELETE FROM files WHERE id = ?", (existing["id"],))
                        deleted_count += 1
                        continue

                    if existing is None:
                        file_id = upsert_file(conn, current)
                        refresh_file_dependents(conn, project_id, file_id, current)
                        created_count += 1
                    elif existing["file_hash"] != current["file_hash"]:
                        fast_path_entity_ids.update(file_dependent_entity_ids(conn, existing["id"]))
                        conn.execute("DELETE FROM knowledge_sources WHERE file_id = ?", (existing["id"],))
                        file_id = upsert_file(conn, current, file_id=existing["id"])
                        refresh_file_dependents(conn, project_id, file_id, current)
                        updated_count += 1
                    else:
                        file_id = existing["id"]

                    fast_path_entity_ids.add(file_id)
                    fast_path_entity_ids.add(stable_id(project_id, "drawing", current["relative_path"]))
                    fast_path_entity_ids.add(stable_id(project_id, "material", current["relative_path"]))
                    if current["relative_path"] == "project.json":
                        fast_path_entity_ids.add(project_id)
                        fast_path_entity_ids.add(f"knowledge:{project_id}")

                update_project_summary_from_database(conn, project_dir, project_data)
                sync_project_metadata(conn, project_data)

                duration_ms = int((time.perf_counter() - started) * 1000)
                affected_files = created_count + updated_count + deleted_count + moved_count
                message = (
                    f"created={created_count}; updated={updated_count}; "
                    f"deleted={deleted_count}; moved={moved_count}; relocated={relocated}; "
                    "mode=changed_paths"
                )
                conn.execute(
                    """
                    INSERT INTO scan_history (
                        id,
                        project_id,
                        event_type,
                        duration_ms,
                        status,
                        scanner_version,
                        affected_files,
                        message,
                        created_at
                    )
                    VALUES (?, ?, 'incremental_scan', ?, 'success', ?, ?, ?, ?)
                    """,
                    (
                        str(uuid.uuid4()),
                        project_id,
                        duration_ms,
                        SCANNER_VERSION,
                        affected_files,
                        message,
                        utc_now(),
                    ),
                )

                fast_path_result = IncrementalScanResult(
                    project_id=project_id,
                    created_count=created_count,
                    updated_count=updated_count,
                    deleted_count=deleted_count,
                    moved_count=moved_count,
                    relocated=relocated,
                    duration_ms=int((time.perf_counter() - started) * 1000),
                )
            else:
                current_records = build_file_records(project_dir, project_id)
                current_by_path = {record["relative_path"]: record for record in current_records}
                existing_by_path = fetch_existing_files(conn, project_id)
                existing_unmatched = set(existing_by_path)
                current_unmatched = set(current_by_path)

                for relative_path in sorted(set(existing_by_path) & set(current_by_path)):
                    existing = existing_by_path[relative_path]
                    current = current_by_path[relative_path]
                    existing_unmatched.discard(relative_path)
                    current_unmatched.discard(relative_path)
                    if existing["file_hash"] != current["file_hash"]:
                        conn.execute("DELETE FROM knowledge_sources WHERE file_id = ?", (existing["id"],))
                        file_id = upsert_file(conn, current, file_id=existing["id"])
                        refresh_file_dependents(conn, project_id, file_id, current)
                        updated_count += 1

                existing_by_fingerprint: dict[str, str] = {}
                for relative_path in sorted(existing_unmatched):
                    existing = existing_by_path[relative_path]
                    existing_by_fingerprint.setdefault(
                        file_content_fingerprint(existing),
                        relative_path,
                    )

                for relative_path in sorted(list(current_unmatched)):
                    current = current_by_path[relative_path]
                    old_relative_path = existing_by_fingerprint.pop(
                        file_content_fingerprint(current),
                        None,
                    )
                    if old_relative_path is None:
                        continue
                    existing = existing_by_path[old_relative_path]
                    conn.execute(
                        """
                        UPDATE files
                        SET file_hash = ?,
                            relative_path = ?,
                            relative_dir = ?,
                            file_name = ?,
                            extension = ?,
                            size_bytes = ?,
                            last_modified = ?
                        WHERE id = ?
                        """,
                        (
                            current["file_hash"],
                            current["relative_path"],
                            current["relative_dir"],
                            current["file_name"],
                            current["extension"],
                            current["size_bytes"],
                            current["last_modified"],
                            existing["id"],
                        ),
                    )
                    conn.execute(
                        "UPDATE knowledge_sources SET relative_path = ? WHERE file_id = ?",
                        (current["relative_path"], existing["id"]),
                    )
                    refresh_file_dependents(conn, project_id, existing["id"], current)
                    existing_unmatched.discard(old_relative_path)
                    current_unmatched.discard(relative_path)
                    moved_count += 1

                for relative_path in sorted(current_unmatched):
                    current = current_by_path[relative_path]
                    file_id = upsert_file(conn, current)
                    refresh_file_dependents(conn, project_id, file_id, current)
                    created_count += 1

                for relative_path in sorted(existing_unmatched):
                    existing = existing_by_path[relative_path]
                    remove_file_dependents(conn, existing["id"])
                    conn.execute("DELETE FROM files WHERE id = ?", (existing["id"],))
                    deleted_count += 1

                update_project_summary(conn, project_dir, project_data, current_records)
                sync_project_metadata(conn, project_data)

                duration_ms = int((time.perf_counter() - started) * 1000)
                affected_files = created_count + updated_count + deleted_count + moved_count
                message = (
                    f"created={created_count}; updated={updated_count}; "
                    f"deleted={deleted_count}; moved={moved_count}; relocated={relocated}"
                )
                conn.execute(
                    """
                    INSERT INTO scan_history (
                        id,
                        project_id,
                        event_type,
                        duration_ms,
                        status,
                        scanner_version,
                        affected_files,
                        message,
                        created_at
                    )
                    VALUES (?, ?, 'incremental_scan', ?, 'success', ?, ?, ?, ?)
                    """,
                    (
                        str(uuid.uuid4()),
                        project_id,
                        duration_ms,
                        SCANNER_VERSION,
                        affected_files,
                        message,
                        utc_now(),
                    ),
                )

        if fast_path_result is not None:
            refresh_search_index_entities(
                db_path=db_path,
                project_id=project_id,
                entity_ids=fast_path_entity_ids,
            )
            return IncrementalScanResult(
                project_id=fast_path_result.project_id,
                created_count=fast_path_result.created_count,
                updated_count=fast_path_result.updated_count,
                deleted_count=fast_path_result.deleted_count,
                moved_count=fast_path_result.moved_count,
                relocated=fast_path_result.relocated,
                duration_ms=int((time.perf_counter() - started) * 1000),
            )

        rebuild_search_index(db_path=db_path, project_id=project_id)
        return IncrementalScanResult(
            project_id=project_id,
            created_count=created_count,
            updated_count=updated_count,
            deleted_count=deleted_count,
            moved_count=moved_count,
            relocated=relocated,
            duration_ms=int((time.perf_counter() - started) * 1000),
        )
    except Exception as exc:
        duration_ms = int((time.perf_counter() - started) * 1000)
        write_scan_history(
            db_path,
            project_id=project_id,
            event_type="incremental_scan",
            duration_ms=duration_ms,
            status="error",
            affected_files=0,
            message=str(exc),
        )
        raise
