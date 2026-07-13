"""Tests for AI Provider CRUD API (Phase 9 backend prerequisite)."""
import unittest
import tempfile
import os
from pathlib import Path
from unittest.mock import patch

from app.db.database import connect, initialize_database
from app.core_api import (
    create_ai_provider,
    delete_ai_provider,
    list_ai_providers,
    test_ai_provider,
    update_ai_provider,
)
from app.services.ai_providers import migrate_legacy_provider_keys


class TestAIProvidersAPI(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.db_path = Path(self._tmp.name) / "test.db"
        initialize_database(path=self.db_path)
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

    def _store_secret(self, provider_id: str, secret: str) -> str:
        self._secrets[provider_id] = secret
        return f"wincred:{provider_id}"

    def tearDown(self):
        for credential_patch in reversed(self._credentials_patches):
            credential_patch.stop()
        self._tmp.cleanup()

    def test_create_and_list_provider(self):
        provider = create_ai_provider(
            "OpenAI",
            "https://api.openai.com/v1",
            default_model="gpt-4",
            key_reference="env:OPENAI_API_KEY",
            db_path=self.db_path,
        )
        self.assertEqual(provider["name"], "OpenAI")
        self.assertTrue(provider["has_key"])
        self.assertTrue(provider["is_enabled"])
        # key_reference must never be exposed in the dict
        self.assertNotIn("key_reference", provider)

        providers = list_ai_providers(db_path=self.db_path)
        self.assertEqual(len(providers), 1)
        self.assertEqual(providers[0]["name"], "OpenAI")
        with connect(self.db_path) as conn:
            stored_reference = conn.execute(
                "SELECT key_reference FROM ai_providers WHERE id = ?", (provider["id"],)
            ).fetchone()[0]
        self.assertEqual(stored_reference, f"wincred:{provider['id']}")
        self.assertNotIn("OPENAI_API_KEY", stored_reference)

    def test_create_requires_name_and_url(self):
        with self.assertRaises(ValueError) as ctx:
            create_ai_provider("", "https://x", db_path=self.db_path)
        self.assertEqual(str(ctx.exception), "name_and_base_url_required")

        with self.assertRaises(ValueError) as ctx:
            create_ai_provider("Invalid", "file:///tmp/provider", db_path=self.db_path)
        self.assertEqual(str(ctx.exception), "base_url_invalid")

    def test_update_provider(self):
        provider = create_ai_provider("Test", "https://x", db_path=self.db_path)
        updated = update_ai_provider(
            provider["id"],
            name="Renamed",
            is_enabled=False,
            key_reference="rotated-secret",
            db_path=self.db_path,
        )
        self.assertEqual(updated["name"], "Renamed")
        self.assertFalse(updated["is_enabled"])
        self.assertEqual(self._secrets[provider["id"]], "rotated-secret")

        cleared = update_ai_provider(provider["id"], key_reference="", db_path=self.db_path)
        self.assertFalse(cleared["has_key"])
        self.assertNotIn(provider["id"], self._secrets)

        with self.assertRaises(ValueError) as ctx:
            update_ai_provider(provider["id"], base_url="ftp://provider", db_path=self.db_path)
        self.assertEqual(str(ctx.exception), "base_url_invalid")

    def test_update_nonexistent_raises(self):
        with self.assertRaises(ValueError) as ctx:
            update_ai_provider("nonexistent", name="X", db_path=self.db_path)
        self.assertEqual(str(ctx.exception), "provider_not_found")

    def test_delete_provider(self):
        provider = create_ai_provider(
            "ToDelete", "https://x", key_reference="delete-secret", db_path=self.db_path
        )
        result = delete_ai_provider(provider["id"], db_path=self.db_path)
        self.assertTrue(result["deleted"])
        self.assertEqual(len(list_ai_providers(db_path=self.db_path)), 0)
        self.assertNotIn(provider["id"], self._secrets)

    def test_delete_nonexistent_raises(self):
        with self.assertRaises(ValueError) as ctx:
            delete_ai_provider("nonexistent", db_path=self.db_path)
        self.assertEqual(str(ctx.exception), "provider_not_found")

    def test_test_provider_readiness(self):
        provider_no_key = create_ai_provider("NoKey", "https://x", db_path=self.db_path)
        result = test_ai_provider(provider_no_key["id"], db_path=self.db_path)
        self.assertFalse(result["ready"])
        self.assertEqual(result["message"], "missing_base_url_or_key")

        provider_full = create_ai_provider(
            "Full", "https://x", key_reference="env:KEY", db_path=self.db_path
        )
        with patch("urllib.request.urlopen") as urlopen:
            result2 = test_ai_provider(provider_full["id"], db_path=self.db_path)
        self.assertTrue(result2["ready"])
        self.assertEqual(result2["message"], "provider_connected")
        urlopen.assert_called_once()

    def test_connection_test_migrates_legacy_key_after_credential_write(self):
        provider = create_ai_provider("Legacy", "https://x", db_path=self.db_path)
        with connect(self.db_path) as conn:
            conn.execute(
                "UPDATE ai_providers SET key_reference = ? WHERE id = ?",
                ("legacy-secret", provider["id"]),
            )

        with patch("urllib.request.urlopen") as urlopen:
            result = test_ai_provider(provider["id"], db_path=self.db_path)

        self.assertTrue(result["ready"])
        self.assertEqual(urlopen.call_args.args[0].get_header("Authorization"), "Bearer legacy-secret")
        with connect(self.db_path) as conn:
            stored_reference = conn.execute(
                "SELECT key_reference FROM ai_providers WHERE id = ?", (provider["id"],)
            ).fetchone()[0]
        self.assertEqual(stored_reference, f"wincred:{provider['id']}")

    def test_startup_migrates_legacy_keys_without_clearing_failed_entries(self):
        migratable = create_ai_provider("Migratable", "https://x", db_path=self.db_path)
        retained = create_ai_provider("Retained", "https://y", db_path=self.db_path)
        with connect(self.db_path) as conn:
            conn.execute(
                "UPDATE ai_providers SET key_reference = ? WHERE id = ?",
                ("migrate-secret", migratable["id"]),
            )
            conn.execute(
                "UPDATE ai_providers SET key_reference = ? WHERE id = ?",
                ("retain-secret", retained["id"]),
            )

        original_store = self._store_secret

        def store_or_fail(provider_id: str, secret: str) -> str:
            if provider_id == retained["id"]:
                raise OSError("credential store unavailable")
            return original_store(provider_id, secret)

        with patch(
            "app.services.ai_providers.provider_credentials.store_secret",
            side_effect=store_or_fail,
        ):
            result = migrate_legacy_provider_keys(db_path=self.db_path)

        self.assertEqual(result, {"migrated": 1, "retained": 1})
        with connect(self.db_path) as conn:
            migrated_reference = conn.execute(
                "SELECT key_reference FROM ai_providers WHERE id = ?", (migratable["id"],)
            ).fetchone()[0]
            retained_value = conn.execute(
                "SELECT key_reference FROM ai_providers WHERE id = ?", (retained["id"],)
            ).fetchone()[0]
        self.assertEqual(migrated_reference, f"wincred:{migratable['id']}")
        self.assertEqual(retained_value, "retain-secret")

    def test_key_reference_not_leaked_in_list(self):
        create_ai_provider(
            "Secret", "https://x", key_reference="super-secret-key", db_path=self.db_path
        )
        providers = list_ai_providers(db_path=self.db_path)
        for p in providers:
            self.assertNotIn("key_reference", p)
            self.assertNotIn("super-secret-key", str(p))


if __name__ == "__main__":
    unittest.main()
