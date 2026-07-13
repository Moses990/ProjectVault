from __future__ import annotations

import hashlib
import json
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from pypdf import PdfReader

from app.db.database import connect
from app.scanner.full_scanner import scan_project
from app.services import ensure_project_exists, parse_json_list, row_to_dict
from app.services.ai_providers import generate_knowledge_payload
from app.services.files import resolve_asset

SUPPORTED_TEXT_EXTENSIONS = {".txt", ".md", ".csv", ".json"}
SUPPORTED_EXTRACTION_EXTENSIONS = SUPPORTED_TEXT_EXTENSIONS | {".pdf"}
MAX_SOURCE_BYTES = 64 * 1024
MAX_EXCERPT_CHARS = 800
APPLY_FIELDS = {"summary", "core_needs", "special_reqs", "risks", "lessons", "tags", "evidence"}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _source_id(file_id: str) -> str:
    return f"src_{file_id}"


def _history_id() -> str:
    return f"kh_{uuid.uuid4().hex}"


def _draft_id() -> str:
    return f"kd_{uuid.uuid4().hex}"


def _decode_text(path: Path) -> tuple[str, str]:
    raw = path.read_bytes()[:MAX_SOURCE_BYTES]
    for encoding in ("utf-8", "gbk", "latin-1"):
        try:
            return raw.decode(encoding), encoding
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", errors="replace"), "utf-8"


def _extract_pdf_text(path: Path) -> str:
    try:
        parts: list[str] = []
        remaining = MAX_SOURCE_BYTES
        for page in PdfReader(path).pages:
            if remaining <= 0:
                break
            text = page.extract_text() or ""
            if parts:
                parts.append("\n")
                remaining -= 1
            excerpt = text[:remaining]
            parts.append(excerpt)
            remaining -= len(excerpt)
        return "".join(parts)
    except Exception as exc:
        raise ValueError("pdf_extract_failed") from exc


def _normalize_excerpt(text: str) -> str:
    compact = " ".join(text.split())
    return compact[:MAX_EXCERPT_CHARS]


def _normalize_evidence(value: object) -> list[dict[str, str]]:
    if not isinstance(value, list):
        return []
    normalized: list[dict[str, str]] = []
    for item in value[:20]:
        if not isinstance(item, dict):
            continue
        relative_path = str(item.get("relative_path") or "").strip()
        path = Path(relative_path)
        if not relative_path or path.is_absolute() or any(part == ".." for part in path.parts):
            continue
        evidence = {
            "relative_path": path.as_posix(),
            "excerpt": _normalize_excerpt(str(item.get("excerpt") or "")),
        }
        for key in ("source_id", "file_id", "note"):
            text = str(item.get(key) or "").strip()
            if text:
                evidence[key] = text[:200]
        normalized.append(evidence)
    return normalized


def _normalize_draft_payload(value: object) -> dict[str, object]:
    data = value if isinstance(value, dict) else {}
    return {
        "summary": str(data.get("summary") or "").strip()[:1000],
        "core_needs": [str(item).strip()[:300] for item in _list_value(data.get("core_needs")) if str(item).strip()][:20],
        "special_reqs": [str(item).strip()[:300] for item in _list_value(data.get("special_reqs")) if str(item).strip()][:20],
        "risks": [str(item).strip()[:300] for item in _list_value(data.get("risks")) if str(item).strip()][:20],
        "lessons": [str(item).strip()[:300] for item in _list_value(data.get("lessons")) if str(item).strip()][:20],
        "tags": [str(item).strip()[:100] for item in _list_value(data.get("tags")) if str(item).strip()][:20],
        "evidence": _normalize_evidence(data.get("evidence")),
    }


def _source_row_to_dict(row: Any) -> dict[str, object]:
    data = row_to_dict(row)
    return {
        "id": data["id"],
        "file_id": data["file_id"],
        "relative_path": data["relative_path"],
        "extractor": data["extractor"],
        "text_excerpt": data["text_excerpt"] or "",
        "text_length": data["text_length"],
        "status": data["status"],
        "error_message": data["error_message"],
        "extracted_at": data["extracted_at"],
    }


def _empty_knowledge() -> dict[str, object]:
    return {
        "summary": "",
        "core_needs": [],
        "special_reqs": [],
        "risks": [],
        "lessons": [],
        "tags": [],
        "evidence": [],
    }


def _read_approved_knowledge(project_id: str, db_path: Path | None = None) -> dict[str, object]:
    with connect(db_path) as conn:
        ensure_project_exists(conn, project_id)
        project = conn.execute(
            "SELECT project_path FROM projects WHERE id = ?",
            (project_id,),
        ).fetchone()
        row = conn.execute(
            """
            SELECT summary, core_needs, special_reqs, risks, lessons
            FROM ai_metadata
            WHERE project_id = ?
            """,
            (project_id,),
        ).fetchone()
        tags = [
            item["tag_name"]
            for item in conn.execute(
                "SELECT tag_name FROM project_tags WHERE project_id = ? ORDER BY tag_name",
                (project_id,),
            ).fetchall()
        ]
    if row is None:
        knowledge = _empty_knowledge()
    else:
        knowledge = {
            "summary": row["summary"] or "",
            "core_needs": parse_json_list(row["core_needs"]),
            "special_reqs": parse_json_list(row["special_reqs"]),
            "risks": parse_json_list(row["risks"]),
            "lessons": parse_json_list(row["lessons"]),
            "tags": tags,
            "evidence": [],
        }
    try:
        project_data = json.loads((Path(project["project_path"]) / "project.json").read_text(encoding="utf-8"))
        ai_data = project_data.get("ai", {})
        if isinstance(ai_data, dict):
            knowledge["evidence"] = _normalize_evidence(ai_data.get("evidence"))
    except (OSError, json.JSONDecodeError, TypeError):
        pass
    return knowledge


def _active_draft(project_id: str, db_path: Path | None = None) -> dict[str, object] | None:
    with connect(db_path) as conn:
        row = conn.execute(
            """
            SELECT id, draft_json, provider_name, model_name, status, created_at, updated_at
            FROM knowledge_drafts
            WHERE project_id = ? AND status = 'draft'
            ORDER BY updated_at DESC
            LIMIT 1
            """,
            (project_id,),
        ).fetchone()
    if row is None:
        return None
    return {
        "id": row["id"],
        "draft": json.loads(row["draft_json"]),
        "provider_name": row["provider_name"],
        "model_name": row["model_name"],
        "status": row["status"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def _claim_draft(project_id: str, draft_id: str, db_path: Path | None = None) -> dict[str, object]:
    with connect(db_path) as conn:
        row = conn.execute(
            """
            SELECT id, draft_json, status
            FROM knowledge_drafts
            WHERE project_id = ? AND id = ? AND status = 'draft'
            """,
            (project_id, draft_id),
        ).fetchone()
        if row is None:
            raise ValueError("draft_not_found")
        updated = conn.execute(
            """
            UPDATE knowledge_drafts
            SET status = 'applying', updated_at = ?
            WHERE project_id = ? AND id = ? AND status = 'draft'
            """,
            (_now(), project_id, draft_id),
        )
        if updated.rowcount != 1:
            raise ValueError("draft_not_found")
        return json.loads(row["draft_json"])


def _release_claimed_draft(project_id: str, draft_id: str, db_path: Path | None = None) -> None:
    with connect(db_path) as conn:
        conn.execute(
            """
            UPDATE knowledge_drafts
            SET status = 'draft', updated_at = ?
            WHERE project_id = ? AND id = ? AND status = 'applying'
            """,
            (_now(), project_id, draft_id),
        )


def _write_json_atomic(path: Path, data: dict[str, object]) -> None:
    temporary = path.with_name(f".{path.name}.{uuid.uuid4().hex}.tmp")
    try:
        temporary.write_text(
            json.dumps(data, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)


def _restore_file_atomic(source: Path, target: Path) -> None:
    temporary = target.with_name(f".{target.name}.{uuid.uuid4().hex}.restore")
    try:
        shutil.copy2(source, temporary)
        temporary.replace(target)
    finally:
        temporary.unlink(missing_ok=True)


def _list_value(value: object) -> list[object]:
    return value if isinstance(value, list) else []


def get_knowledge(project_id: str, db_path: Path | None = None) -> dict[str, object]:
    knowledge = _read_approved_knowledge(project_id, db_path=db_path)
    has_knowledge = any(
        knowledge[key]
        for key in ("summary", "core_needs", "special_reqs", "risks", "lessons", "tags")
    )
    return {
        "project_id": project_id,
        "knowledge": knowledge,
        "status": "approved" if has_knowledge else "empty",
        "draft": _active_draft(project_id, db_path=db_path),
        "updated_at": None,
    }


def extract_text_sources(
    project_id: str,
    file_ids: list[str],
    *,
    limit: int = 20,
    db_path: Path | None = None,
) -> dict[str, object]:
    if not file_ids:
        raise ValueError("file_ids_required")
    selected_ids = file_ids[: max(1, min(limit, 20))]
    now = _now()
    sources: list[dict[str, object]] = []

    with connect(db_path) as conn:
        ensure_project_exists(conn, project_id)

    for file_id in selected_ids:
        asset = resolve_asset(file_id, db_path=db_path)
        if asset.project_id != project_id:
            raise ValueError("file_not_in_project")

        source_id = _source_id(file_id)
        relative_path = ""
        with connect(db_path) as conn:
            row = conn.execute(
                "SELECT relative_path FROM files WHERE id = ? AND project_id = ?",
                (file_id, project_id),
            ).fetchone()
            if row is None:
                raise ValueError("file_not_in_project")
            relative_path = row["relative_path"]

        status = "ready"
        error_message = None
        excerpt = ""
        text_hash = "unsupported"
        text_length = 0
        extractor = asset.path.suffix.lower().lstrip(".") or "text"

        if relative_path == "project.json":
            status = "failed"
            error_message = "system_file_ignored"
        elif asset.path.suffix.lower() not in SUPPORTED_EXTRACTION_EXTENSIONS:
            status = "failed"
            error_message = "unsupported_format"
        else:
            try:
                if asset.path.suffix.lower() == ".pdf":
                    extractor = "pypdf"
                    text = _extract_pdf_text(asset.path)
                else:
                    text, _encoding = _decode_text(asset.path)
                excerpt = _normalize_excerpt(text)
                if not excerpt:
                    raise ValueError("no_extractable_text")
                text_hash = hashlib.sha256(text.encode("utf-8", errors="replace")).hexdigest()
                text_length = len(text)
            except ValueError as exc:
                status = "failed"
                error_message = str(exc)

        with connect(db_path) as conn:
            conn.execute(
                """
                INSERT INTO knowledge_sources (
                    id, project_id, file_id, relative_path, extractor, text_hash,
                    text_excerpt, text_length, status, error_message, extracted_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(project_id, file_id) DO UPDATE SET
                    extractor = excluded.extractor,
                    text_hash = excluded.text_hash,
                    text_excerpt = excluded.text_excerpt,
                    text_length = excluded.text_length,
                    status = excluded.status,
                    error_message = excluded.error_message,
                    extracted_at = excluded.extracted_at
                """,
                (
                    source_id,
                    project_id,
                    file_id,
                    relative_path,
                    extractor,
                    text_hash,
                    excerpt,
                    text_length,
                    status,
                    error_message,
                    now,
                ),
            )
            conn.execute(
                """
                INSERT INTO knowledge_history (id, project_id, event_type, status, message, metadata_json, created_at)
                VALUES (?, ?, 'extract_text', ?, ?, ?, ?)
                """,
                (
                    _history_id(),
                    project_id,
                    status,
                    error_message,
                    json.dumps({"file_id": file_id, "relative_path": relative_path}, ensure_ascii=False),
                    now,
                ),
            )
            saved = conn.execute(
                """
                SELECT id, file_id, relative_path, extractor, text_excerpt, text_length,
                       status, error_message, extracted_at
                FROM knowledge_sources
                WHERE project_id = ? AND file_id = ?
                """,
                (project_id, file_id),
            ).fetchone()
            sources.append(_source_row_to_dict(saved))

    return {
        "project_id": project_id,
        "processed": len(sources),
        "ready": sum(1 for item in sources if item["status"] == "ready"),
        "failed": sum(1 for item in sources if item["status"] == "failed"),
        "sources": sources,
    }


def _load_sources(project_id: str, source_ids: list[str], db_path: Path | None = None) -> list[dict[str, object]]:
    if not source_ids:
        return []
    placeholders = ",".join("?" for _ in source_ids)
    with connect(db_path) as conn:
        rows = conn.execute(
            f"""
            SELECT id, file_id, relative_path, extractor, text_excerpt, text_length,
                   status, error_message, extracted_at
            FROM knowledge_sources
            WHERE project_id = ? AND id IN ({placeholders})
            ORDER BY extracted_at DESC
            """,
            [project_id, *source_ids],
        ).fetchall()
    return [_source_row_to_dict(row) for row in rows]


def _draft_from_sources(sources: list[dict[str, object]]) -> dict[str, object]:
    ready_sources = [source for source in sources if source["status"] == "ready"]
    summary = " ".join(str(source["text_excerpt"]) for source in ready_sources).strip()
    evidence = [
        {
            "source_id": source["id"],
            "file_id": source["file_id"],
            "relative_path": source["relative_path"],
            "excerpt": source["text_excerpt"],
            "note": "source excerpt",
        }
        for source in ready_sources
    ]
    return {
        "summary": summary[:500],
        "core_needs": [],
        "special_reqs": [],
        "risks": [],
        "lessons": [],
        "tags": [],
        "evidence": evidence,
    }


def create_knowledge_draft(
    project_id: str,
    *,
    source_ids: list[str],
    mode: str,
    draft: dict[str, object] | None = None,
    db_path: Path | None = None,
) -> dict[str, object]:
    if mode not in {"manual", "ai"}:
        raise ValueError("mode_invalid")
    with connect(db_path) as conn:
        ensure_project_exists(conn, project_id)

    sources = _load_sources(project_id, source_ids, db_path=db_path)
    provider_name = None
    model_name = None
    if mode == "ai":
        generated = generate_knowledge_payload(project_id, sources, db_path=db_path)
        draft_payload = generated["draft"]
        provider_name = str(generated["provider_name"])
        model_name = str(generated["model_name"])
    else:
        draft_payload = draft or _draft_from_sources(sources)
    draft_payload = _normalize_draft_payload(draft_payload)
    now = _now()
    draft_id = _draft_id()

    with connect(db_path) as conn:
        conn.execute(
            "UPDATE knowledge_drafts SET status = 'discarded', updated_at = ? WHERE project_id = ? AND status = 'draft'",
            (now, project_id),
        )
        conn.execute(
            """
            INSERT INTO knowledge_drafts (
                id, project_id, draft_json, provider_name, model_name, status, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, 'draft', ?, ?)
            """,
            (
                draft_id,
                project_id,
                json.dumps(draft_payload, ensure_ascii=False),
                provider_name,
                model_name,
                now,
                now,
            ),
        )
        conn.execute(
            """
            INSERT INTO knowledge_history (id, project_id, event_type, status, message, metadata_json, created_at)
            VALUES (?, ?, 'create_draft', 'draft', NULL, ?, ?)
            """,
            (
                _history_id(),
                project_id,
                json.dumps(
                    {
                        "draft_id": draft_id,
                        "mode": mode,
                        "source_ids": source_ids,
                        "provider_name": provider_name,
                        "model_name": model_name,
                    },
                    ensure_ascii=False,
                ),
                now,
            ),
        )

    return {
        "draft_id": draft_id,
        "status": "draft",
        "draft": draft_payload,
        "provider_name": provider_name,
        "model_name": model_name,
    }


def discard_knowledge_draft(
    project_id: str,
    *,
    draft_id: str,
    db_path: Path | None = None,
) -> dict[str, object]:
    now = _now()
    with connect(db_path) as conn:
        ensure_project_exists(conn, project_id)
        updated = conn.execute(
            """
            UPDATE knowledge_drafts
            SET status = 'discarded', updated_at = ?
            WHERE project_id = ? AND id = ? AND status = 'draft'
            """,
            (now, project_id, draft_id),
        )
        if updated.rowcount != 1:
            raise ValueError("draft_not_found")
        conn.execute(
            """
            INSERT INTO knowledge_history (id, project_id, event_type, status, message, metadata_json, created_at)
            VALUES (?, ?, 'discard_draft', 'discarded', NULL, ?, ?)
            """,
            (_history_id(), project_id, json.dumps({"draft_id": draft_id}), now),
        )
    return {"draft_id": draft_id, "discarded": True}


def apply_knowledge_draft(
    project_id: str,
    *,
    draft_id: str,
    fields: list[str],
    confirm: bool,
    db_path: Path | None = None,
) -> dict[str, object]:
    if not confirm:
        raise ValueError("confirm_required")
    selected_fields = [field for field in fields if field in APPLY_FIELDS]
    if not selected_fields or len(selected_fields) != len(fields):
        raise ValueError("fields_invalid")

    with connect(db_path) as conn:
        ensure_project_exists(conn, project_id)
        project_row = conn.execute(
            "SELECT project_path FROM projects WHERE id = ?",
            (project_id,),
        ).fetchone()
    project_dir = Path(project_row["project_path"])
    project_json = project_dir / "project.json"
    if not project_json.exists():
        raise ValueError("project_json_missing")

    try:
        data = json.loads(project_json.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ValueError("project_json_invalid") from exc
    if not isinstance(data, dict):
        raise ValueError("project_json_invalid")

    draft = _claim_draft(project_id, draft_id, db_path=db_path)
    backup_name = f"project.json.bak.{datetime.now().strftime('%Y%m%d-%H%M%S-%f')}"
    backup_path = project_json.with_name(backup_name)
    try:
        shutil.copy2(project_json, backup_path)
    except Exception:
        _release_claimed_draft(project_id, draft_id, db_path=db_path)
        raise

    ai_data = data.get("ai")
    if not isinstance(ai_data, dict):
        ai_data = {}
        data["ai"] = ai_data

    if "summary" in selected_fields:
        ai_data["summary"] = str(draft.get("summary", ""))
    for field in ("core_needs", "special_reqs", "risks", "lessons"):
        if field in selected_fields:
            ai_data[field] = _list_value(draft.get(field))
    if "evidence" in selected_fields:
        ai_data["evidence"] = _normalize_evidence(draft.get("evidence"))
    if "tags" in selected_fields:
        data["tags"] = [str(item) for item in _list_value(draft.get("tags"))]

    data["schema_version"] = "2.0"
    ai_data["metadata_version"] = "2.0"
    ai_data["generated_at"] = _now()

    try:
        _write_json_atomic(project_json, data)
        scan_project(project_dir, db_path=db_path)
        now = _now()
        with connect(db_path) as conn:
            updated = conn.execute(
                """
                UPDATE knowledge_drafts
                SET status = 'applied', updated_at = ?
                WHERE project_id = ? AND id = ? AND status = 'applying'
                """,
                (now, project_id, draft_id),
            )
            if updated.rowcount != 1:
                raise ValueError("draft_not_found")
            conn.execute(
                """
                INSERT INTO knowledge_history (id, project_id, event_type, status, message, metadata_json, created_at)
                VALUES (?, ?, 'apply_draft', 'success', NULL, ?, ?)
                """,
                (
                    _history_id(),
                    project_id,
                    json.dumps(
                        {
                            "draft_id": draft_id,
                            "fields": selected_fields,
                            "project_json_backup": backup_name,
                        },
                        ensure_ascii=False,
                    ),
                    now,
                ),
            )
    except Exception as apply_error:
        try:
            _restore_file_atomic(backup_path, project_json)
            scan_project(project_dir, db_path=db_path)
        except Exception as rollback_error:
            raise RuntimeError("apply_rollback_failed") from rollback_error
        finally:
            _release_claimed_draft(project_id, draft_id, db_path=db_path)
        raise ValueError("apply_failed_rolled_back") from apply_error

    return {
        "applied": True,
        "draft_id": draft_id,
        "project_json_backup": backup_name,
        "updated_fields": selected_fields,
    }
