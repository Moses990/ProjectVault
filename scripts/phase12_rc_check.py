import argparse
import json
import shutil
import sqlite3
import sys
import tempfile
import time
from contextlib import closing
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from app.core_api import create_database_backup, restore_database_backup  # noqa: E402
from app.db.database import initialize_database  # noqa: E402
from app.scanner.full_scanner import scan_project  # noqa: E402
from app.scanner.incremental_scanner import scan_project_incremental  # noqa: E402
from app.search.indexer import rebuild_search_index  # noqa: E402
from app.search.service import search  # noqa: E402


def write_project_json(project_dir: Path, project_id: str, name: str) -> None:
    payload = {
        "project_id": project_id,
        "name": name,
        "type": "retail",
        "phase": "rc",
        "status": "healthy",
        "manager": "RC",
        "tags": ["release", "candidate"],
        "ai": {"summary": "Release candidate validation project"},
        "schema_version": 1,
    }
    (project_dir / "project.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def create_fixture_project(root: Path, file_count: int) -> Path:
    project_dir = root / "RC Fixture Project"
    project_dir.mkdir()
    write_project_json(project_dir, "project-rc-fixture", "RC Fixture Project")
    batch_dir = project_dir / "batch"
    batch_dir.mkdir()
    for index in range(file_count):
        (batch_dir / f"fixture_{index:06d}.txt").write_text(
            f"release candidate ordinary file {index}",
            encoding="utf-8",
        )
    (batch_dir / "needle_release_candidate.txt").write_text(
        "phase twelve needle release candidate content",
        encoding="utf-8",
    )
    drawings = project_dir / "drawings"
    drawings.mkdir()
    (drawings / "A101_floor_plan_FINAL.dwg").write_bytes(b"dwg")
    materials = project_dir / "materials"
    materials.mkdir()
    (materials / "finish_schedule.pdf").write_bytes(b"pdf")
    return project_dir


def table_counts(db_path: Path) -> dict[str, int]:
    with closing(sqlite3.connect(db_path)) as conn:
        return {
            "projects": conn.execute("SELECT COUNT(*) FROM projects").fetchone()[0],
            "files": conn.execute("SELECT COUNT(*) FROM files").fetchone()[0],
            "drawings": conn.execute("SELECT COUNT(*) FROM drawings").fetchone()[0],
            "materials": conn.execute("SELECT COUNT(*) FROM materials").fetchone()[0],
            "fts_global": conn.execute("SELECT COUNT(*) FROM fts_global").fetchone()[0],
        }


def run_check(file_count: int, keep: bool) -> dict[str, object]:
    temp_root = Path(tempfile.mkdtemp(prefix="project-vault-rc-"))
    started = time.perf_counter()
    try:
        db_path = temp_root / "project_vault.db"
        initialize_started = time.perf_counter()
        initialize_database(db_path)
        initialize_ms = int((time.perf_counter() - initialize_started) * 1000)

        project_dir = create_fixture_project(temp_root, file_count)
        full_scan = scan_project(project_dir, db_path=db_path)

        created_file = project_dir / "batch" / "incremental_new_file.txt"
        created_file.write_text("incremental release check", encoding="utf-8")
        incremental_scan = scan_project_incremental(
            project_dir,
            db_path=db_path,
            changed_paths=[created_file],
        )

        index_result = rebuild_search_index(db_path=db_path)
        search_started = time.perf_counter()
        results = search("needle", db_path=db_path, limit=10)
        search_ms = (time.perf_counter() - search_started) * 1000

        backup = create_database_backup(db_path=db_path)
        with closing(sqlite3.connect(db_path)) as conn:
            conn.execute("DELETE FROM projects WHERE id = 'project-rc-fixture'")
            conn.commit()
        restore = restore_database_backup(str(backup["name"]), confirm=True, db_path=db_path)
        restored_counts = table_counts(db_path)

        total_ms = int((time.perf_counter() - started) * 1000)
        return {
            "temp_root": str(temp_root),
            "file_target": file_count,
            "initialize_ms": initialize_ms,
            "full_scan": {
                "file_count": full_scan.file_count,
                "drawing_count": full_scan.drawing_count,
                "material_count": full_scan.material_count,
                "duration_ms": full_scan.duration_ms,
            },
            "incremental_scan": {
                "created_count": incremental_scan.created_count,
                "updated_count": incremental_scan.updated_count,
                "deleted_count": incremental_scan.deleted_count,
                "moved_count": incremental_scan.moved_count,
                "duration_ms": incremental_scan.duration_ms,
            },
            "fts_indexed_count": index_result.indexed_count,
            "search_ms": round(search_ms, 3),
            "search_hit": any(item.title == "needle_release_candidate.txt" for item in results),
            "backup": backup,
            "restore": restore,
            "restored_counts": restored_counts,
            "total_ms": total_ms,
            "passed": (
                full_scan.file_count >= file_count + 4
                and incremental_scan.created_count == 1
                and search_ms < 100
                and any(item.title == "needle_release_candidate.txt" for item in results)
                and bool(restore["restored"])
                and restored_counts["projects"] == 1
            ),
        }
    finally:
        if not keep:
            shutil.rmtree(temp_root, ignore_errors=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Run Project Vault Phase 12 RC validation.")
    parser.add_argument("--files", type=int, default=100000)
    parser.add_argument("--keep", action="store_true")
    args = parser.parse_args()

    report = run_check(args.files, args.keep)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if not report["passed"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
