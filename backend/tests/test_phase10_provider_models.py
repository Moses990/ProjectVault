"""Phase 10.2 model-list contract tests using local-only fixtures."""
from __future__ import annotations

import json
import socket
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from unittest.mock import MagicMock, patch

from app.db.database import connect, initialize_database
from app.services.ai_providers import (
    _open_provider_request,
    create_ai_provider,
    list_provider_models,
    preview_provider_models,
)


class _ModelsHandler(BaseHTTPRequestHandler):
    status = 200
    payload = b'{"data": []}'
    authorization: str | None = None

    def do_GET(self) -> None:  # noqa: N802
        type(self).authorization = self.headers.get("Authorization")
        self.send_response(type(self).status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(type(self).payload)

    def log_message(self, _format: str, *_args: object) -> None:
        return


class TestPhase10ProviderModels(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp.name) / "models.db"
        initialize_database(self.db_path)
        self.secrets: dict[str, str] = {}
        self.credential_patches = [
            patch("app.services.ai_providers.provider_credentials.store_secret", side_effect=self._store),
            patch("app.services.ai_providers.provider_credentials.read_secret", side_effect=lambda provider_id, _ref: self.secrets.get(provider_id)),
            patch("app.services.ai_providers.provider_credentials.delete_secret", side_effect=lambda provider_id, _ref: self.secrets.pop(provider_id, None)),
        ]
        for item in self.credential_patches:
            item.start()
        _ModelsHandler.status = 200
        _ModelsHandler.payload = b'{"data": []}'
        _ModelsHandler.authorization = None
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), _ModelsHandler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.base_url = f"http://127.0.0.1:{self.server.server_port}/v1"

    def tearDown(self) -> None:
        self.server.shutdown()
        self.thread.join()
        self.server.server_close()
        for item in reversed(self.credential_patches):
            item.stop()
        self.temp.cleanup()

    def _store(self, provider_id: str, secret: str) -> str:
        self.secrets[provider_id] = secret
        return f"wincred:{provider_id}"

    def test_models_are_sanitized_deduplicated_sorted_and_limited(self) -> None:
        data = [
            {"id": " model10 ", "owned_by": " local "},
            {"id": "model2"},
            {"id": "model2", "owned_by": "duplicate"},
            {"id": ""},
            {"id": 42},
        ] + [{"id": f"z{i}"} for i in range(510)]
        _ModelsHandler.payload = json.dumps({"data": data}).encode()
        result = preview_provider_models(self.base_url)
        self.assertEqual(result["total"], 500)
        self.assertEqual(result["items"][:2], [{"id": "model2"}, {"id": "model10", "owned_by": "local"}])
        self.assertEqual(len({item["id"] for item in result["items"]}), 500)

    def test_empty_list_and_invalid_payloads(self) -> None:
        self.assertEqual(preview_provider_models(self.base_url), {"items": [], "total": 0})
        for payload, code in (
            (b'{"data": {}}', "provider_invalid_response"),
            (b"not-json", "provider_invalid_response"),
            (b"x" * (1024 * 1024 + 1), "provider_response_too_large"),
        ):
            _ModelsHandler.payload = payload
            with self.assertRaisesRegex(ValueError, code):
                preview_provider_models(self.base_url)

    def test_http_and_timeout_errors_are_stable_and_secret_free(self) -> None:
        fake_key = "fixture-secret-never-return"
        for status, code in ((401, "invalid_api_key"), (403, "provider_forbidden"), (404, "provider_not_found"), (429, "provider_rate_limited"), (500, "provider_unavailable")):
            _ModelsHandler.status = status
            with self.assertRaises(ValueError) as raised:
                preview_provider_models(self.base_url, fake_key)
            self.assertEqual(str(raised.exception), code)
            self.assertNotIn(fake_key, str(raised.exception))
        with patch("app.services.ai_providers._open_provider_request", side_effect=socket.timeout()):
            with self.assertRaisesRegex(ValueError, "provider_timeout"):
                preview_provider_models(self.base_url, fake_key)

    def test_preview_does_not_write_database_or_credentials(self) -> None:
        _ModelsHandler.payload = b'{"data": [{"id": "manual-model"}]}'
        with connect(self.db_path) as conn:
            before = conn.execute("SELECT COUNT(*) FROM ai_providers").fetchone()[0]
        with patch("app.services.ai_providers.provider_credentials.store_secret") as store, patch("app.services.ai_providers.provider_credentials.read_secret") as read:
            result = preview_provider_models(self.base_url, "temporary-key")
        with connect(self.db_path) as conn:
            after = conn.execute("SELECT COUNT(*) FROM ai_providers").fetchone()[0]
        self.assertEqual(result["items"], [{"id": "manual-model"}])
        self.assertEqual((before, after), (0, 0))
        store.assert_not_called()
        read.assert_not_called()

    def test_saved_provider_requires_managed_or_explicit_no_auth_credentials(self) -> None:
        secured = create_ai_provider("Secured", self.base_url, api_key="managed-key", db_path=self.db_path)
        list_provider_models(str(secured["id"]), db_path=self.db_path)
        self.assertEqual(_ModelsHandler.authorization, "Bearer managed-key")
        missing = create_ai_provider("Missing", self.base_url, db_path=self.db_path)
        with self.assertRaisesRegex(ValueError, "provider_credential_unavailable"):
            list_provider_models(str(missing["id"]), db_path=self.db_path)
        local = create_ai_provider("Local", self.base_url, auth_mode="none", db_path=self.db_path)
        list_provider_models(str(local["id"]), db_path=self.db_path)
        self.assertIsNone(_ModelsHandler.authorization)

    def test_legacy_plaintext_is_blocked(self) -> None:
        provider = create_ai_provider("Legacy", self.base_url, db_path=self.db_path)
        with connect(self.db_path) as conn:
            conn.execute("UPDATE ai_providers SET key_reference = 'plaintext' WHERE id = ?", (provider["id"],))
        with self.assertRaisesRegex(ValueError, "migration_required"):
            list_provider_models(str(provider["id"]), db_path=self.db_path)

    def test_https_downgrade_is_blocked_before_second_request(self) -> None:
        response = MagicMock()
        response.getcode.return_value = 302
        response.headers = {"Location": "http://secure.example/models"}
        opener = MagicMock()
        opener.open.return_value = response
        with patch("urllib.request.build_opener", return_value=opener):
            with self.assertRaisesRegex(ValueError, "provider_redirect_blocked"):
                _open_provider_request("https://secure.example/models", headers={"Authorization": "Bearer fake"})
        self.assertEqual(opener.open.call_count, 1)


if __name__ == "__main__":
    unittest.main()
