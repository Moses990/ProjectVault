from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = PROJECT_ROOT / "backend"
sys.path.insert(0, str(BACKEND_ROOT))

from app.db.database import connect, initialize_database  # noqa: E402
from app.scanner.full_scanner import scan_project  # noqa: E402
from app.search.indexer import rebuild_search_index  # noqa: E402
from app.search.service import search  # noqa: E402


PROJECTS = [
    {
        "id": "v26-wayfinding",
        "name": "Wayfinding Retail",
        "tags": ["route", "navigation"],
        "summary": "Customer circulation and wayfinding strategy for a retail flagship.",
        "needs": ["clear entry path", "queue control"],
    },
    {
        "id": "v26-acoustic",
        "name": "Acoustic Office",
        "tags": ["focus", "panels"],
        "summary": "Acoustic panel strategy for quiet work zones and meeting rooms.",
        "needs": ["noise control", "soft material selection"],
    },
    {
        "id": "v26-lighting",
        "name": "Warm Lighting Store",
        "tags": ["warm", "ambient"],
        "summary": "Warm lighting concept with low glare and high color rendering.",
        "needs": ["comfortable illumination", "display highlight"],
    },
]

QUERIES = [
    {"query": "wayfinding", "expected": "v26-wayfinding", "kind": "exact"},
    {"query": "customer route", "expected": "v26-wayfinding", "kind": "near"},
    {"query": "sound absorption", "expected": "v26-acoustic", "kind": "near"},
    {"query": "quiet meeting room", "expected": "v26-acoustic", "kind": "near"},
    {"query": "warm lighting", "expected": "v26-lighting", "kind": "exact"},
    {"query": "cozy illumination", "expected": "v26-lighting", "kind": "near"},
]

ALIASES = {
    "route": {"circulation", "wayfinding", "path", "queue"},
    "customer": {"retail", "entry", "queue"},
    "sound": {"acoustic", "noise", "quiet"},
    "absorption": {"panel", "panels", "soft"},
    "quiet": {"acoustic", "noise", "focus"},
    "room": {"rooms", "meeting"},
    "cozy": {"warm", "comfortable", "ambient"},
    "illumination": {"lighting", "light", "glare"},
}


def write_project(root: Path, spec: dict[str, object]) -> Path:
    project_dir = root / str(spec["name"])
    project_dir.mkdir(parents=True, exist_ok=True)
    project_json = {
        "project_id": spec["id"],
        "name": spec["name"],
        "type": "spike",
        "phase": "v2.6",
        "status": "active",
        "manager": "fixture",
        "tags": spec["tags"],
        "ai": {
            "summary": spec["summary"],
            "core_needs": spec["needs"],
            "special_reqs": [],
            "risks": [],
            "lessons": [],
        },
        "schema_version": "2.0",
    }
    (project_dir / "project.json").write_text(json.dumps(project_json, ensure_ascii=False, indent=2), encoding="utf-8")
    (project_dir / "brief.md").write_text(str(spec["summary"]), encoding="utf-8")
    return project_dir


def tokens(text: str) -> set[str]:
    return set(re.findall(r"[a-z0-9]+", text.lower()))


def expanded_tokens(query: str) -> set[str]:
    result = tokens(query)
    for token in list(result):
        result.update(ALIASES.get(token, set()))
    return result


def proxy_semantic_search(query: str, db_path: Path) -> list[dict[str, object]]:
    query_tokens = expanded_tokens(query)
    with connect(db_path) as conn:
        rows = conn.execute(
            """
            SELECT entity_id, project_id, title, content
            FROM fts_global
            WHERE entity_type = 'knowledge'
            """
        ).fetchall()
    scored = []
    for row in rows:
        content_tokens = tokens(f"{row['title']} {row['content']}")
        score = len(query_tokens & content_tokens)
        if score:
            scored.append(
                {
                    "project_id": row["project_id"],
                    "title": row["title"],
                    "score": score,
                    "matched": sorted(query_tokens & content_tokens),
                }
            )
    return sorted(scored, key=lambda item: (-int(item["score"]), str(item["project_id"])))


def run_spike(output_dir: Path) -> dict[str, object]:
    output_dir.mkdir(parents=True, exist_ok=True)
    db_path = output_dir / "project_vault.db"
    fixture_root = output_dir / "fixture-root"
    fixture_root.mkdir(parents=True, exist_ok=True)

    initialize_database(db_path)
    for spec in PROJECTS:
        scan_project(write_project(fixture_root, spec), db_path=db_path)
    rebuild_search_index(db_path=db_path)

    results = []
    for case in QUERIES:
        fts_results = search(str(case["query"]), category="knowledge", db_path=db_path)
        proxy_results = proxy_semantic_search(str(case["query"]), db_path)
        expected = str(case["expected"])
        results.append(
            {
                "query": case["query"],
                "kind": case["kind"],
                "expected": expected,
                "fts_hit": any(item.project_id == expected for item in fts_results),
                "fts_top": fts_results[0].project_id if fts_results else None,
                "proxy_hit": any(item["project_id"] == expected for item in proxy_results[:3]),
                "proxy_top": proxy_results[0]["project_id"] if proxy_results else None,
                "proxy_matched": proxy_results[0]["matched"] if proxy_results else [],
            }
        )

    total = len(results)
    exact = [item for item in results if item["kind"] == "exact"]
    near = [item for item in results if item["kind"] == "near"]
    summary = {
        "total_cases": total,
        "fts_hits": sum(1 for item in results if item["fts_hit"]),
        "proxy_hits": sum(1 for item in results if item["proxy_hit"]),
        "fts_near_hits": sum(1 for item in near if item["fts_hit"]),
        "proxy_near_hits": sum(1 for item in near if item["proxy_hit"]),
        "exact_cases": len(exact),
        "near_cases": len(near),
    }
    decision = (
        "defer_vector_dependency"
        if summary["proxy_near_hits"] > summary["fts_near_hits"]
        else "drop_semantic_search_for_now"
    )
    report = {
        "created_at": datetime.now().isoformat(),
        "db_path": str(db_path),
        "fixture_root": str(fixture_root),
        "summary": summary,
        "decision": decision,
        "recommendation": "Do not add vector dependency in V2.6. Keep FTS5; consider small alias/query-expansion layer first. Reopen vector proof only with real miss-query samples.",
        "results": results,
    }
    (output_dir / "semantic-search-spike-report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return report


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", type=Path)
    args = parser.parse_args()
    if args.output_dir:
        report = run_spike(args.output_dir)
    else:
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        report = run_spike(PROJECT_ROOT / "release-validation" / f"v2_6_semantic_search_spike-{stamp}")
    print(json.dumps(report["summary"] | {"decision": report["decision"]}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
