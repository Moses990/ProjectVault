"""AI provider domain: CRUD and connectivity test."""

from __future__ import annotations

import uuid
from pathlib import Path
from typing import Any

from app.db.database import connect


def _provider_row_to_dict(row: Any) -> dict[str, object]:
    """Strip the raw key_reference; expose only whether a key is set."""
    return {
        "id": row["id"],
        "name": row["name"],
        "base_url": row["base_url"],
        "default_model": row["default_model"] or "",
        "is_enabled": bool(row["is_enabled"]),
        "has_key": bool(row["key_reference"]),
    }


def list_ai_providers(db_path: Path | None = None) -> list[dict[str, object]]:
    with connect(db_path) as conn:
        rows = conn.execute(
            "SELECT id, name, base_url, default_model, is_enabled, key_reference "
            "FROM ai_providers ORDER BY is_enabled DESC, name ASC"
        ).fetchall()
    return [_provider_row_to_dict(row) for row in rows]


def create_ai_provider(
    name: str,
    base_url: str,
    default_model: str = "",
    key_reference: str = "",
    db_path: Path | None = None,
) -> dict[str, object]:
    if not name.strip() or not base_url.strip():
        raise ValueError("name_and_base_url_required")
    provider_id = str(uuid.uuid4())
    with connect(db_path) as conn:
        conn.execute(
            "INSERT INTO ai_providers (id, name, base_url, default_model, is_enabled, key_reference) "
            "VALUES (?, ?, ?, ?, 1, ?)",
            (provider_id, name.strip(), base_url.strip(), default_model.strip() or None, key_reference or None),
        )
        row = conn.execute(
            "SELECT id, name, base_url, default_model, is_enabled, key_reference "
            "FROM ai_providers WHERE id = ?",
            (provider_id,),
        ).fetchone()
    return _provider_row_to_dict(row)


def update_ai_provider(
    provider_id: str,
    *,
    name: str | None = None,
    base_url: str | None = None,
    default_model: str | None = None,
    is_enabled: bool | None = None,
    key_reference: str | None = None,
    db_path: Path | None = None,
) -> dict[str, object]:
    with connect(db_path) as conn:
        existing = conn.execute(
            "SELECT id FROM ai_providers WHERE id = ?", (provider_id,)
        ).fetchone()
        if existing is None:
            raise ValueError("provider_not_found")
        fields: list[str] = []
        params: list[object] = []
        if name is not None:
            if not name.strip():
                raise ValueError("name_required")
            fields.append("name = ?")
            params.append(name.strip())
        if base_url is not None:
            if not base_url.strip():
                raise ValueError("base_url_required")
            fields.append("base_url = ?")
            params.append(base_url.strip())
        if default_model is not None:
            fields.append("default_model = ?")
            params.append(default_model.strip() or None)
        if is_enabled is not None:
            fields.append("is_enabled = ?")
            params.append(1 if is_enabled else 0)
        if key_reference is not None:
            fields.append("key_reference = ?")
            params.append(key_reference or None)
        if fields:
            params.append(provider_id)
            conn.execute(
                f"UPDATE ai_providers SET {', '.join(fields)} WHERE id = ?",
                params,
            )
        row = conn.execute(
            "SELECT id, name, base_url, default_model, is_enabled, key_reference "
            "FROM ai_providers WHERE id = ?",
            (provider_id,),
        ).fetchone()
    return _provider_row_to_dict(row)


def delete_ai_provider(provider_id: str, db_path: Path | None = None) -> dict[str, object]:
    with connect(db_path) as conn:
        existing = conn.execute(
            "SELECT id FROM ai_providers WHERE id = ?", (provider_id,)
        ).fetchone()
        if existing is None:
            raise ValueError("provider_not_found")
        conn.execute("DELETE FROM ai_providers WHERE id = ?", (provider_id,))
    return {"id": provider_id, "deleted": True}


def test_ai_provider(provider_id: str, db_path: Path | None = None) -> dict[str, object]:
    """Real connectivity test: sends a GET to {base_url}/models with Bearer auth.

    Returns ready=True when the server responds (even with 401/403 — that means
    the server is reachable).  Returns ready=False with a descriptive message
    on network errors or timeout.
    """
    import urllib.error
    import urllib.request

    with connect(db_path) as conn:
        row = conn.execute(
            "SELECT id, name, base_url, default_model, is_enabled, key_reference "
            "FROM ai_providers WHERE id = ?",
            (provider_id,),
        ).fetchone()
        if row is None:
            raise ValueError("provider_not_found")

    base_url = (row["base_url"] or "").rstrip("/")
    key = row["key_reference"] or ""

    if not base_url or not key:
        return {
            "id": provider_id,
            "name": row["name"],
            "ready": False,
            "message": "missing_base_url_or_key",
        }

    url = f"{base_url}/models"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {key}"})
    try:
        urllib.request.urlopen(req, timeout=10)
        return {"id": provider_id, "name": row["name"], "ready": True, "message": "provider_connected"}
    except urllib.error.HTTPError as exc:
        if exc.code in {401, 403}:
            return {"id": provider_id, "name": row["name"], "ready": False, "message": "invalid_api_key"}
        return {"id": provider_id, "name": row["name"], "ready": True, "message": "provider_connected"}
    except urllib.error.URLError as exc:
        return {"id": provider_id, "name": row["name"], "ready": False, "message": f"network_error: {exc.reason}"}
    except Exception as exc:
        return {"id": provider_id, "name": row["name"], "ready": False, "message": f"unknown_error: {exc}"}
