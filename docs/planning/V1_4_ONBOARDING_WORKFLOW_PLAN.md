# Project Vault V1.4 Onboarding Workflow Plan

Status: In Progress
Last Updated: 2026-07-06

## 1. Goal

V1.4 目标：

```text
把 archive-essence-design 的初始化体验转成真实 Project Vault 工作流。
```

重点：

- first-run setup
- root path selection
- project discovery
- project initialization
- first scan
- optional AI provider setup
- optional backup setup
- dashboard readiness state

V1.4 在 V1.3 视觉对齐完成后执行。

## 2. Product Principle

Reference prototype shows a guided onboarding wizard.

Project Vault implementation must use real APIs and real local state.

No mock onboarding state.

## 3. Current Capabilities

Existing backend already supports:

- root path setting
- project candidate discovery
- project initialization
- scanner
- dashboard metrics
- projects list
- AI provider management
- backup/restore entry points
- history

Therefore V1.4 should orchestrate existing capabilities before adding new backend surface.

## 4. First-Run Definition

App is in first-run state when:

```text
root_path is missing
or root_path is invalid
or no initialized projects exist
```

App is ready when:

```text
valid root_path exists
and at least one project is initialized or user explicitly skips project initialization
```

## 5. Workflow

### Step 1: Choose Project Root

UI:

- path field
- browse/open directory action if Tauri supports it
- validation status
- explanation: local-only, no upload

Backend:

- save to Settings API
- reject invalid path

Acceptance:

- valid root path persists
- invalid path shows controlled error

### Step 2: Discover Projects

UI:

- list candidate folders
- show already initialized projects separately if useful
- allow select all / select none

Backend:

- use existing candidates API

Acceptance:

- no project is initialized before user confirmation
- candidate discovery remains shallow and fast

### Step 3: Initialize Selected Projects

UI:

- confirmation
- selected count
- progress/result summary

Backend:

- use initialize API
- write `project.json`
- do not index files until scan step

Acceptance:

- `project.json` created only for selected candidates
- initialized projects appear in Projects after scan

### Step 4: Run First Scan

UI:

- progress state if available
- final counts
- links to Dashboard / Projects

Backend:

- use scanner API
- update SQLite cache
- update FTS
- write scan history

Acceptance:

- Dashboard metrics update
- Projects list updates
- Search finds initialized project

### Step 5: Optional AI Provider Setup

UI:

- skip allowed
- provider form
- test connection

Backend:

- existing AI provider API
- no fake success

Acceptance:

- skipped AI shows warning/optional state, not failure
- configured AI uses real test result

### Step 6: Optional Backup Setup

UI:

- skip allowed
- backup location/retention if supported
- explain SQLite cache vs project files clearly

Backend:

- existing Settings / backup APIs

Acceptance:

- backup setting persists
- no project business files are modified by cache backup action

## 6. Dashboard Integration

After onboarding, Dashboard should show:

- project count
- CAD count
- material/file count
- recent projects
- favorites
- recent activity
- scanner/index status
- AI provider status
- backup status

If no projects exist:

- show onboarding entry
- show root path status
- show action to discover projects

## 7. Sidebar Integration

V1.4 may add:

- pinned/favorite projects from real favorites API
- tag filters from real tags
- root path/service status footer

Rules:

- no fake favorites
- no fake storage status
- if data not available, render empty or collapsed section

## 8. Required Frontend Changes

Likely files:

```text
frontend/app/page.tsx
frontend/app/settings/page.tsx
frontend/app/projects/page.tsx
frontend/app/components/OnboardingFlow.tsx
frontend/app/components/Sidebar.tsx
frontend/lib/api.ts
```

Possible new components:

```text
OnboardingFlow
RootPathStep
ProjectDiscoveryStep
FirstScanStep
AIProviderStep
BackupStep
SystemStatusStrip
```

## 9. Backend Changes

Prefer no backend changes.

Only add endpoints if existing data cannot support UI:

- scanner progress/status detail
- tags summary
- system readiness summary
- storage/index status

Any new endpoint must:

- be read-only unless necessary
- return existing envelope format
- bind to current local API model
- avoid absolute path exposure

## 10. Acceptance Criteria

V1.4 complete when:

- clean first-run flow works.
- user can set root path.
- user can discover candidates.
- user can initialize selected projects.
- user can scan and enter Dashboard.
- optional AI setup works or can be skipped.
- optional backup setup works or can be skipped.
- no mock data remains in onboarding.
- no V1-excluded feature appears.
- local installed usage validation updated.

## 11. Verification

Minimum:

```powershell
cd D:\Workflows\ProjectVault\backend
.venv\Scripts\python.exe -m unittest discover -s tests -v

cd D:\Workflows\ProjectVault\frontend
cmd /c npm run build
cmd /c npm run test

cd D:\Workflows\ProjectVault\desktop\src-tauri
cargo check
```

If onboarding affects packaged shell or first-run behavior:

```powershell
cd D:\Workflows\ProjectVault
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\verify_local_installed_usage.ps1
```

## 12. Out of Scope

- automatic intelligent archive beyond initial project.json generation
- agents
- RAG
- cloud backup
- multi-user onboarding
- account login
- task assignment
- online CAD preview/editing

## 13. Next Step

Execute only after V1.3 visual shell lands.

First implementation task:

```text
Create real first-run readiness check and onboarding component skeleton.
```
