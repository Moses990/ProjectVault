"""Run the V2 beta workflow against an isolated copy of a real project."""

from __future__ import annotations

import argparse
import json
import shutil
import sqlite3
import sys
import time
import urllib.error
from contextlib import closing
from pathlib import Path
from unittest.mock import patch

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

from app.db.database import initialize_database
from app.knowledge.service import (
    apply_knowledge_draft,
    create_knowledge_draft,
    extract_text_sources,
    get_knowledge,
)
from app.projects.discovery import discover_project_candidates
from app.projects.initializer import initialize_projects
from app.scanner.full_scanner import scan_project
from app.scanner.incremental_scanner import scan_project_incremental
from app.search.service import search
from app.services.ai_providers import create_ai_provider, update_ai_provider
from app.services.files import list_project_files


class MockResponse:
    def __init__(self, payload: dict[str, object]) -> None:
        self.payload = json.dumps(payload, ensure_ascii=False).encode("utf-8")

    def read(self, _size: int = -1) -> bytes:
        return self.payload

    def __enter__(self) -> "MockResponse":
        return self

    def __exit__(self, *_args: object) -> bool:
        return False


def public_path(path: Path, validation_root: Path) -> str:
    return path.resolve().relative_to(validation_root.resolve()).as_posix()


def file_manifest(project_dir: Path) -> dict[str, tuple[int, int]]:
    return {
        path.relative_to(project_dir).as_posix(): (path.stat().st_size, path.stat().st_mtime_ns)
        for path in project_dir.rglob("*")
        if path.is_file() and path.name != "project.json" and not path.name.startswith("project.json.bak.")
    }


def first_file_id(db_path: Path, project_id: str, extensions: set[str]) -> str:
    with closing(sqlite3.connect(db_path)) as conn:
        row = conn.execute(
            "SELECT id FROM files WHERE project_id = ? AND extension IN (%s) ORDER BY relative_path LIMIT 1"
            % ",".join("?" for _ in extensions),
            (project_id, *sorted(extensions)),
        ).fetchone()
    if row is None:
        raise AssertionError(f"missing_extension:{','.join(sorted(extensions))}")
    return str(row[0])


def assert_error(callback: object, expected: str) -> str:
    try:
        callback()  # type: ignore[operator]
    except ValueError as exc:
        message = str(exc)
        if expected not in message:
            raise AssertionError(f"expected={expected}; actual={message}") from exc
        return message
    raise AssertionError(f"expected_error:{expected}")


def run(validation_root: Path, project_dir: Path) -> dict[str, object]:
    db_path = validation_root / "project_vault.db"
    report: dict[str, object] = {
        "status": "in_progress",
        "project_copy": public_path(project_dir, validation_root),
        "database": public_path(db_path, validation_root),
        "checks": [],
        "manual_review": [
            "AI 草稿是否准确反映设计需求、风险和专业术语",
            "字段选择、确认写入和搜索结果是否符合实际工作习惯",
            "真实外部 Provider 的内容质量和隐私授权",
        ],
    }
    checks: list[dict[str, object]] = report["checks"]  # type: ignore[assignment]

    def check(name: str, condition: bool, **details: object) -> None:
        checks.append({"name": name, "status": "pass" if condition else "fail", "details": details})
        if not condition:
            raise AssertionError(f"{name}: {details}")

    source_manifest = file_manifest(project_dir)
    initialize_database(db_path)

    candidates = discover_project_candidates(project_dir.parent)
    selected = [item for item in candidates if Path(item.absolute_path) == project_dir.resolve()]
    check("project_import_candidate", len(selected) == 1, candidates=len(candidates))

    initialized = initialize_projects([project_dir], db_path=db_path, default_tags=["v2-real-usage-copy"])
    check("project_initialized", initialized.initialized_count == 1, initialized=initialized.initialized_count)
    project_id = initialized.project_ids[0]

    started = time.perf_counter()
    full_scan = scan_project(project_dir, db_path=db_path)
    physical_count = sum(1 for path in project_dir.rglob("*") if path.is_file())
    check(
        "full_scan_and_file_index",
        full_scan.file_count == physical_count,
        file_count=full_scan.file_count,
        physical_count=physical_count,
        duration_ms=full_scan.duration_ms,
    )

    with closing(sqlite3.connect(db_path)) as conn:
        indexed_count = conn.execute("SELECT COUNT(*) FROM files WHERE project_id = ?", (project_id,)).fetchone()[0]
        unique_count = conn.execute(
            "SELECT COUNT(DISTINCT relative_path) FROM files WHERE project_id = ?", (project_id,)
        ).fetchone()[0]
        cad_count = conn.execute("SELECT COUNT(*) FROM drawings WHERE project_id = ?", (project_id,)).fetchone()[0]
        material_count = conn.execute("SELECT COUNT(*) FROM materials WHERE project_id = ?", (project_id,)).fetchone()[0]
    check(
        "cad_material_and_duplicate_index",
        indexed_count == unique_count and cad_count > 0 and material_count > 0,
        indexed_count=indexed_count,
        cad_count=cad_count,
        material_count=material_count,
    )

    text_id = first_file_id(db_path, project_id, {".txt"})
    unsupported_id = first_file_id(db_path, project_id, {".pdf", ".dwg"})
    extraction = extract_text_sources(project_id, [text_id, unsupported_id], db_path=db_path)
    ready_sources = [item for item in extraction["sources"] if item["status"] == "ready"]
    check(
        "text_extract_and_unsupported_format",
        extraction["ready"] >= 1 and extraction["failed"] >= 1,
        ready=extraction["ready"],
        failed=extraction["failed"],
    )

    provider = create_ai_provider(
        "V2 Real Usage Local Provider",
        "http://127.0.0.1:19191/v1",
        default_model="validation-model",
        key_reference="validation-key",
        db_path=db_path,
    )
    source_ids = [str(item["id"]) for item in ready_sources]
    provider_response = MockResponse(
        {
            "choices": [
                {
                    "message": {
                        "content": json.dumps(
                            {
                                "summary": "realusageprobe project knowledge draft",
                                "core_needs": ["人工验收设计需求准确性"],
                                "special_reqs": [],
                                "risks": ["真实 Provider 内容质量待人工判断"],
                                "lessons": [],
                                "tags": ["v2-real-usage"],
                            },
                            ensure_ascii=False,
                        )
                    }
                }
            ]
        }
    )
    with patch("app.services.ai_providers.urllib.request.urlopen", return_value=provider_response):
        draft = create_knowledge_draft(project_id, source_ids=source_ids, mode="ai", db_path=db_path)
    check(
        "ai_draft_generation",
        draft["provider_name"] == provider["name"] and draft["model_name"] == "validation-model",
        provider=draft["provider_name"],
        model=draft["model_name"],
    )

    confirm_error = assert_error(
        lambda: apply_knowledge_draft(
            project_id, draft_id=str(draft["draft_id"]), fields=["summary"], confirm=False, db_path=db_path
        ),
        "confirm_required",
    )
    check("apply_requires_confirmation", confirm_error == "confirm_required")

    applied = apply_knowledge_draft(
        project_id,
        draft_id=str(draft["draft_id"]),
        fields=["summary", "core_needs", "risks", "tags", "evidence"],
        confirm=True,
        db_path=db_path,
    )
    backup_path = project_dir / str(applied["project_json_backup"])
    saved = json.loads((project_dir / "project.json").read_text(encoding="utf-8"))
    check(
        "apply_backup_and_project_json_write",
        backup_path.exists() and saved["ai"]["summary"] == "realusageprobe project knowledge draft",
        backup=backup_path.name,
    )

    knowledge = get_knowledge(project_id, db_path=db_path)
    hits = search("realusageprobe", category="knowledge", db_path=db_path)
    check(
        "sqlite_sync_and_fts5_knowledge_search",
        knowledge["knowledge"]["summary"] == "realusageprobe project knowledge draft" and bool(hits),
        search_hits=len(hits),
    )

    initialize_database(db_path)
    persisted = get_knowledge(project_id, db_path=db_path)
    check(
        "restart_persistence",
        persisted["knowledge"]["summary"] == "realusageprobe project knowledge draft",
    )

    update_ai_provider(str(provider["id"]), is_enabled=False, db_path=db_path)
    missing_key_error = assert_error(
        lambda: create_knowledge_draft(project_id, source_ids=source_ids, mode="ai", db_path=db_path),
        "ai_provider_required",
    )
    check("api_key_missing", missing_key_error == "ai_provider_required")
    update_ai_provider(str(provider["id"]), is_enabled=True, db_path=db_path)

    approved_before = get_knowledge(project_id, db_path=db_path)["knowledge"]["summary"]
    for name, reason in (("provider_request_failure", "provider unavailable"), ("network_timeout", "timed out")):
        with patch(
            "app.services.ai_providers.urllib.request.urlopen",
            side_effect=urllib.error.URLError(reason),
        ):
            error = assert_error(
                lambda: create_knowledge_draft(project_id, source_ids=source_ids, mode="ai", db_path=db_path),
                "network_error",
            )
        unchanged = get_knowledge(project_id, db_path=db_path)["knowledge"]["summary"] == approved_before
        check(name, "network_error" in error and unchanged, error=error, approved_unchanged=unchanged)

    invalid_project = validation_root / "invalid-project-json"
    invalid_project.mkdir(exist_ok=True)
    (invalid_project / "project.json").write_text("{", encoding="utf-8")
    invalid_error = assert_error(lambda: scan_project(invalid_project, db_path=db_path), "project_json_invalid")
    check("invalid_project_json", "project_json_invalid" in invalid_error)

    probe_dir = project_dir / "_pv_validation"
    probe_dir.mkdir(exist_ok=True)
    created_path = probe_dir / "change-probe.txt"
    created_path.write_text("incremental real usage probe", encoding="utf-8")
    created = scan_project_incremental(project_dir, db_path=db_path, changed_paths=[created_path])
    moved_path = probe_dir / "change-probe-moved.txt"
    created_path.replace(moved_path)
    moved = scan_project_incremental(project_dir, db_path=db_path, changed_paths=[created_path, moved_path])
    moved_path.unlink()
    deleted = scan_project_incremental(project_dir, db_path=db_path, changed_paths=[moved_path])
    shutil.rmtree(probe_dir)
    scan_project(project_dir, db_path=db_path)
    check(
        "file_move_delete_incremental_sync",
        created.created_count == 1 and moved.moved_count == 1 and deleted.deleted_count == 1,
        created=created.created_count,
        moved=moved.moved_count,
        deleted=deleted.deleted_count,
    )

    scanner_error = assert_error(lambda: scan_project(project_dir / "_missing", db_path=db_path), "project_path_invalid")
    with closing(sqlite3.connect(db_path)) as conn:
        error_history = conn.execute(
            "SELECT COUNT(*) FROM scan_history WHERE status = 'error'"
        ).fetchone()[0]
    check("scanner_exception_recorded", scanner_error == "project_path_invalid" and error_history >= 1, errors=error_history)

    listed_started = time.perf_counter()
    files, total, _page, _limit = list_project_files(project_id, page=1, limit=50, db_path=db_path)
    list_ms = round((time.perf_counter() - listed_started) * 1000, 2)
    search_started = time.perf_counter()
    search("realusageprobe", category="knowledge", db_path=db_path)
    search_ms = round((time.perf_counter() - search_started) * 1000, 2)
    check("response_performance_observation", total == len(file_manifest(project_dir)) + 2 and bool(files), list_ms=list_ms, search_ms=search_ms)

    final_manifest = file_manifest(project_dir)
    check("copied_source_files_preserved", final_manifest == source_manifest, source_files=len(source_manifest))
    report["status"] = "passed"
    report["performance"] = {"full_scan_ms": full_scan.duration_ms, "list_files_ms": list_ms, "knowledge_search_ms": search_ms}
    return report


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--validation-root", required=True)
    parser.add_argument("--project-copy", required=True)
    args = parser.parse_args()
    validation_root = Path(args.validation_root).resolve()
    project_dir = Path(args.project_copy).resolve()
    report_path = validation_root / "real-usage-report.json"
    try:
        report = run(validation_root, project_dir)
    except Exception as exc:
        report = {"status": "failed", "error": f"{type(exc).__name__}: {exc}"}
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report.get("status") == "passed" else 1


if __name__ == "__main__":
    raise SystemExit(main())
