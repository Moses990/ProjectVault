# Project Vault V2 Beta Acceptance Checkpoint

Status: accepted
Date: 2026-07-10

## Scope

This checkpoint freezes V2.1 through V2.7 as the first beta acceptance node.

Included:

- V2.1 Knowledge Read Model
- V2.2 Text Extraction Foundation
- V2.3 Knowledge Draft Store
- V2.4 Apply Approved Knowledge
- V2.5 Knowledge Search
- V2.6 Semantic Search Spike (`defer_vector_dependency`)
- V2.7 Real AI Draft Generation

Not included:

- Agent / RAG / semantic search
- vector dependency
- batch apply across projects
- Dashboard knowledge coverage metric

## Accepted Behavior

- Project Detail shows project knowledge from approved metadata.
- Text extraction uses file IDs and controlled format failures.
- One active draft per project is stored in SQLite.
- Drafts do not enter global search before approval.
- Applying a draft requires explicit confirmation.
- Applying a draft creates `project.json.bak.<timestamp>` before write.
- Applying a draft syncs `project.json` back into SQLite and FTS5.
- Approved knowledge is searchable through `category=knowledge`.
- Root `project.json` is excluded from extraction to avoid metadata feedback.
- AI generation calls the configured OpenAI-compatible Provider and stores only a draft.
- AI generation records provider and model metadata; it cannot bypass explicit apply confirmation.

## Safety Gates

- `project.json` remains the source of truth.
- SQLite remains a rebuildable cache.
- No absolute local paths are exposed to the frontend.
- No AI output writes business data without user approval.
- All write-path validation uses fixtures only.
- Any installer release still needs separate release-grade validation.

## Evidence

Latest V2.4/V2.5 fixture:

```text
release-validation/v2_4_2_5_apply_search-20260708-164410/
```

Chrome smoke report:

```text
release-validation/v2_4_2_5_apply_search-20260708-164410/browser-smoke-report.json
```

Observed smoke result:

- apply confirmation shown
- apply success message shown
- Dashboard metrics: 1 project, 1 CAD, 2 materials
- Knowledge search returned `knowledge`
- applied summary did not contain `project_id`

Packaged local installed validation snapshot:

```text
release-validation/local-installed-usage-validation.json
```

Latest V2.7 packaged result:

- `passed=true`
- 33 validation steps passed
- installer SHA256: `FCA20A8EBFDF08C6F2C6C5216F00355E6C55546ECD259E85D9A501E819AA668F`
- local report SHA256: `84E1FBD6FBC7001DCFFC87ADD5871ECFCCBA0E092DBEACE780C008CC18238BDB`
- V2 AI packaged steps passed: file indexed, text extracted, AI draft created, explicit apply backed up `project.json`, knowledge search returned approved knowledge.
- clean Windows validation: `passed=true`, 15 steps passed, report SHA256 `C460E8C723B1B15B39CFC931E919F12980E2654677D728CEE501A30E487FE1F0`.
- GitHub Actions CI run 3 passed for PR #2.

## Validation Commands

```powershell
cd D:\Workflows\ProjectVault\backend
.venv\Scripts\python.exe -m unittest discover -s tests -v

cd D:\Workflows\ProjectVault\frontend
cmd /c npm run test
cmd /c npm run build

cd D:\Workflows\ProjectVault
rg -n 'style=\{\{|style="' frontend/app
git diff --check
git ls-files release-validation | rg '(\.db$|/backups/|/root/|/fixture-root/|/paths\.txt$)'
```

## Beta Decision

V2.1-V2.7 are an accepted beta node. Local packaged validation, clean Windows validation, CI, and final fixture-based human acceptance passed. This does not authorize Agent/RAG, vector dependency, batch apply, or a production semantic-search feature.

Next decision:

```text
Choose a separately confirmed V2 follow-up: real Provider credential rollout, batch apply, PDF/DOCX extraction, or production query expansion.
```
