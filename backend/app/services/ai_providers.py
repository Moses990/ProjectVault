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


def analyze_project_with_ai(project_id: str, db_path: Path | None = None) -> dict[str, object]:
    """Analyze a project using the first enabled AI provider.

    Sends project info to the provider's chat completions API and stores
    the structured response in ai_metadata table.
    """
    import json
    import urllib.error
    import urllib.request

    with connect(db_path) as conn:
        # Get project info
        project = conn.execute(
            "SELECT id, name, type, phase, status, manager, file_count, cad_count, material_count, project_path "
            "FROM projects WHERE id = ?",
            (project_id,),
        ).fetchone()
        if project is None:
            raise ValueError("project_not_found")

        # Get file list summary
        files = conn.execute(
            "SELECT file_name, relative_dir, extension, size_bytes FROM files WHERE project_id = ? ORDER BY file_name LIMIT 100",
            (project_id,),
        ).fetchall()

        # Get first enabled provider with key
        provider = conn.execute(
            "SELECT id, name, base_url, default_model, key_reference "
            "FROM ai_providers WHERE is_enabled = 1 AND key_reference IS NOT NULL AND key_reference != '' "
            "ORDER BY name LIMIT 1"
        ).fetchone()
        if provider is None:
            raise ValueError("no_enabled_provider")

    # Build file summary
    file_summary = []
    for f in files:
        dir_info = f["relative_dir"] or ""
        file_summary.append(f"- {f['file_name']} ({dir_info}, {f['extension'] or 'unknown'}, {f['size_bytes']} bytes)")

    file_list_text = "\n".join(file_summary[:50])
    if len(files) > 50:
        file_list_text += f"\n... 还有 {len(files) - 50} 个文件"

    # Build prompt
    prompt = f"""你是一个建筑/室内设计行业的项目管理助手。请分析以下项目信息，并以 JSON 格式返回分析结果。

项目名称: {project['name']}
项目类型: {project['type'] or '未指定'}
项目阶段: {project['phase'] or '未指定'}
项目状态: {project['status'] or '未指定'}
负责人: {project['manager'] or '未指定'}
文件数量: {project['file_count']}
CAD 图纸: {project['cad_count']}
材料文件: {project['material_count']}

文件列表（最多 50 个）:
{file_list_text}

请以以下 JSON 格式返回分析结果（不要包含 markdown 代码块标记）:
{{
  "summary": "项目摘要（100-200字）",
  "core_needs": ["核心需求1", "核心需求2", ...],
  "special_reqs": ["特殊要求1", ...],
  "risks": ["风险1", ...],
  "lessons": ["经验教训1", ...]
}}

如果某些信息无法从文件列表推断，请基于行业经验给出合理建议。"""

    # Call AI provider
    base_url = (provider["base_url"] or "").rstrip("/")
    model = provider["default_model"] or "gpt-4o"
    key = provider["key_reference"]

    url = f"{base_url}/chat/completions"
    payload = json.dumps({
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.7,
        "max_tokens": 2000,
    }).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            response_data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        error_body = exc.read().decode("utf-8", errors="replace")[:500]
        raise ValueError(f"api_error: {exc.code} - {error_body}") from exc
    except urllib.error.URLError as exc:
        raise ValueError(f"network_error: {exc.reason}") from exc

    # Parse response
    content = response_data.get("choices", [{}])[0].get("message", {}).get("content", "")
    if not content:
        raise ValueError("empty_response")

    # Try to parse JSON from response
    try:
        # Remove markdown code blocks if present
        content = content.strip()
        if content.startswith("```"):
            content = content.split("\n", 1)[1] if "\n" in content else content
            content = content.rsplit("```", 1)[0] if "```" in content else content
            content = content.strip()

        result = json.loads(content)
    except json.JSONDecodeError as exc:
        raise ValueError(f"invalid_json_response: {exc}") from exc

    # Store in database
    with connect(db_path) as conn:
        conn.execute(
            """
            INSERT INTO ai_metadata (project_id, summary, core_needs, special_reqs, risks, lessons)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(project_id) DO UPDATE SET
                summary = excluded.summary,
                core_needs = excluded.core_needs,
                special_reqs = excluded.special_reqs,
                risks = excluded.risks,
                lessons = excluded.lessons
            """,
            (
                project_id,
                result.get("summary", ""),
                json.dumps(result.get("core_needs", []), ensure_ascii=False),
                json.dumps(result.get("special_reqs", []), ensure_ascii=False),
                json.dumps(result.get("risks", []), ensure_ascii=False),
                json.dumps(result.get("lessons", []), ensure_ascii=False),
            ),
        )

    return {
        "project_id": project_id,
        "provider": provider["name"],
        "model": model,
        "summary": result.get("summary", ""),
        "core_needs": result.get("core_needs", []),
        "special_reqs": result.get("special_reqs", []),
        "risks": result.get("risks", []),
        "lessons": result.get("lessons", []),
    }
