"""Phase 10.1 provider contract and secret-safety regression tests."""
from __future__ import annotations

import json
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from unittest.mock import patch

from app.core_api import create_ai_provider, test_ai_provider, update_ai_provider
from app.db.database import connect, initialize_database
from app.services.ai_providers import generate_knowledge_payload


class _ProviderHandler(BaseHTTPRequestHandler):
    status = 200
    payload = b'{"data": []}'
    redirect_to: str | None = None
    received_authorizations: list[str | None] = []

    def do_GET(self) -> None:  # noqa: N802
        type(self).received_authorizations.append(self.headers.get("Authorization"))
        if type(self).redirect_to:
            location = type(self).redirect_to
            type(self).redirect_to = None
            self.send_response(302)
            self.send_header("Location", location)
            self.end_headers()
            return
        self.send_response(type(self).status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(type(self).payload)

    def do_POST(self) -> None:  # noqa: N802
        type(self).received_authorizations.append(self.headers.get("Authorization"))
        content_length = int(self.headers.get("Content-Length", "0"))
        if content_length:
            self.rfile.read(content_length)
        self.send_response(type(self).status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(type(self).payload)

    def log_message(self, _format: str, *_args: object) -> None:
        return


class TestPhase10ProviderContract(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp.name) / "contract.db"
        initialize_database(self.db_path)
        self.secrets: dict[str, str] = {}
        self.patches = [
            patch("app.services.ai_providers.provider_credentials.store_secret", side_effect=self._store),
            patch("app.services.ai_providers.provider_credentials.read_secret", side_effect=lambda provider_id, _ref: self.secrets.get(provider_id)),
            patch("app.services.ai_providers.provider_credentials.delete_secret", side_effect=lambda provider_id, _ref: self.secrets.pop(provider_id, None)),
        ]
        for item in self.patches:
            item.start()
        _ProviderHandler.status = 200
        _ProviderHandler.payload = b'{"data": []}'
        _ProviderHandler.redirect_to = None
        _ProviderHandler.received_authorizations = []
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), _ProviderHandler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.base_url = f"http://127.0.0.1:{self.server.server_port}/v1"

    def tearDown(self) -> None:
        self.server.shutdown()
        self.thread.join()
        self.server.server_close()
        for item in reversed(self.patches):
            item.stop()
        self.temp.cleanup()

    def _store(self, provider_id: str, secret: str) -> str:
        self.secrets[provider_id] = secret
        return f"wincred:{provider_id}"

    def _provider(self, name: str = "Fixture", api_key: str = "fake-key") -> dict[str, object]:
        return create_ai_provider(name, self.base_url + "/", api_key=api_key, db_path=self.db_path)

    def test_base_url_validation_and_normalization(self) -> None:
        for value in ("", "api.example.com", "ftp://host", "http://user@host", "https://host/?q=1", "https://host/#x", "https://host:0", "https://host:bad", "https://host/ bad"):
            with self.assertRaises(ValueError, msg=value):
                create_ai_provider(value or "bad", value, db_path=self.db_path)
        provider = self._provider()
        self.assertEqual(provider["base_url"], self.base_url)

    def test_success_requires_2xx_json_dict_and_data_list(self) -> None:
        provider = self._provider()
        for status, payload, expected in (
            (200, b'{"data": []}', "provider_connected"),
            (204, b"", "provider_invalid_response"),
            (200, b"not-json", "provider_invalid_response"),
            (200, b"[]", "provider_invalid_response"),
            (200, b'{"data": {}}', "provider_invalid_response"),
        ):
            _ProviderHandler.status, _ProviderHandler.payload = status, payload
            result = test_ai_provider(str(provider["id"]), db_path=self.db_path)
            self.assertEqual(result["code"], expected)

    def test_http_status_mapping_and_response_limit(self) -> None:
        provider = self._provider()
        for status, expected in ((401, "invalid_api_key"), (403, "provider_forbidden"), (404, "provider_not_found"), (429, "provider_rate_limited"), (500, "provider_unavailable"), (418, "provider_configuration_invalid")):
            _ProviderHandler.status, _ProviderHandler.payload = status, b"{}"
            self.assertEqual(test_ai_provider(str(provider["id"]), db_path=self.db_path)["code"], expected)
        _ProviderHandler.status, _ProviderHandler.payload = 200, b"x" * (1024 * 1024 + 1)
        self.assertEqual(test_ai_provider(str(provider["id"]), db_path=self.db_path)["code"], "provider_response_too_large")

    def test_same_origin_redirect_keeps_auth_and_cross_origin_is_blocked(self) -> None:
        provider = self._provider(api_key="fake-key")
        _ProviderHandler.redirect_to = "/v1/models"
        self.assertEqual(test_ai_provider(str(provider["id"]), db_path=self.db_path)["code"], "provider_connected")
        self.assertEqual(_ProviderHandler.received_authorizations, ["Bearer fake-key", "Bearer fake-key"])

        captured: list[str | None] = []

        class CaptureHandler(BaseHTTPRequestHandler):
            def do_GET(self) -> None:  # noqa: N802
                captured.append(self.headers.get("Authorization"))
                self.send_response(200); self.end_headers()
            def log_message(self, _format: str, *_args: object) -> None: return

        capture_server = ThreadingHTTPServer(("127.0.0.1", 0), CaptureHandler)
        capture_thread = threading.Thread(target=capture_server.serve_forever, daemon=True)
        capture_thread.start()
        try:
            _ProviderHandler.redirect_to = f"http://127.0.0.1:{capture_server.server_port}/models"
            result = test_ai_provider(str(provider["id"]), db_path=self.db_path)
            self.assertEqual(result["code"], "provider_redirect_blocked")
            self.assertEqual(captured, [])
        finally:
            capture_server.shutdown(); capture_thread.join(); capture_server.server_close()

    def test_legacy_key_is_not_used_and_reentry_replaces_it(self) -> None:
        provider = self._provider(api_key="")
        with connect(self.db_path) as conn:
            conn.execute("UPDATE ai_providers SET key_reference = ? WHERE id = ?", ("plaintext-secret", provider["id"]))
        result = test_ai_provider(str(provider["id"]), db_path=self.db_path)
        self.assertEqual(result["code"], "migration_required")
        updated = update_ai_provider(str(provider["id"]), api_key="replacement", db_path=self.db_path)
        self.assertEqual(updated["credential_state"], "ready")
        with connect(self.db_path) as conn:
            stored = conn.execute("SELECT key_reference FROM ai_providers WHERE id = ?", (provider["id"],)).fetchone()[0]
        self.assertNotIn("replacement", stored)

    def test_replacing_managed_key_keeps_new_secret(self) -> None:
        provider = self._provider(api_key="old-secret")

        updated = update_ai_provider(
            str(provider["id"]),
            api_key="replacement",
            db_path=self.db_path,
        )

        self.assertEqual(updated["credential_state"], "ready")
        self.assertEqual(self.secrets[str(provider["id"])], "replacement")

    def test_non_credential_update_preserves_managed_key(self) -> None:
        provider = self._provider(api_key="keep-secret")

        updated = update_ai_provider(
            str(provider["id"]),
            is_enabled=False,
            db_path=self.db_path,
        )

        self.assertEqual(updated["credential_state"], "ready")
        self.assertEqual(self.secrets[str(provider["id"])], "keep-secret")

    def test_auth_mode_change_rolls_back_when_old_secret_cannot_be_deleted(self) -> None:
        provider = self._provider(api_key="keep-secret")

        with patch(
            "app.services.ai_providers.provider_credentials.delete_secret",
            side_effect=OSError("credential store locked"),
        ), self.assertRaisesRegex(ValueError, "credential_store_unavailable"):
            update_ai_provider(
                str(provider["id"]),
                name="Changed name",
                auth_mode="none",
                db_path=self.db_path,
            )

        with connect(self.db_path) as conn:
            stored = conn.execute(
                "SELECT name, key_reference, auth_mode FROM ai_providers WHERE id = ?",
                (provider["id"],),
            ).fetchone()
        self.assertEqual(tuple(stored), ("Fixture", f"wincred:{provider['id']}", "api_key"))
        self.assertEqual(self.secrets[str(provider["id"])], "keep-secret")

    def test_duplicate_names_and_key_update_conflict(self) -> None:
        provider = self._provider("OpenAI")
        with self.assertRaisesRegex(ValueError, "provider_name_duplicate"):
            self._provider("openai")
        with self.assertRaisesRegex(ValueError, "api_key_clear_conflict"):
            update_ai_provider(str(provider["id"]), api_key="x", clear_api_key=True, db_path=self.db_path)

    def test_knowledge_requires_explicit_selection_for_multiple_enabled_providers(self) -> None:
        with connect(self.db_path) as conn:
            conn.execute("INSERT INTO projects (id, project_path, name) VALUES ('p1', 'C:/fixture', 'Fixture')")
        with self.assertRaisesRegex(ValueError, "provider_not_configured"):
            generate_knowledge_payload("p1", [], db_path=self.db_path)
        first = self._provider("One")
        second = self._provider("Two")
        with self.assertRaisesRegex(ValueError, "provider_selection_required"):
            generate_knowledge_payload("p1", [], db_path=self.db_path)
        update_ai_provider(str(first["id"]), is_enabled=False, db_path=self.db_path)
        with self.assertRaisesRegex(ValueError, "provider_model_required"):
            generate_knowledge_payload("p1", [], db_path=self.db_path, provider_id=str(second["id"]))
        with self.assertRaisesRegex(ValueError, "ready_sources_required"):
            generate_knowledge_payload(
                "p1", [], db_path=self.db_path, provider_id=str(second["id"]), model_id="fixture-model"
            )

    def test_knowledge_allows_unauthenticated_local_provider(self) -> None:
        with connect(self.db_path) as conn:
            conn.execute("INSERT INTO projects (id, project_path, name) VALUES ('p1', 'C:/fixture', 'Fixture')")
        provider = create_ai_provider(
            "Local",
            self.base_url,
            default_model="local-model",
            api_key="",
            auth_mode="none",
            db_path=self.db_path,
        )
        _ProviderHandler.payload = b'{"choices":[{"message":{"content":"{\\"summary\\":\\"ok\\"}"}}]}'

        result = generate_knowledge_payload(
            "p1",
            [{
                "id": "source-1",
                "file_id": "file-1",
                "relative_path": "brief.txt",
                "status": "ready",
                "text_excerpt": "fixture facts",
            }],
            db_path=self.db_path,
            provider_id=str(provider["id"]),
        )

        self.assertEqual(result["draft"]["summary"], "ok")
        self.assertEqual(_ProviderHandler.received_authorizations, [None])

    def test_missing_api_key_is_not_implicitly_unauthenticated(self) -> None:
        with connect(self.db_path) as conn:
            conn.execute("INSERT INTO projects (id, project_path, name) VALUES ('p1', 'C:/fixture', 'Fixture')")
        provider = create_ai_provider(
            "Cloud without key",
            self.base_url,
            default_model="cloud-model",
            api_key="",
            db_path=self.db_path,
        )

        with self.assertRaisesRegex(ValueError, "provider_credential_unavailable"):
            generate_knowledge_payload(
                "p1",
                [{
                    "id": "source-1",
                    "file_id": "file-1",
                    "relative_path": "brief.txt",
                    "status": "ready",
                    "text_excerpt": "fixture facts",
                }],
                db_path=self.db_path,
                provider_id=str(provider["id"]),
            )


if __name__ == "__main__":
    unittest.main()
