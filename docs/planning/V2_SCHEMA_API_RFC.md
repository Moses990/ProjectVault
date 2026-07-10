# Project Vault V2 Schema and API RFC

Status: Accepted; V2.1-V2.5 beta checkpoint ready
Last Updated: 2026-07-08

## 1. Purpose

This RFC freezes the first V2 data and API direction before implementation.

V2 first scope:

```text
Knowledge Platform, not Agent OS.
```

Primary rule:

```text
AI output is a draft until user approves it.
```

No approved V2 write path may bypass:

- `project.json`
- SQLite cache sync
- history record
- fixture validation

## 2. Existing Baseline

Current V1 already has:

- `projects`
- `files`
- `drawings`
- `materials`
- `ai_metadata`
- `project_tags`
- `scan_history`
- `fts_global`
- AI Provider management
- asset streaming by `file_id`

Current V1 constraints stay:

- `project.json` is source of truth.
- SQLite is rebuildable cache.
- paths stored in DB use `relative_path`.
- no direct absolute path in frontend.
- no cloud dependency.

## 3. project.json Contract

### 3.1 Versioning

V2 should not break existing V1 `project.json`.

Recommended additions:

```json
{
  "schema_version": "2.0",
  "ai": {
    "summary": "",
    "core_needs": [],
    "special_reqs": [],
    "risks": [],
    "lessons": [],
    "tags": [],
    "metadata_version": "2.0",
    "generated_at": "",
    "provider_name": "",
    "model_name": "",
    "evidence": []
  }
}
```

Compatibility rules:

- If `schema_version` is missing, treat as V1-compatible.
- If `ai` is missing, render empty knowledge state.
- If V1 keys use older names, normalize in scanner/service layer.
- Do not rewrite the whole file only to bump version.
- Write only after user approval.

### 3.2 Knowledge Fields

| Field | Type | Source | Notes |
| --- | --- | --- | --- |
| `summary` | string | approved draft/manual | project-level overview |
| `core_needs` | string[] | approved draft/manual | key requirements |
| `special_reqs` | string[] | approved draft/manual | constraints/special cases |
| `risks` | string[] | approved draft/manual | delivery/design risks |
| `lessons` | string[] | approved draft/manual | project review knowledge |
| `tags` | string[] | approved draft/manual | project tags; sync to `project_tags` |
| `evidence` | object[] | extraction/draft | source references |

### 3.3 Evidence Object

Minimal evidence:

```json
{
  "id": "ev_...",
  "field": "core_needs",
  "file_id": "file_...",
  "relative_path": "02_需求资料/brief.md",
  "excerpt": "short source excerpt",
  "note": "why this supports the field"
}
```

Rules:

- `relative_path` only, no absolute path.
- `excerpt` must be short.
- source file must belong to the same project.
- evidence can be omitted for manual entries.

## 4. SQLite Cache Direction

### 4.1 Extend Existing `ai_metadata`

Keep current read path stable.

Add columns only if implementation needs them:

```sql
ALTER TABLE ai_metadata ADD COLUMN tags TEXT;
ALTER TABLE ai_metadata ADD COLUMN evidence TEXT;
ALTER TABLE ai_metadata ADD COLUMN source_count INTEGER DEFAULT 0;
ALTER TABLE ai_metadata ADD COLUMN review_status TEXT DEFAULT 'empty';
```

Accepted `review_status`:

- `empty`
- `draft`
- `approved`
- `stale`
- `error`

### 4.2 New Table: `knowledge_sources`

Purpose:

```text
cache extracted text metadata per file
```

Draft schema:

```sql
CREATE TABLE IF NOT EXISTS knowledge_sources (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  file_id TEXT NOT NULL,
  relative_path TEXT NOT NULL,
  extractor TEXT NOT NULL,
  text_hash TEXT NOT NULL,
  text_excerpt TEXT,
  text_length INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ready',
  error_message TEXT,
  extracted_at TEXT NOT NULL,
  UNIQUE(project_id, file_id),
  FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY(file_id) REFERENCES files(id) ON DELETE CASCADE
);
```

Rules:

- store excerpt and metadata first, not full document text.
- if full extracted text is needed later, add a local cache file with size limits.
- extractor errors are cached, not thrown into UI as raw tracebacks.

### 4.3 New Table: `knowledge_drafts`

Purpose:

```text
store AI/manual draft before approval
```

Draft schema:

```sql
CREATE TABLE IF NOT EXISTS knowledge_drafts (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  draft_json TEXT NOT NULL,
  provider_name TEXT,
  model_name TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);
```

Accepted `status`:

- `draft`
- `discarded`
- `applied`
- `failed`

Rules:

- only one active draft per project in first V2.
- keep old applied draft for history.
- no draft writes to `project.json` until apply.

### 4.4 New Table: `knowledge_history`

Purpose:

```text
auditable trail for extraction/draft/apply
```

Draft schema:

```sql
CREATE TABLE IF NOT EXISTS knowledge_history (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);
```

Event types:

- `extract_text`
- `create_draft`
- `apply_draft`
- `discard_draft`
- `manual_edit`
- `sync_project_json`

### 4.5 FTS5

Extend existing FTS sync to include approved knowledge only:

- `summary`
- `core_needs`
- `special_reqs`
- `risks`
- `lessons`
- `tags`

Do not index unapproved drafts in global search.

## 5. Migration Direction

Migration target:

```text
PRAGMA user_version = 2
```

Migration rules:

- idempotent.
- no destructive migration.
- existing V1 DB opens successfully.
- deleting SQLite DB still rebuilds from `project.json`.
- corrupted `project.json` never causes DB-wide data loss.

Rollback:

- V1 code should ignore unknown `project.json.ai` fields.
- SQLite cache can be deleted and rebuilt.
- before applying knowledge to `project.json`, create local backup through existing backup strategy or project-json-specific backup.

## 6. API Shape

All responses use existing envelope:

```json
{
  "status": "success",
  "data": {},
  "message": "",
  "meta": {}
}
```

### 6.1 Get Knowledge

```text
GET /api/v1/projects/{project_id}/knowledge
```

Response:

```json
{
  "project_id": "project_...",
  "knowledge": {
    "summary": "",
    "core_needs": [],
    "special_reqs": [],
    "risks": [],
    "lessons": [],
    "tags": [],
    "evidence": []
  },
  "status": "empty",
  "draft": null,
  "updated_at": null
}
```

### 6.2 Extract Text

```text
POST /api/v1/projects/{project_id}/knowledge/extract-text
```

Request:

```json
{
  "file_ids": ["file_..."],
  "limit": 20
}
```

Response:

```json
{
  "project_id": "project_...",
  "processed": 3,
  "ready": 2,
  "failed": 1,
  "sources": []
}
```

Rules:

- file IDs only.
- reject files outside project.
- unsupported formats return controlled per-file failure.
- no OCR in first V2.

### 6.3 Create Draft

```text
POST /api/v1/projects/{project_id}/knowledge/draft
```

Request:

```json
{
  "source_ids": ["src_..."],
  "mode": "ai",
  "fields": ["summary", "core_needs", "risks", "lessons"]
}
```

Allowed `mode`:

- `manual`
- `ai`

Response:

```json
{
  "draft_id": "draft_...",
  "status": "draft",
  "draft": {}
}
```

Rules:

- if AI Provider missing, return controlled error with manual option.
- never fake AI success.
- model/provider metadata required for AI mode.

### 6.4 Apply Draft

```text
POST /api/v1/projects/{project_id}/knowledge/apply
```

Request:

```json
{
  "draft_id": "draft_...",
  "fields": ["summary", "core_needs", "risks", "lessons"],
  "confirm": true
}
```

Response:

```json
{
  "applied": true,
  "project_json_backup": "project.json.bak.20260708-120000",
  "updated_fields": ["summary", "core_needs"]
}
```

Rules:

- `confirm=true` required.
- only selected fields update.
- backup before write.
- scanner/sync refreshes SQLite and FTS.
- write history event.

### 6.5 Knowledge History

```text
GET /api/v1/projects/{project_id}/knowledge/history
```

Response:

```json
{
  "items": [
    {
      "id": "hist_...",
      "event_type": "apply_draft",
      "status": "success",
      "message": "",
      "created_at": ""
    }
  ]
}
```

## 7. Frontend Contract

### 7.1 Project Detail Knowledge Tab

States:

- empty
- extracting
- draft_ready
- approved
- stale
- error

Primary actions:

- extract text
- create draft
- edit draft
- apply selected fields
- discard draft

### 7.2 Search

Search should add `Knowledge` group only after approved knowledge is indexed.

No semantic search UI in first V2.

### 7.3 Settings / AI Center

AI Provider setup remains in AI Center.

Knowledge UI can link to AI Center when provider is missing.

## 8. Security and Safety

- no real API keys in repo.
- no raw absolute paths in API responses.
- no AI write without user approval.
- no background batch write in first V2.
- extracted text has size limits.
- evidence excerpt length capped.
- unsupported formats fail per file.
- all tests use fixtures.

## 9. Open Decisions for Confirmation

Need user confirmation before code:

1. Store approved knowledge only in `project.json`, or also export Markdown summary.
2. First extraction formats: plain text only, or include PDF/DOCX if local dependency exists.
3. Evidence excerpt policy: file reference only, or short excerpt plus reference.
4. Draft persistence: keep one active draft per project, or allow multiple drafts.
5. UI label: keep `AI` tab name, or rename to `Knowledge`.

## 10. Implementation Gate

V2.1-V2.5 implementation status:

- `project.json` contract accepted and implemented for approved draft apply.
- SQLite migration to `user_version=2` implemented for knowledge cache tables.
- Knowledge endpoints implemented: get, extract text, draft, apply.
- First extraction formats implemented: `.txt`, `.md`, `.csv`, `.json`; root `project.json` is excluded.
- Project Detail AI tab has been upgraded into Project Knowledge.
- Approved knowledge is indexed in FTS5 as `knowledge`.

Still gated:

- real AI generation
- semantic/vector search
- packaged installer release
- new extraction dependencies
- batch apply across projects
