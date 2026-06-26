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

            with patch("app.api.search.search") as mocked_search:
                from app.search.service import search

                mocked_search.side_effect = lambda *args, **kwargs: search(
                    *args,
                    db_path=db_path,
                    **{key: value for key, value in kwargs.items() if key != "db_path"},
                )
                body = get_search(q="marble", category=None, limit=20)

            self.assertEqual(body["status"], "success")
            self.assertEqual(body["message"], "search_completed")
            self.assertIn("total", body["meta"])
            self.assertTrue(body["data"])
            self.assertEqual(
                set(body["data"][0]),
                {
                    "entity_id",
                    "entity_type",
                    "title",
                    "project_id",
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
