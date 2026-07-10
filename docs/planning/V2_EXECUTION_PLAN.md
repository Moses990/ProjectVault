# Project Vault V2 Execution Plan

Status: Accepted; V2.7 real AI draft generation in progress
Last Updated: 2026-07-08

## 1. Goal

Ship V2 as a controlled Knowledge Platform upgrade.

Do not ship V2 as:

- Agent OS
- full RAG chatbot
- cloud sync
- collaboration system
- task/OA platform

## 2. Planning Package

V2 planning package:

| File | Purpose |
| --- | --- |
| `V2_KNOWLEDGE_PLATFORM_PLAN.md` | product direction and scope |
| `V2_SCHEMA_API_RFC.md` | data/API contract |
| `V2_EXECUTION_PLAN.md` | milestones, validation, confirmation gates |

User confirmed this package on 2026-07-08. V2.1 through V2.5 are complete and frozen as the first beta acceptance checkpoint. V2.6 is complete as a semantic-search spike, with vector dependency deferred.

Beta checkpoint:

| File | Purpose |
| --- | --- |
| `../release/V2_BETA_ACCEPTANCE_CHECKPOINT.md` | V2.1-V2.5 accepted behavior, exclusions, evidence, and next decision |

## 3. Milestones

### Milestone V2.0: Planning Freeze

Status: complete

Deliverables:

- product scope accepted
- schema/API RFC accepted
- execution plan accepted
- open decisions resolved

No code changes.

Exit criteria:

- user confirms V2 scope.
- `task_plan.md` and `progress.md` updated.
- no unreviewed schema/API ambiguity remains.

### Milestone V2.1: Knowledge Read Model

Goal:

Turn existing AI metadata into a real Knowledge surface.

Scope:

- reuse existing `ai_metadata`
- Project Detail `AI` tab becomes Knowledge-ready view
- no AI generation
- no schema migration unless unavoidable

Files likely touched:

- `frontend/app/project-detail/AiTab.tsx`
- `frontend/app/globals.css`
- `frontend/lib/api.ts`

Backend:

- prefer none
- keep existing `/projects/{id}/ai-metadata`

Validation:

- frontend build
- frontend test
- fixture project with current `ai` fields
- browser smoke on Project Detail

Gate:

- no write path yet.

Status:

- complete.
- user accepted the V2.1 manual browser review on 2026-07-08.

### Milestone V2.2: Text Extraction Foundation

Goal:

Extract safe text from selected project files.

Scope:

- file IDs only
- fixture files only for tests
- text size caps
- per-file extraction status
- no OCR
- no CAD parsing

Initial formats:

- `.txt`
- `.md`
- `.csv`
- `.json`
- `.docx` deferred unless an existing dependency is explicitly confirmed
- `.pdf` unsupported in this pass; no new PDF dependency

Backend likely touched:

- `backend/app/api/knowledge.py`
- `backend/app/knowledge/service.py`
- `backend/tests/test_knowledge_api.py`

Validation:

- backend unittest
- unsupported format error test
- path boundary test
- no absolute path response

Gate:

- extraction cannot write `project.json`.

Status:

- complete.
- implementation extracts capped excerpts through file IDs only.
- unsupported formats return per-file `unsupported_format`.
- API/browser validation confirmed no absolute path is returned to the frontend.
- user accepted the V2.2 browser review on 2026-07-08.

### Milestone V2.3: Knowledge Draft Store

Goal:

Create and store draft knowledge.

Scope:

- one active draft per project
- manual draft path
- AI draft path only through configured Provider
- provider/model metadata
- draft history

Backend likely touched:

- database migration
- `knowledge_drafts`
- `knowledge_history`
- provider call wrapper reuse

Frontend likely touched:

- draft review panel
- field diff preview deferred to V2.4 apply flow

Validation:

- backend unittest
- AI provider missing path
- failed draft leaves approved data unchanged
- browser smoke on Project Detail Knowledge tab

Gate:

- draft cannot auto-apply.

Status:

- complete.
- one active manual draft per project is stored in SQLite.
- approved `ai_metadata` remains unchanged.
- AI draft mode is gated: missing provider returns `ai_provider_required`; actual AI generation remains unimplemented until the first AI generation confirmation gate.
- user accepted the V2.3 browser review on 2026-07-08.

### Milestone V2.4: Apply Approved Knowledge

Goal:

Apply approved fields to `project.json`.

Scope:

- explicit confirm
- selected field apply
- project.json backup
- SQLite sync
- FTS refresh
- history event

Backend likely touched:

- project JSON writer helper
- scanner/FTS sync reuse
- apply endpoint

Validation:

- fixture project apply test
- backup exists
- repeat apply idempotent
- broken project.json rejected
- search finds approved knowledge

Gate:

- no batch apply across projects in first pass.

Status:

- complete.
- apply endpoint requires explicit `confirm=true`.
- `project.json` is backed up before write.
- apply reuses scanner sync, refreshing SQLite cache and FTS5.
- `knowledge_history` records `apply_draft`.
- root `project.json` is excluded from extraction to avoid feeding business metadata back into draft summaries.
- user accepted the V2.4 browser review on 2026-07-08.

### Milestone V2.5: Knowledge Search and Coverage

Goal:

Expose approved knowledge globally.

Scope:

- add Knowledge result group
- index approved knowledge in FTS5
- Dashboard/Knowledge coverage metric
- no vector dependency

Frontend likely touched:

- command/search result grouping
- dashboard coverage strip if useful

Validation:

- FTS search tests
- frontend build/test
- browser smoke

Gate:

- semantic search still out.

Status:

- complete.
- approved knowledge is indexed as `knowledge` in FTS5.
- `/search?category=knowledge` returns approved knowledge results.
- Dashboard coverage metric is deferred; no new schema or vector dependency was added.
- user accepted the V2.5 browser review on 2026-07-08.

### Milestone V2.6: Local Semantic Search Spike

Goal:

Evaluate if vector search is worth shipping.

Scope:

- spike only
- no production dependency by default
- compare against FTS5
- use fixture data

Deliverable:

- keep/drop decision doc

Gate:

- user confirms before any vector dependency lands.

Status:

- complete.
- fixture report: `release-validation/v2_6_semantic_search_spike-20260708-181223/semantic-search-spike-report.json`.
- FTS5 Knowledge search hit 3 / 6 total cases and 1 / 4 near-meaning cases.
- zero-dependency alias proxy hit 6 / 6 total cases and 4 / 4 near-meaning cases.
- decision: `defer_vector_dependency`; keep FTS5, consider tiny alias/query expansion only after real miss-query samples, and do not add a vector dependency without separate confirmation.

### Milestone V2.7: Real AI Draft Generation

Goal:

Generate project knowledge drafts through the configured OpenAI-compatible Provider without bypassing review.

Scope:

- reuse extracted source excerpts
- reuse existing Provider URL, model, and key storage
- store provider/model metadata on the draft
- keep one active draft per project
- require existing explicit apply confirmation before `project.json` write
- no new dependency or schema migration

Status:

- in_progress.
- user confirmed implementation together with beta checkpoint, automated review/test, and installer validation.

Exit criteria:

- AI mode produces a stored draft from fixture sources through a mocked Provider response.
- failed Provider calls leave approved knowledge unchanged.
- frontend exposes AI draft generation after text extraction.
- direct legacy AI analysis cannot bypass the draft/apply gate.
- automated tests, packaged validation, and final human acceptance pass.

## 4. Confirmation Gates

User confirmation required at:

1. planning freeze
2. first schema migration
3. first `project.json` write implementation
4. first AI generation implementation
5. any new dependency for PDF/DOCX/vector search
6. any packaged installer release

## 5. Validation Rules

Default checks:

```powershell
cd D:\Workflows\ProjectVault\backend
.venv\Scripts\python.exe -m unittest discover -s tests -v

cd D:\Workflows\ProjectVault\frontend
cmd /c npm run build
cmd /c npm run test
```

If desktop or static export changes:

```powershell
cd D:\Workflows\ProjectVault\desktop\src-tauri
cargo check
```

Before release:

- local installed usage validation
- clean Windows validation if installer changes
- release-validation hygiene check

## 6. Fixture Strategy

Create dedicated V2 fixtures under:

```text
release-validation/v2-knowledge-<timestamp>/
```

Fixture content:

- one project with existing `project.json`
- `02_需求资料/brief.md`
- `02_需求资料/requirements.txt`
- `06_材料资料/materials.csv`
- unsupported file sample

Never use real project資料 for extraction/write tests.

## 7. Release Strategy

V2 should ship in small tags:

- `v2.0.0-alpha.1`: Knowledge read model
- `v2.0.0-alpha.2`: extraction foundation
- `v2.0.0-beta.1`: draft/apply flow
- `v2.0.0`: approved knowledge + search

No public V2 release until:

- CI passes
- local installed validation passes
- `project.json` write rollback tested
- user confirms installer behavior

Current beta checkpoint:

- `V2.1-V2.5` can be treated as `v2.0.0-beta.1` scope.
- Latest local installed packaged validation passed on installer SHA256 `9099FA65EA69A0A030DADB0955339637CE7411C5E682E16B66FCCEC96FE4EB41`.
- This is still not a clean Windows release claim.
- Release-grade packaging still requires clean Windows validation if the beta is promoted to an installer release.

## 8. Cut Lines

If scope grows, cut in this order:

1. semantic search
2. Dashboard knowledge coverage
3. PDF extraction
4. DOCX extraction
5. field-level regenerate
6. global Knowledge Center

Do not cut:

- user approval before write
- backup before `project.json` apply
- fixture validation
- history event
- no absolute path exposure

## 9. Remaining Decisions

Still require separate confirmation:

1. Real AI generation path.
2. Semantic/vector search dependency. V2.6 says defer vector dependency for now.
3. Packaged installer release for this beta checkpoint.
4. Batch apply across projects.
5. Export approved knowledge to Markdown.
