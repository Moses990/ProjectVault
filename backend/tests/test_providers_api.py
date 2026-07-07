"""Tests for AI Provider CRUD API (Phase 9 backend prerequisite)."""
import unittest
import tempfile
import os
from pathlib import Path
from unittest.mock import patch

from app.db.database import initialize_database
from app.core_api import (
    create_ai_provider,
    delete_ai_provider,
    list_ai_providers,
    test_ai_provider,
    update_ai_provider,
)


class TestAIProvidersAPI(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.db_path = Path(self._tmp.name) / "test.db"
        initialize_database(path=self.db_path)

    def tearDown(self):
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

    def test_create_requires_name_and_url(self):
        with self.assertRaises(ValueError) as ctx:
            create_ai_provider("", "https://x", db_path=self.db_path)
        self.assertEqual(str(ctx.exception), "name_and_base_url_required")

    def test_update_provider(self):
        provider = create_ai_provider("Test", "https://x", db_path=self.db_path)
        updated = update_ai_provider(
            provider["id"],
            name="Renamed",
            is_enabled=False,
            db_path=self.db_path,
        )
        self.assertEqual(updated["name"], "Renamed")
        self.assertFalse(updated["is_enabled"])

    def test_update_nonexistent_raises(self):
        with self.assertRaises(ValueError) as ctx:
            update_ai_provider("nonexistent", name="X", db_path=self.db_path)
        self.assertEqual(str(ctx.exception), "provider_not_found")

    def test_delete_provider(self):
        provider = create_ai_provider("ToDelete", "https://x", db_path=self.db_path)
        result = delete_ai_provider(provider["id"], db_path=self.db_path)
        self.assertTrue(result["deleted"])
        self.assertEqual(len(list_ai_providers(db_path=self.db_path)), 0)

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
