import json
import sqlite3
import unittest
import urllib.error
from contextlib import closing
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import MagicMock, patch

from fastapi import HTTPException

from app.api.knowledge import (
    ApplyDraftRequest,
    CreateDraftRequest,
    ExtractTextRequest,
    get_project_knowledge,
    post_knowledge_apply,
    post_knowledge_draft,
    post_knowledge_extract_text,
)
from app.api.projects import post_project_ai_analyze
from app.db.database import initialize_database
from app.scanner.full_scanner import scan_project
from app.search.service import search
from app.services.ai_providers import MAX_PROVIDER_RESPONSE_BYTES, create_ai_provider


def create_fixture_project(root: Path, db_path: Path) -> dict[str, str]:
    project_dir = root / "Knowledge Fixture"
    project_dir.mkdir()
    (project_dir / "project.json").write_text(
        json.dumps(
            {
                "project_id": "knowledge-project",
                "name": "Knowledge Fixture",
                "type": "retail",
                "phase": "concept",
                "status": "active",
                "manager": "Fixture",
                "tags": ["approved"],
                "ai": {
                    "summary": "approved summary",
                    "core_needs": ["approved need"],
                    "special_reqs": [],
                    "risks": [],
                    "lessons": [],
                },
                "schema_version": "1.0",
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    docs_dir = project_dir / "02_需求资料"
    docs_dir.mkdir()
    brief = docs_dir / "brief.md"
    brief.write_text("核心需求：控制顾客动线。\n风险：交付周期紧。", encoding="utf-8")
    sheet = docs_dir / "materials.csv"
    sheet.write_text("name,value\n灯具,暖白\n", encoding="utf-8")
    pdf = docs_dir / "brief.pdf"
    pdf.write_bytes(b"%PDF-unsupported")

    with closing(sqlite3.connect(db_path)) as conn:
        conn.execute(
            """
            INSERT INTO projects (id, project_path, name, type, phase, status, manager)
            VALUES ('knowledge-project', ?, 'Knowledge Fixture', 'retail', 'concept', 'active', 'Fixture')
            """,
            (str(project_dir),),
        )
        files = {
            "brief": ("file-brief", "02_需求资料/brief.md", "brief.md", ".md"),
            "csv": ("file-csv", "02_需求资料/materials.csv", "materials.csv", ".csv"),
            "pdf": ("file-pdf", "02_需求资料/brief.pdf", "brief.pdf", ".pdf"),
        }
        for file_id, relative_path, file_name, extension in files.values():
            conn.execute(
                """
                INSERT INTO files (id, project_id, relative_path, relative_dir, file_name, extension)
                VALUES (?, 'knowledge-project', ?, '02_需求资料', ?, ?)
                """,
                (file_id, relative_path, file_name, extension),
            )
        conn.commit()
    return {"brief": "file-brief", "csv": "file-csv", "pdf": "file-pdf"}


class KnowledgeApiTests(unittest.TestCase):
    def test_extract_text_caches_supported_sources_and_failed_unsupported_file(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            db_path = root / "project_vault.db"
            initialize_database(db_path)
            files = create_fixture_project(root, db_path)

            with patch("app.api.knowledge.get_database_path", return_value=db_path):
                response = post_knowledge_extract_text(
                    "knowledge-project",
                    ExtractTextRequest(file_ids=[files["brief"], files["pdf"]]),
                )

            self.assertEqual(response["data"]["processed"], 2)
            self.assertEqual(response["data"]["ready"], 1)
            self.assertEqual(response["data"]["failed"], 1)
            sources = response["data"]["sources"]
            self.assertEqual(sources[0]["relative_path"], "02_需求资料/brief.md")
            self.assertIn("控制顾客动线", sources[0]["text_excerpt"])
            self.assertNotIn(str(root), json.dumps(sources, ensure_ascii=False))
            self.assertEqual(sources[1]["status"], "failed")
            self.assertEqual(sources[1]["error_message"], "unsupported_format")

    def test_extract_rejects_file_from_another_project(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            db_path = root / "project_vault.db"
            initialize_database(db_path)
            files = create_fixture_project(root, db_path)
            with closing(sqlite3.connect(db_path)) as conn:
                conn.execute(
                    """
                    INSERT INTO projects (id, project_path, name)
                    VALUES ('other-project', ?, 'Other')
                    """,
                    (str(root / "other"),),
                )
                conn.commit()

            with patch("app.api.knowledge.get_database_path", return_value=db_path):
                with self.assertRaises(HTTPException) as raised:
                    post_knowledge_extract_text(
                        "other-project",
                        ExtractTextRequest(file_ids=[files["brief"]]),
                    )

            self.assertEqual(raised.exception.status_code, 400)
            self.assertEqual(raised.exception.detail, "file_not_in_project")

    def test_extract_ignores_project_json_metadata_file(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            db_path = root / "project_vault.db"
            initialize_database(db_path)
            create_fixture_project(root, db_path)
            with closing(sqlite3.connect(db_path)) as conn:
                conn.execute(
                    """
                    INSERT INTO files (id, project_id, relative_path, relative_dir, file_name, extension)
                    VALUES ('file-project-json', 'knowledge-project', 'project.json', '', 'project.json', '.json')
                    """
                )
                conn.commit()

            with patch("app.api.knowledge.get_database_path", return_value=db_path):
                response = post_knowledge_extract_text(
                    "knowledge-project",
                    ExtractTextRequest(file_ids=["file-project-json"]),
                )
                draft = post_knowledge_draft(
                    "knowledge-project",
                    CreateDraftRequest(source_ids=[response["data"]["sources"][0]["id"]], mode="manual"),
                )

            self.assertEqual(response["data"]["ready"], 0)
            self.assertEqual(response["data"]["failed"], 1)
            self.assertEqual(response["data"]["sources"][0]["error_message"], "system_file_ignored")
            self.assertNotIn("approved summary", draft["data"]["draft"]["summary"])

    def test_create_manual_draft_from_sources_keeps_approved_metadata_unchanged(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            db_path = root / "project_vault.db"
            initialize_database(db_path)
            files = create_fixture_project(root, db_path)

            with closing(sqlite3.connect(db_path)) as conn:
                conn.execute(
                    """
                    INSERT INTO ai_metadata (project_id, summary, core_needs)
                    VALUES ('knowledge-project', 'approved summary', ?)
                    """,
                    (json.dumps(["approved need"], ensure_ascii=False),),
                )
                conn.commit()

            with patch("app.api.knowledge.get_database_path", return_value=db_path):
                extracted = post_knowledge_extract_text(
                    "knowledge-project",
                    ExtractTextRequest(file_ids=[files["brief"]]),
                )
                source_id = extracted["data"]["sources"][0]["id"]
                draft = post_knowledge_draft(
                    "knowledge-project",
                    CreateDraftRequest(source_ids=[source_id], mode="manual"),
                )
                knowledge = get_project_knowledge("knowledge-project")

            self.assertEqual(draft["data"]["status"], "draft")
            self.assertIn("控制顾客动线", draft["data"]["draft"]["summary"])
            self.assertEqual(knowledge["data"]["knowledge"]["summary"], "approved summary")
            self.assertEqual(knowledge["data"]["draft"]["id"], draft["data"]["draft_id"])

    def test_ai_draft_requires_configured_provider(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            db_path = root / "project_vault.db"
            initialize_database(db_path)
            create_fixture_project(root, db_path)

            with patch("app.api.knowledge.get_database_path", return_value=db_path):
                with self.assertRaises(HTTPException) as raised:
                    post_knowledge_draft(
                        "knowledge-project",
                        CreateDraftRequest(source_ids=[], mode="ai"),
                    )

            self.assertEqual(raised.exception.status_code, 400)
            self.assertEqual(raised.exception.detail, "ai_provider_required")

    def test_ai_draft_uses_provider_and_keeps_approved_metadata_unchanged(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            db_path = root / "project_vault.db"
            initialize_database(db_path)
            files = create_fixture_project(root, db_path)
            create_ai_provider(
                "Fixture AI",
                "http://127.0.0.1:43210/v1",
                default_model="fixture-model",
                key_reference="fixture-key",
                db_path=db_path,
            )
            with closing(sqlite3.connect(db_path)) as conn:
                conn.execute(
                    "INSERT INTO ai_metadata (project_id, summary) VALUES ('knowledge-project', 'approved summary')"
                )
                conn.commit()

            provider_payload = {
                "choices": [{
                    "message": {
                        "content": json.dumps(
                            {
                                "summary": "AI draft summary",
                                "core_needs": ["控制顾客动线"],
                                "special_reqs": ["夜间施工"],
                                "risks": ["交付周期紧"],
                                "lessons": ["提前冻结样板"],
                                "tags": ["retail", "wayfinding"],
                            },
                            ensure_ascii=False,
                        )
                    }
                }]
            }
            response = MagicMock()
            response.read.return_value = json.dumps(provider_payload, ensure_ascii=False).encode("utf-8")
            response.__enter__.return_value = response

            with patch("app.api.knowledge.get_database_path", return_value=db_path):
                extracted = post_knowledge_extract_text(
                    "knowledge-project",
                    ExtractTextRequest(file_ids=[files["brief"]]),
                )
                with patch("urllib.request.urlopen", return_value=response) as urlopen:
                    draft = post_knowledge_draft(
                        "knowledge-project",
                        CreateDraftRequest(
                            source_ids=[extracted["data"]["sources"][0]["id"]],
                            mode="ai",
                        ),
                    )

            self.assertEqual(draft["data"]["draft"]["summary"], "AI draft summary")
            self.assertEqual(draft["data"]["provider_name"], "Fixture AI")
            self.assertEqual(draft["data"]["model_name"], "fixture-model")
            self.assertEqual(draft["data"]["draft"]["evidence"][0]["relative_path"], "02_需求资料/brief.md")
            request = urlopen.call_args.args[0]
            self.assertIn("控制顾客动线", request.data.decode("utf-8"))

            with closing(sqlite3.connect(db_path)) as conn:
                conn.row_factory = sqlite3.Row
                approved = conn.execute(
                    "SELECT summary FROM ai_metadata WHERE project_id = 'knowledge-project'"
                ).fetchone()
                stored = conn.execute(
                    "SELECT provider_name, model_name, status FROM knowledge_drafts WHERE id = ?",
                    (draft["data"]["draft_id"],),
                ).fetchone()

            self.assertEqual(approved["summary"], "approved summary")
            self.assertEqual(stored["provider_name"], "Fixture AI")
            self.assertEqual(stored["model_name"], "fixture-model")
            self.assertEqual(stored["status"], "draft")

    def test_ai_provider_failure_does_not_create_draft_or_change_approved_metadata(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            db_path = root / "project_vault.db"
            initialize_database(db_path)
            files = create_fixture_project(root, db_path)
            create_ai_provider(
                "Offline AI",
                "http://127.0.0.1:43211/v1",
                default_model="fixture-model",
                key_reference="fixture-key",
                db_path=db_path,
            )
            with closing(sqlite3.connect(db_path)) as conn:
                conn.execute(
                    "INSERT INTO ai_metadata (project_id, summary) VALUES ('knowledge-project', 'approved summary')"
                )
                conn.commit()

            with patch("app.api.knowledge.get_database_path", return_value=db_path):
                extracted = post_knowledge_extract_text(
                    "knowledge-project",
                    ExtractTextRequest(file_ids=[files["brief"]]),
                )
                with patch("urllib.request.urlopen", side_effect=urllib.error.URLError("offline")):
                    with self.assertRaises(HTTPException) as raised:
                        post_knowledge_draft(
                            "knowledge-project",
                            CreateDraftRequest(
                                source_ids=[extracted["data"]["sources"][0]["id"]],
                                mode="ai",
                            ),
                        )

            self.assertEqual(raised.exception.status_code, 400)
            self.assertIn("network_error", raised.exception.detail)

            invalid_response = MagicMock()
            invalid_response.read.return_value = b"[]"
            invalid_response.__enter__.return_value = invalid_response
            with patch("app.api.knowledge.get_database_path", return_value=db_path):
                with patch("urllib.request.urlopen", return_value=invalid_response):
                    with self.assertRaises(HTTPException) as invalid_raised:
                        post_knowledge_draft(
                            "knowledge-project",
                            CreateDraftRequest(
                                source_ids=[extracted["data"]["sources"][0]["id"]],
                                mode="ai",
                            ),
                        )
            self.assertEqual(invalid_raised.exception.detail, "invalid_response")

            with closing(sqlite3.connect(db_path)) as conn:
                approved = conn.execute(
                    "SELECT summary FROM ai_metadata WHERE project_id = 'knowledge-project'"
                ).fetchone()[0]
                draft_count = conn.execute(
                    "SELECT COUNT(*) FROM knowledge_drafts WHERE project_id = 'knowledge-project'"
                ).fetchone()[0]
            self.assertEqual(approved, "approved summary")
            self.assertEqual(draft_count, 0)

    def test_ai_provider_response_has_size_limit(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            db_path = root / "project_vault.db"
            initialize_database(db_path)
            files = create_fixture_project(root, db_path)
            create_ai_provider(
                "Oversized AI",
                "http://127.0.0.1:43212/v1",
                default_model="fixture-model",
                key_reference="fixture-key",
                db_path=db_path,
            )
            response = MagicMock()
            response.read.return_value = b"x" * (MAX_PROVIDER_RESPONSE_BYTES + 1)
            response.__enter__.return_value = response

            with patch("app.api.knowledge.get_database_path", return_value=db_path):
                extracted = post_knowledge_extract_text(
                    "knowledge-project",
                    ExtractTextRequest(file_ids=[files["brief"]]),
                )
                with patch("urllib.request.urlopen", return_value=response):
                    with self.assertRaises(HTTPException) as raised:
                        post_knowledge_draft(
                            "knowledge-project",
                            CreateDraftRequest(
                                source_ids=[extracted["data"]["sources"][0]["id"]],
                                mode="ai",
                            ),
                        )

            self.assertEqual(raised.exception.detail, "response_too_large")

    def test_legacy_ai_analyze_endpoint_cannot_bypass_draft_review(self) -> None:
        with self.assertRaises(HTTPException) as raised:
            post_project_ai_analyze("knowledge-project")

        self.assertEqual(raised.exception.status_code, 409)
        self.assertEqual(raised.exception.detail, "use_knowledge_draft_flow")

    def test_apply_requires_confirm(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            db_path = root / "project_vault.db"
            initialize_database(db_path)
            create_fixture_project(root, db_path)

            with patch("app.api.knowledge.get_database_path", return_value=db_path):
                draft = post_knowledge_draft(
                    "knowledge-project",
                    CreateDraftRequest(
                        source_ids=[],
                        mode="manual",
                        draft={"summary": "draft summary", "core_needs": [], "special_reqs": [], "risks": [], "lessons": [], "tags": [], "evidence": []},
                    ),
                )
                with self.assertRaises(HTTPException) as raised:
                    post_knowledge_apply(
                        "knowledge-project",
                        ApplyDraftRequest(draft_id=draft["data"]["draft_id"], fields=["summary"], confirm=False),
                    )

            self.assertEqual(raised.exception.status_code, 400)
            self.assertEqual(raised.exception.detail, "confirm_required")

    def test_apply_rejects_non_object_project_json_without_claiming_draft(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            db_path = root / "project_vault.db"
            initialize_database(db_path)
            create_fixture_project(root, db_path)
            with patch("app.api.knowledge.get_database_path", return_value=db_path):
                draft = post_knowledge_draft(
                    "knowledge-project",
                    CreateDraftRequest(
                        source_ids=[],
                        mode="manual",
                        draft={"summary": "draft", "core_needs": [], "special_reqs": [], "risks": [], "lessons": [], "tags": [], "evidence": []},
                    ),
                )
                (root / "Knowledge Fixture" / "project.json").write_text("[]", encoding="utf-8")
                with self.assertRaises(HTTPException) as raised:
                    post_knowledge_apply(
                        "knowledge-project",
                        ApplyDraftRequest(draft_id=draft["data"]["draft_id"], fields=["summary"], confirm=True),
                    )

            self.assertEqual(raised.exception.detail, "project_json_invalid")
            with closing(sqlite3.connect(db_path)) as conn:
                status = conn.execute(
                    "SELECT status FROM knowledge_drafts WHERE id = ?",
                    (draft["data"]["draft_id"],),
                ).fetchone()[0]
            self.assertEqual(status, "draft")

    def test_approved_evidence_exposes_only_bounded_relative_fields(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            db_path = root / "project_vault.db"
            initialize_database(db_path)
            create_fixture_project(root, db_path)
            project_json = root / "Knowledge Fixture" / "project.json"
            data = json.loads(project_json.read_text(encoding="utf-8"))
            data["ai"]["evidence"] = [
                {"relative_path": "02_需求资料/brief.md", "excerpt": "x" * 900, "absolute_path": "D:/private"},
                {"relative_path": "C:/private/secret.txt", "excerpt": "secret"},
                {"relative_path": "../outside.txt", "excerpt": "outside"},
            ]
            project_json.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")

            with patch("app.api.knowledge.get_database_path", return_value=db_path):
                knowledge = get_project_knowledge("knowledge-project")["data"]["knowledge"]

            self.assertEqual(len(knowledge["evidence"]), 1)
            self.assertEqual(knowledge["evidence"][0]["relative_path"], "02_需求资料/brief.md")
            self.assertEqual(len(knowledge["evidence"][0]["excerpt"]), 800)
            self.assertNotIn("absolute_path", knowledge["evidence"][0])

    def test_apply_draft_updates_project_json_cache_and_search(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            db_path = root / "project_vault.db"
            initialize_database(db_path)
            create_fixture_project(root, db_path)
            draft_payload = {
                "summary": "handover checklist summary",
                "core_needs": ["customer route control"],
                "special_reqs": ["night work"],
                "risks": ["long lead item"],
                "lessons": ["freeze samples early"],
                "tags": ["handover", "fixture"],
                "evidence": [{"relative_path": "02_需求资料/brief.md", "excerpt": "route control"}],
            }

            with patch("app.api.knowledge.get_database_path", return_value=db_path):
                draft = post_knowledge_draft(
                    "knowledge-project",
                    CreateDraftRequest(source_ids=[], mode="manual", draft=draft_payload),
                )
                applied = post_knowledge_apply(
                    "knowledge-project",
                    ApplyDraftRequest(
                        draft_id=draft["data"]["draft_id"],
                        fields=["summary", "core_needs", "special_reqs", "risks", "lessons", "tags", "evidence"],
                        confirm=True,
                    ),
                )

            project_json = root / "Knowledge Fixture" / "project.json"
            saved = json.loads(project_json.read_text(encoding="utf-8"))
            self.assertTrue(applied["data"]["applied"])
            self.assertTrue((project_json.parent / applied["data"]["project_json_backup"]).exists())
            self.assertEqual(saved["ai"]["summary"], "handover checklist summary")
            self.assertEqual(saved["ai"]["core_needs"], ["customer route control"])
            self.assertEqual(saved["ai"]["evidence"][0]["relative_path"], "02_需求资料/brief.md")
            self.assertEqual(saved["tags"], ["handover", "fixture"])

            with closing(sqlite3.connect(db_path)) as conn:
                conn.row_factory = sqlite3.Row
                metadata = conn.execute("SELECT summary, core_needs FROM ai_metadata WHERE project_id = 'knowledge-project'").fetchone()
                tags = [row["tag_name"] for row in conn.execute("SELECT tag_name FROM project_tags WHERE project_id = 'knowledge-project' ORDER BY tag_name")]
                draft_status = conn.execute("SELECT status FROM knowledge_drafts WHERE id = ?", (draft["data"]["draft_id"],)).fetchone()["status"]
                history = conn.execute("SELECT event_type, status FROM knowledge_history WHERE project_id = 'knowledge-project' AND event_type = 'apply_draft'").fetchone()

            self.assertEqual(metadata["summary"], "handover checklist summary")
            self.assertEqual(json.loads(metadata["core_needs"]), ["customer route control"])
            self.assertEqual(tags, ["fixture", "handover"])
            self.assertEqual(draft_status, "applied")
            self.assertEqual(history["status"], "success")
            self.assertTrue(any(item.entity_type == "knowledge" for item in search("handover", category="knowledge", db_path=db_path)))

            with patch("app.api.knowledge.get_database_path", return_value=db_path):
                knowledge = get_project_knowledge("knowledge-project")
            self.assertEqual(
                knowledge["data"]["knowledge"]["evidence"][0]["relative_path"],
                "02_需求资料/brief.md",
            )

            saved["ai"]["summary"] = "later curated summary"
            project_json.write_text(json.dumps(saved, ensure_ascii=False, indent=2), encoding="utf-8")
            with patch("app.api.knowledge.get_database_path", return_value=db_path):
                with self.assertRaises(HTTPException) as repeated:
                    post_knowledge_apply(
                        "knowledge-project",
                        ApplyDraftRequest(
                            draft_id=draft["data"]["draft_id"],
                            fields=["summary"],
                            confirm=True,
                        ),
                    )
            self.assertEqual(repeated.exception.detail, "draft_not_found")
            self.assertEqual(
                json.loads(project_json.read_text(encoding="utf-8"))["ai"]["summary"],
                "later curated summary",
            )

    def test_apply_failure_restores_project_json_and_draft_state(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            db_path = root / "project_vault.db"
            initialize_database(db_path)
            create_fixture_project(root, db_path)
            project_json = root / "Knowledge Fixture" / "project.json"
            original = project_json.read_text(encoding="utf-8")

            with patch("app.api.knowledge.get_database_path", return_value=db_path):
                draft = post_knowledge_draft(
                    "knowledge-project",
                    CreateDraftRequest(
                        source_ids=[],
                        mode="manual",
                        draft={"summary": "unsafe draft", "core_needs": [], "special_reqs": [], "risks": [], "lessons": [], "tags": [], "evidence": []},
                    ),
                )

                calls = 0

                def flaky_scan(project_path, db_path=None):
                    nonlocal calls
                    calls += 1
                    if calls == 1:
                        raise RuntimeError("scan failed")
                    return scan_project(project_path, db_path=db_path)

                with patch("app.knowledge.service.scan_project", side_effect=flaky_scan):
                    with self.assertRaises(HTTPException) as raised:
                        post_knowledge_apply(
                            "knowledge-project",
                            ApplyDraftRequest(
                                draft_id=draft["data"]["draft_id"],
                                fields=["summary"],
                                confirm=True,
                            ),
                        )

            self.assertEqual(raised.exception.detail, "apply_failed_rolled_back")
            self.assertEqual(project_json.read_text(encoding="utf-8"), original)
            with closing(sqlite3.connect(db_path)) as conn:
                draft_status = conn.execute(
                    "SELECT status FROM knowledge_drafts WHERE id = ?",
                    (draft["data"]["draft_id"],),
                ).fetchone()[0]
                summary = conn.execute(
                    "SELECT summary FROM ai_metadata WHERE project_id = 'knowledge-project'",
                ).fetchone()[0]
            self.assertEqual(draft_status, "draft")
            self.assertEqual(summary, "approved summary")

    def test_full_scan_preserves_unchanged_extracted_sources(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            db_path = root / "project_vault.db"
            initialize_database(db_path)
            create_fixture_project(root, db_path)
            project_dir = root / "Knowledge Fixture"
            scan_project(project_dir, db_path=db_path)
            with closing(sqlite3.connect(db_path)) as conn:
                file_id = conn.execute(
                    "SELECT id FROM files WHERE project_id = 'knowledge-project' AND relative_path = '02_需求资料/brief.md'",
                ).fetchone()[0]

            with patch("app.api.knowledge.get_database_path", return_value=db_path):
                post_knowledge_extract_text(
                    "knowledge-project",
                    ExtractTextRequest(file_ids=[file_id]),
                )
            scan_project(project_dir, db_path=db_path)

            with closing(sqlite3.connect(db_path)) as conn:
                source_count = conn.execute(
                    "SELECT COUNT(*) FROM knowledge_sources WHERE project_id = 'knowledge-project'",
                ).fetchone()[0]
            self.assertEqual(source_count, 1)


if __name__ == "__main__":
    unittest.main()
