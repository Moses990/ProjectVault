import hashlib
import json
import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.db.database import connect
from app.scanner.classifiers import drawing_category, extract_version_group, guess_version_number, is_drawing, material_type
from app.search.indexer import rebuild_search_index

SCANNER_VERSION = "phase4-full-scanner-v1"


@dataclass(frozen=True)
class ScanResult:
    project_id: str
    file_count: int
    drawing_count: int
    material_count: int
    duration_ms: int


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalize_relative_path(path: Path) -> str:
    return path.as_posix()


def stable_id(*parts: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, "::".join(parts)))


def load_project_json(project_dir: Path) -> dict[str, Any]:
    project_json = project_dir / "project.json"
    if not project_json.exists():
        raise ValueError("project_json_missing")
    try:
        data = json.loads(project_json.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ValueError(f"project_json_invalid: {exc.msg}") from exc
    if not data.get("project_id"):
        raise ValueError("project_id_missing")
    if not data.get("name"):
        raise ValueError("project_name_missing")
    return data


def iter_project_files(project_dir: Path) -> list[Path]:
    files: list[Path] = []
    for path in project_dir.rglob("*"):
        if path.is_file():
            files.append(path)
    return sorted(files, key=lambda item: normalize_relative_path(item.relative_to(project_dir)))


def file_hash(relative_path: str, size_bytes: int, modified: str) -> str:
    payload = f"{relative_path}|{size_bytes}|{modified}"
    return hashlib.sha1(payload.encode("utf-8")).hexdigest()


def project_hash(file_records: list[dict[str, Any]], project_data: dict[str, Any]) -> str:
    payload = {
        "project": project_data,
        "files": [
            {
                "relative_path": item["relative_path"],
                "size_bytes": item["size_bytes"],
                "last_modified": item["last_modified"],
            }
            for item in file_records
        ],
    }
    return hashlib.sha256(
        json.dumps(payload, ensure_ascii=False, sort_keys=True).encode("utf-8")
    ).hexdigest()


def build_file_records(project_dir: Path, project_id: str) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for absolute_path in iter_project_files(project_dir):
        relative_path = normalize_relative_path(absolute_path.relative_to(project_dir))
        stat = absolute_path.stat()
        modified = datetime.fromtimestamp(stat.st_mtime, timezone.utc).isoformat()
        relative_dir = normalize_relative_path(Path(relative_path).parent)
        if relative_dir == ".":
            relative_dir = ""
        records.append(
            {
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
        )
    return records


def write_scan_history(
    db_path: Path | None,
    *,
    project_id: str | None,
    event_type: str = "full_scan",
    duration_ms: int,
    status: str,
    affected_files: int,
    message: str,
) -> None:
    with connect(db_path) as conn:
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
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                str(uuid.uuid4()),
                project_id,
                event_type,
                duration_ms,
                status,
                SCANNER_VERSION,
                affected_files,
                message,
                utc_now(),
            ),
        )


def scan_project(project_path: str | Path, db_path: Path | None = None) -> ScanResult:
    started = time.perf_counter()
    project_dir = Path(project_path).expanduser().resolve()
    project_id: str | None = None
    affected_files = 0

    try:
        if not project_dir.exists() or not project_dir.is_dir():
            raise ValueError("project_path_invalid")

        project_data = load_project_json(project_dir)
        project_id = str(project_data["project_id"])
        file_records = build_file_records(project_dir, project_id)
        affected_files = len(file_records)
        cad_count = sum(1 for record in file_records if is_drawing(record["absolute_path"]))
        material_count = sum(1 for record in file_records if material_type(record["absolute_path"]))
        file_hashes = {record["id"]: record["file_hash"] for record in file_records}
        now = utc_now()

        with connect(db_path) as conn:
            conn.execute(
                """
                INSERT INTO projects (
                    id,
                    project_hash,
                    project_path,
                    name,
                    type,
                    phase,
                    status,
                    manager,
                    file_count,
                    cad_count,
                    material_count,
                    last_updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    project_hash = excluded.project_hash,
                    project_path = excluded.project_path,
                    name = excluded.name,
                    type = excluded.type,
                    phase = excluded.phase,
                    status = excluded.status,
                    manager = excluded.manager,
                    file_count = excluded.file_count,
                    cad_count = excluded.cad_count,
                    material_count = excluded.material_count,
                    last_updated_at = excluded.last_updated_at
                """,
                (
                    project_id,
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
                    now,
                ),
            )
            conn.execute("DELETE FROM project_tags WHERE project_id = ?", (project_id,))
            for tag_name in project_data.get("tags", []):
                conn.execute(
                    """
                    INSERT OR IGNORE INTO project_tags (project_id, tag_name)
                    VALUES (?, ?)
                    """,
                    (project_id, str(tag_name)),
                )

            ai_data = project_data.get("ai", {})
            if isinstance(ai_data, dict):
                conn.execute(
                    """
                    INSERT INTO ai_metadata (
                        project_id,
                        summary,
                        core_needs,
                        special_reqs,
                        risks,
                        lessons,
                        metadata_version
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

            preserved_sources = conn.execute(
                """
                SELECT ks.*, f.file_hash AS source_file_hash
                FROM knowledge_sources ks
                JOIN files f ON f.id = ks.file_id
                WHERE ks.project_id = ?
                """,
                (project_id,),
            ).fetchall()
            conn.execute("DELETE FROM files WHERE project_id = ?", (project_id,))
            for record in file_records:
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
                    """,
                    (
                        record["id"],
                        project_id,
                        record["file_hash"],
                        record["relative_path"],
                        record["relative_dir"],
                        record["file_name"],
                        record["extension"],
                        record["size_bytes"],
                        record["last_modified"],
                    ),
                )
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
                            record["id"],
                            drawing_category(absolute_path),
            (extract_version_group(absolute_path.name) or ""),
            (guess_version_number(absolute_path.name) or 0),
                            record["last_modified"],
                        ),
                    )
                classified_material = material_type(absolute_path)
                if classified_material:
                    conn.execute(
                        """
                        INSERT INTO materials (
                            id,
                            project_id,
                            file_id,
                            material_type
                        )
                        VALUES (?, ?, ?, ?)
                        """,
                        (
                            stable_id(project_id, "material", record["relative_path"]),
                            project_id,
                            record["id"],
                            classified_material,
                        ),
                    )

            for source in preserved_sources:
                if file_hashes.get(source["file_id"]) != source["source_file_hash"]:
                    continue
                conn.execute(
                    """
                    INSERT INTO knowledge_sources (
                        id, project_id, file_id, relative_path, extractor, text_hash,
                        text_excerpt, text_length, status, error_message, extracted_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        source["id"], source["project_id"], source["file_id"],
                        source["relative_path"], source["extractor"], source["text_hash"],
                        source["text_excerpt"], source["text_length"], source["status"],
                        source["error_message"], source["extracted_at"],
                    ),
                )

            duration_ms = int((time.perf_counter() - started) * 1000)
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
                VALUES (?, ?, 'full_scan', ?, 'success', ?, ?, ?, ?)
                """,
                (
                    str(uuid.uuid4()),
                    project_id,
                    duration_ms,
                    SCANNER_VERSION,
                    len(file_records),
                    "full_scan_success",
                    utc_now(),
                ),
            )

        rebuild_search_index(db_path=db_path, project_id=project_id)
        return ScanResult(
            project_id=project_id,
            file_count=len(file_records),
            drawing_count=cad_count,
            material_count=material_count,
            duration_ms=int((time.perf_counter() - started) * 1000),
        )
    except Exception as exc:
        duration_ms = int((time.perf_counter() - started) * 1000)
        write_scan_history(
            db_path,
            project_id=project_id,
            duration_ms=duration_ms,
            status="error",
            affected_files=affected_files,
            message=str(exc),
        )
        raise
