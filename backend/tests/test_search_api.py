import json
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from fastapi import HTTPException

from app.api.search import get_search
from app.db.database import initialize_database
from app.scanner.full_scanner import scan_project
from app.search.indexer import rebuild_search_index
from app.search.service import SearchPage, UnifiedSearchResult


def write_project(project_dir: Path) -> None:
    data = {
        "project_id": "project-api-search",
        "name": "Search API Store",
        "type": "retail",
        "phase": "design",
        "status": "healthy",
        "manager": "Nora",
        "tags": ["marble"],
        "ai": {
            "summary": "Material board includes marble counter samples",
            "core_needs": [],
            "special_reqs": [],
            "risks": [],
            "lessons": [],
        },
        "schema_version": 1,
    }
    (project_dir / "project.json").write_text(
        json.dumps(data, ensure_ascii=False),
        encoding="utf-8",
    )


class SearchApiTests(unittest.TestCase):
    def test_search_endpoint_returns_envelope_and_results(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            db_path = root / "project_vault.db"
            initialize_database(db_path)
            project_dir = root / "Search API Store"
            project_dir.mkdir()
            write_project(project_dir)
            (project_dir / "materials").mkdir()
            (project_dir / "materials" / "marble_counter.pdf").write_bytes(b"pdf")
            scan_project(project_dir, db_path=db_path)
            rebuild_search_index(db_path=db_path)

            page = SearchPage(
                query="marble",
                items=(UnifiedSearchResult(
                    result_id="file:file-search",
                    entity_type="file",
                    entity_id="file-search",
                    project_id="project-api-search",
                    project_name="Search API Store",
                    title="marble_counter.pdf",
                    relative_path="materials/marble_counter.pdf",
                    parent_path="materials",
                    extension=".pdf",
                    category=None,
                    file_id="file-search",
                    available=True,
                    labels=("file",),
                    match_source="title",
                    highlighted_content="marble_counter.pdf",
                    score=-1.0,
                ),),
                total=1,
                limit=20,
                offset=0,
                has_more=False,
                elapsed_ms=1.0,
            )
            with patch("app.api.search.search_page", return_value=page):
                body = get_search(q="marble", category=None, limit=20)

            self.assertEqual(body["status"], "success")
            self.assertEqual(body["message"], "search_completed")
            self.assertEqual(body["data"]["total"], 1)
            self.assertTrue(body["data"]["items"])
            self.assertEqual(
                set(body["data"]["items"][0]),
                {
                    "result_id",
                    "entity_id",
                    "entity_type",
                    "project_id",
                    "project_name",
                    "title",
                    "relative_path",
                    "parent_path",
                    "extension",
                    "category",
                    "file_id",
                    "available",
                    "labels",
                    "match_source",
                    "highlighted_content",
                    "score",
                },
            )

    def test_search_endpoint_rejects_empty_query(self) -> None:
        with self.assertRaises(HTTPException) as raised:
            get_search(q="   ")

        self.assertEqual(raised.exception.status_code, 400)
        self.assertEqual(raised.exception.detail, "query_required")


if __name__ == "__main__":
    unittest.main()
