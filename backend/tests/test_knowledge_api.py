import json
import io
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
    get_knowledge_history,
    get_project_knowledge,
    post_knowledge_apply,
    post_knowledge_discard,
    post_knowledge_draft,
    post_knowledge_extract_text,
)
from app.api.projects import post_project_ai_analyze
from app.db.database import initialize_database
from app.scanner.full_scanner import scan_project
from app.search.service import search
from app.knowledge.service import MAX_SOURCE_BYTES
from app.services.ai_providers import (
    MAX_PROVIDER_OUTPUT_TOKENS,
    MAX_PROVIDER_RESPONSE_BYTES,
    create_ai_provider,
)


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
    _write_text_pdf(pdf, "")
    pdf_text = docs_dir / "concept.pdf"
    _write_text_pdf(pdf_text, "Customer circulation requirement")

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
            "pdf_text": ("file-pdf-text", "02_需求资料/concept.pdf", "concept.pdf", ".pdf"),
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
    return {"brief": "file-brief", "csv": "file-csv", "pdf": "file-pdf", "pdf_text": "file-pdf-text"}


def _write_text_pdf(path: Path, text: str) -> None:
    content = f"BT /F1 12 Tf 72 720 Td ({text}) Tj ET".encode("ascii")
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Length " + str(len(content)).encode("ascii") + b" >>\nstream\n" + content + b"\nendstream",
    ]
    document = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for index, value in enumerate(objects, start=1):
        offsets.append(len(document))
        document.extend(f"{index} 0 obj\n".encode("ascii"))
        document.extend(value)
        document.extend(b"\nendobj\n")
    xref = len(document)
    document.extend(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
    document.extend(b"0000000000 65535 f \n")
    document.extend(b"".join(f"{offset:010} 00000 n \n".encode("ascii") for offset in offsets[1:]))
    document.extend(f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode("ascii"))
    path.write_bytes(document)


class KnowledgeApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self._secrets: dict[str, str] = {}
        self._credentials_patches = [
            patch(
                "app.services.ai_providers.provider_credentials.store_secret",
                side_effect=self._store_secret,
            ),
            patch(
                "app.services.ai_providers.provider_credentials.read_secret",
                side_effect=lambda provider_id, _reference: self._secrets.get(provider_id),
            ),
            patch(
                "app.services.ai_providers.provider_credentials.delete_secret",
                side_effect=lambda provider_id, _reference: self._secrets.pop(provider_id, None),
            ),
        ]
        for credential_patch in self._credentials_patches:
            credential_patch.start()

    def tearDown(self) -> None:
        for credential_patch in reversed(self._credentials_patches):
            credential_patch.stop()

    def _store_secret(self, provider_id: str, secret: str) -> str:
        self._secrets[provider_id] = secret
        return f"wincred:{provider_id}"

    def test_discard_draft_keeps_project_json_unchanged(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            db_path = root / "project_vault.db"
            initialize_database(db_path)
            files = create_fixture_project(root, db_path)
            project_json = root / "Knowledge Fixture" / "project.json"
            original = project_json.read_text(encoding="utf-8")

            with patch("app.api.knowledge.get_database_path", return_value=db_path):
                extracted = post_knowledge_extract_text(
                    "knowledge-project",
                    ExtractTextRequest(file_ids=[files["brief"]]),
                )
                draft = post_knowledge_draft(
                    "knowledge-project",
                    CreateDraftRequest(source_ids=[extracted["data"]["sources"][0]["id"]], mode="manual"),
                )
                discarded = post_knowledge_discard("knowledge-project", draft["data"]["draft_id"])

            self.assertTrue(discarded["data"]["discarded"])
            self.assertEqual(project_json.read_text(encoding="utf-8"), original)
            with closing(sqlite3.connect(db_path)) as conn:
                status = conn.execute(
                    "SELECT status FROM knowledge_drafts WHERE id = ?",
                    (draft["data"]["draft_id"],),
                ).fetchone()[0]
            self.assertEqual(status, "discarded")

    def test_extract_text_reads_text_based_pdf(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            db_path = root / "project_vault.db"
            initialize_database(db_path)
            files = create_fixture_project(root, db_path)

            with patch("app.api.knowledge.get_database_path", return_value=db_path):
                response = post_knowledge_extract_text(
                    "knowledge-project",
                    ExtractTextRequest(file_ids=[files["pdf_text"]]),
                )

            source = response["data"]["sources"][0]
            self.assertEqual(response["data"]["ready"], 1)
            self.assertEqual(source["extractor"], "pypdf")
            self.assertIn("Customer circulation", source["text_excerpt"])

    def test_extract_text_bounds_pdf_content_before_storing(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            db_path = root / "project_vault.db"
            initialize_database(db_path)
            files = create_fixture_project(root, db_path)
            page = MagicMock()
            page.extract_text.return_value = "x" * (MAX_SOURCE_BYTES + 100)
            reader = MagicMock()
            reader.pages = [page]

            with patch("app.api.knowledge.get_database_path", return_value=db_path), patch(
                "app.knowledge.service.PdfReader", return_value=reader
            ):
                response = post_knowledge_extract_text(
                    "knowledge-project",
                    ExtractTextRequest(file_ids=[files["pdf_text"]]),
                )

            source = response["data"]["sources"][0]
            self.assertEqual(source["status"], "ready")
            self.assertEqual(source["text_length"], MAX_SOURCE_BYTES)
            self.assertEqual(len(source["text_excerpt"]), 800)

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
            self.assertEqual(sources[1]["error_message"], "no_extractable_text")

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
                with self.assertRaises(HTTPException) as draft:
                    post_knowledge_draft(
                        "knowledge-project",
                        CreateDraftRequest(source_ids=[response["data"]["sources"][0]["id"]], mode="manual"),
                    )

            self.assertEqual(response["data"]["ready"], 0)
            self.assertEqual(response["data"]["failed"], 1)
            self.assertEqual(response["data"]["sources"][0]["error_message"], "system_file_ignored")
            self.assertEqual(draft.exception.detail, "source_not_ready")
            with closing(sqlite3.connect(db_path)) as conn:
                self.assertEqual(conn.execute("SELECT COUNT(*) FROM knowledge_drafts").fetchone()[0], 0)

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
            self.assertEqual(raised.exception.detail, "provider_not_configured")

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
                api_key="fixture-key",
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
            response.getcode.return_value = 200
            response.__enter__.return_value = response

            with patch("app.api.knowledge.get_database_path", return_value=db_path):
                extracted = post_knowledge_extract_text(
                    "knowledge-project",
                    ExtractTextRequest(file_ids=[files["brief"]]),
                )
                with patch("app.services.ai_providers._open_provider_request", return_value=response) as open_request:
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
            payload = open_request.call_args.kwargs["data"]
            self.assertIn("控制顾客动线", payload.decode("utf-8"))
            self.assertEqual(json.loads(payload)["max_tokens"], MAX_PROVIDER_OUTPUT_TOKENS)

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
                api_key="fixture-key",
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
                with patch("app.services.ai_providers._open_provider_request", side_effect=urllib.error.URLError("offline")):
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
            invalid_response.getcode.return_value = 200
            invalid_response.__enter__.return_value = invalid_response
            with patch("app.api.knowledge.get_database_path", return_value=db_path):
                with patch("app.services.ai_providers._open_provider_request", return_value=invalid_response):
                    with self.assertRaises(HTTPException) as invalid_raised:
                        post_knowledge_draft(
                            "knowledge-project",
                            CreateDraftRequest(
                                source_ids=[extracted["data"]["sources"][0]["id"]],
                                mode="ai",
                            ),
                        )
            self.assertEqual(invalid_raised.exception.detail, "invalid_response")

            provider_error = urllib.error.HTTPError(
                "http://127.0.0.1:43211/v1/chat/completions",
                502,
                "Bad Gateway",
                None,
                io.BytesIO(b"provider-returned-sensitive-detail"),
            )
            with patch("app.api.knowledge.get_database_path", return_value=db_path):
                provider_error.__enter__ = lambda: provider_error
                provider_error.__exit__ = lambda *_args: False
                with patch("app.services.ai_providers._open_provider_request", return_value=provider_error):
                    with self.assertRaises(HTTPException) as provider_raised:
                        post_knowledge_draft(
                            "knowledge-project",
                            CreateDraftRequest(
                                source_ids=[extracted["data"]["sources"][0]["id"]],
                                mode="ai",
                            ),
                        )
            self.assertEqual(provider_raised.exception.detail, "api_error:provider_unavailable")

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
                api_key="fixture-key",
                db_path=db_path,
            )
            response = MagicMock()
            response.read.return_value = b"x" * (MAX_PROVIDER_RESPONSE_BYTES + 1)
            response.getcode.return_value = 200
            response.__enter__.return_value = response

            with patch("app.api.knowledge.get_database_path", return_value=db_path):
                extracted = post_knowledge_extract_text(
                    "knowledge-project",
                    ExtractTextRequest(file_ids=[files["brief"]]),
                )
                with patch("app.services.ai_providers._open_provider_request", return_value=response):
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
                failed_history = conn.execute(
                    "SELECT status, metadata_json FROM knowledge_history WHERE project_id = 'knowledge-project' AND event_type = 'apply_draft' ORDER BY created_at DESC LIMIT 1",
                ).fetchone()
            self.assertEqual(draft_status, "draft")
            self.assertEqual(summary, "approved summary")
            self.assertEqual(failed_history[0], "failed")
            self.assertEqual(json.loads(failed_history[1]), {"draft_id": draft["data"]["draft_id"]})

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

    def test_runtime_model_is_used_without_changing_provider_default(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            db_path = root / "project_vault.db"
            initialize_database(db_path)
            files = create_fixture_project(root, db_path)
            provider = create_ai_provider(
                "Fixture AI",
                "http://127.0.0.1:43210/v1",
                default_model="default-model",
                api_key="fixture-key",
                db_path=db_path,
            )
            provider_payload = {"choices": [{"message": {"content": json.dumps({"summary": "runtime draft"})}}]}
            response = MagicMock()
            response.read.return_value = json.dumps(provider_payload).encode("utf-8")
            response.getcode.return_value = 200
            response.__enter__.return_value = response

            with patch("app.api.knowledge.get_database_path", return_value=db_path):
                extracted = post_knowledge_extract_text(
                    "knowledge-project",
                    ExtractTextRequest(file_ids=[files["brief"]]),
                )
                with patch("app.services.ai_providers._open_provider_request", return_value=response) as request:
                    created = post_knowledge_draft(
                        "knowledge-project",
                        CreateDraftRequest(
                            source_ids=[extracted["data"]["sources"][0]["id"]],
                            mode="ai",
                            provider_id=str(provider["id"]),
                            model_id=" runtime-model ",
                        ),
                    )

            self.assertEqual(json.loads(request.call_args.kwargs["data"])["model"], "runtime-model")
            self.assertEqual(created["data"]["model_name"], "runtime-model")
            with closing(sqlite3.connect(db_path)) as conn:
                default_model = conn.execute(
                    "SELECT default_model FROM ai_providers WHERE id = ?", (provider["id"],)
                ).fetchone()[0]
            self.assertEqual(default_model, "default-model")

    def test_runtime_model_required_and_active_draft_conflict(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            db_path = root / "project_vault.db"
            initialize_database(db_path)
            files = create_fixture_project(root, db_path)
            provider = create_ai_provider(
                "No Default",
                "http://127.0.0.1:43210/v1",
                api_key="fixture-key",
                db_path=db_path,
            )
            with patch("app.api.knowledge.get_database_path", return_value=db_path):
                extracted = post_knowledge_extract_text(
                    "knowledge-project",
                    ExtractTextRequest(file_ids=[files["brief"]]),
                )
                with self.assertRaises(HTTPException) as missing_model:
                    post_knowledge_draft(
                        "knowledge-project",
                        CreateDraftRequest(
                            source_ids=[extracted["data"]["sources"][0]["id"]],
                            mode="ai",
                            provider_id=str(provider["id"]),
                        ),
                    )
                first = post_knowledge_draft(
                    "knowledge-project",
                    CreateDraftRequest(source_ids=[], mode="manual", draft={"summary": "first"}),
                )
                with self.assertRaises(HTTPException) as conflict:
                    post_knowledge_draft(
                        "knowledge-project",
                        CreateDraftRequest(source_ids=[], mode="manual", draft={"summary": "second"}),
                    )

            self.assertEqual(missing_model.exception.detail, "provider_model_required")
            self.assertEqual(conflict.exception.detail, "active_draft_exists")
            with closing(sqlite3.connect(db_path)) as conn:
                rows = conn.execute(
                    "SELECT id, status FROM knowledge_drafts WHERE project_id = 'knowledge-project'"
                ).fetchall()
            self.assertEqual(rows, [(first["data"]["draft_id"], "draft")])

    def test_missing_file_is_a_failed_source_not_a_batch_error(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            db_path = root / "project_vault.db"
            initialize_database(db_path)
            files = create_fixture_project(root, db_path)
            (root / "Knowledge Fixture" / "02_需求资料" / "brief.md").unlink()

            with patch("app.api.knowledge.get_database_path", return_value=db_path):
                result = post_knowledge_extract_text(
                    "knowledge-project",
                    ExtractTextRequest(file_ids=[files["brief"], files["csv"]]),
                )
                knowledge = get_project_knowledge("knowledge-project")

            self.assertEqual(result["data"]["processed"], 2)
            self.assertEqual(result["data"]["ready"], 1)
            self.assertEqual(result["data"]["failed"], 1)
            missing = next(item for item in result["data"]["sources"] if item["file_id"] == files["brief"])
            self.assertEqual(missing["error_message"], "file_unavailable")
            self.assertEqual(len(knowledge["data"]["sources"]), 2)

    def test_draft_rejects_every_missing_or_non_ready_source_without_side_effects(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            db_path = root / "project_vault.db"
            initialize_database(db_path)
            files = create_fixture_project(root, db_path)
            project_json = root / "Knowledge Fixture" / "project.json"
            original = project_json.read_text(encoding="utf-8")
            with patch("app.api.knowledge.get_database_path", return_value=db_path):
                extracted = post_knowledge_extract_text("knowledge-project", ExtractTextRequest(file_ids=[files["brief"], files["csv"]]))
            ready_id, other_id = [item["id"] for item in extracted["data"]["sources"]]
            with closing(sqlite3.connect(db_path)) as conn:
                fts_before = conn.execute("SELECT COUNT(*) FROM fts_global").fetchone()[0]

            cases = {
                "unavailable": ("unavailable", "file_unavailable", [other_id]),
                "unsupported": ("unsupported", "unsupported_format", [other_id]),
                "unextracted": ("unextracted", None, [other_id]),
                "failed": ("failed", "no_extractable_text", [other_id]),
                "mixed": ("failed", "no_extractable_text", [ready_id, other_id]),
            }
            for name, (status, error_message, source_ids) in cases.items():
                with self.subTest(name=name), closing(sqlite3.connect(db_path)) as conn:
                    conn.execute("UPDATE knowledge_sources SET status = ?, error_message = ? WHERE id = ?", (status, error_message, other_id))
                    conn.commit()
                with self.subTest(name=name), patch("app.api.knowledge.get_database_path", return_value=db_path):
                    with self.assertRaises(HTTPException) as raised:
                        post_knowledge_draft("knowledge-project", CreateDraftRequest(source_ids=source_ids, mode="manual", draft={"summary": "must not persist"}))
                    self.assertEqual(raised.exception.detail, "source_not_ready")
                with closing(sqlite3.connect(db_path)) as conn:
                    self.assertEqual(conn.execute("SELECT COUNT(*) FROM knowledge_drafts").fetchone()[0], 0)
                    self.assertEqual(conn.execute("SELECT COUNT(*) FROM fts_global").fetchone()[0], fts_before)
                self.assertEqual(project_json.read_text(encoding="utf-8"), original)

            with patch("app.api.knowledge.get_database_path", return_value=db_path):
                with self.assertRaises(HTTPException) as missing:
                    post_knowledge_draft("knowledge-project", CreateDraftRequest(source_ids=["missing-source"], mode="manual", draft={"summary": "must not persist"}))
            self.assertEqual(missing.exception.detail, "source_not_found")

            with closing(sqlite3.connect(db_path)) as conn:
                conn.execute("UPDATE knowledge_sources SET status = 'ready', error_message = NULL WHERE id = ?", (ready_id,))
                conn.commit()
            with patch("app.api.knowledge.get_database_path", return_value=db_path):
                created = post_knowledge_draft("knowledge-project", CreateDraftRequest(source_ids=[ready_id], mode="manual"))
            self.assertEqual(created["data"]["status"], "draft")

    def test_history_is_paginated_project_scoped_and_private(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            db_path = root / "project_vault.db"
            initialize_database(db_path)
            create_fixture_project(root, db_path)
            with patch("app.api.knowledge.get_database_path", return_value=db_path):
                draft = post_knowledge_draft(
                    "knowledge-project",
                    CreateDraftRequest(source_ids=[], mode="manual", draft={"summary": "history"}),
                )
                post_knowledge_discard("knowledge-project", draft["data"]["draft_id"])
            with closing(sqlite3.connect(db_path)) as conn:
                conn.execute(
                    "INSERT INTO projects (id, project_path, name) VALUES ('other-project', ?, 'Other')",
                    (str(root / "Other"),),
                )
                conn.execute(
                    "INSERT INTO knowledge_history (id, project_id, event_type, status, message, metadata_json, created_at) VALUES ('other-history', 'other-project', 'apply_draft', 'success', 'private', '{\"api_key\":\"secret\"}', '2099-01-01')"
                )
                conn.commit()

            with patch("app.api.knowledge.get_database_path", return_value=db_path):
                first_page = get_knowledge_history("knowledge-project", limit=1, offset=0)["data"]
                second_page = get_knowledge_history("knowledge-project", limit=1, offset=1)["data"]

            self.assertEqual(first_page["total"], 2)
            self.assertEqual(len(first_page["items"]), 1)
            self.assertEqual(len(second_page["items"]), 1)
            self.assertNotEqual(first_page["items"][0]["id"], second_page["items"][0]["id"])
            self.assertTrue(all(set(item) == {"id", "event_type", "draft_id", "provider_name", "model_id", "status", "created_at"} for item in [*first_page["items"], *second_page["items"]]))
            self.assertNotIn("other-history", {item["id"] for item in [*first_page["items"], *second_page["items"]]})


if __name__ == "__main__":
    unittest.main()
