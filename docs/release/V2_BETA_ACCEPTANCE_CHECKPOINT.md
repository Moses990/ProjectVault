# Project Vault V2 Beta Acceptance Checkpoint

Status: local_packaged_validation_passed
Date: 2026-07-08

## Scope

This checkpoint freezes V2.1 through V2.5 as the first beta acceptance node.

Included:

- V2.1 Knowledge Read Model
- V2.2 Text Extraction Foundation
- V2.3 Knowledge Draft Store
- V2.4 Apply Approved Knowledge
- V2.5 Knowledge Search

Not included:

- packaged installer release claim
- clean Windows validation for the latest installer
- real AI generation
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

Observed latest packaged result:

- `passed=true`
- 32 validation steps passed
- installer SHA256: `9099FA65EA69A0A030DADB0955339637CE7411C5E682E16B66FCCEC96FE4EB41`
- report SHA256: `66F3FE90727FAEFF3C97E6D6D54F7E196FF24620D87EFC37AFDC684B54325AAF`
- V2 packaged steps passed: knowledge file indexed, text extracted, draft created, draft applied, knowledge search returned approved knowledge
- Next checkpoint installer path: `desktop/src-tauri/target/release/bundle/nsis/Project Vault_2.0.0-beta.1_x64-setup.exe`.
- The validation script now retries locked install-directory cleanup and stops only Project Vault/WebView2 processes under the validation install root.

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

V2.1-V2.5 can be treated as the first V2 beta acceptance node, with latest local installed packaged validation passed. This is still not a clean Windows release claim.

Next decision:

```text
Either run clean Windows validation for release-grade proof, or plan the first real AI generation path.
```
