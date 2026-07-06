# Project Vault Next Product Direction

Status: Draft for alignment
Last Updated: 2026-07-06

## 1. Decision

Project Vault 后续规划以 `archive-essence-design` 作为视觉和交互基线。

但执行方式不是重建 V1，也不是替换现有技术栈。

现有 Project Vault 已经具备：

- Next.js 16 frontend
- FastAPI backend
- SQLite index cache
- Tauri desktop shell
- Python sidecar
- Fixed WebView2 runtime packaging
- Clean Windows release validation
- V1.2.x feature baseline

因此下一阶段目标是：

```text
Keep current architecture.
Adopt archive-essence-design visual system.
Re-plan roadmap around the reference prototype features.
Ship incrementally.
```

## 2. Source Inputs

### 2.1 Current Product Baseline

Root:

```text
D:\Workflows\ProjectVault
```

Current facts:

- V1 core architecture already exists.
- `project.json` remains source of truth.
- SQLite remains rebuildable cache and search index.
- Backend remains local-only on loopback.
- Tauri remains final desktop release format.
- Existing release validation remains valid and must not be weakened.

### 2.2 Visual Baseline

Reference:

```text
https://github.com/Moses990/archive-essence-design.git
```

Useful parts:

- narrow dark sidebar
- top bar with breadcrumb and command search
- dense dashboard layout
- onboarding flow
- pinned projects
- tag groups
- compact tables
- segmented controls
- local storage status
- system status strip
- refined dark tokens
- low-noise Linear-like interaction model

Non-transferable parts:

- mock data
- Vite app structure
- React Router page model
- demo-only onboarding behavior
- fake storage metrics
- fake AI provider choices
- task/todo features if they drift into task management

## 3. Product Repositioning

The proposal documents should be treated as strategy material, not implementation truth.

Old framing:

```text
Build V1 from zero.
```

New framing:

```text
Upgrade current V1.2.x into a more coherent product experience.
```

Recommended naming:

```text
V1.3 Visual Baseline Alignment
V1.4 Workflow and Onboarding Alignment
V2 Knowledge Platform Preparation
V3 Agent OS Planning
```

## 4. Visual Alignment Rules

### 4.1 Must Adopt

- `archive-essence-design` as primary visual reference.
- Sidebar layout and density.
- TopBar pattern.
- Command search prominence.
- compact cards and tables.
- system status row.
- onboarding-first empty state.
- dark-first token set.

### 4.2 Must Preserve

- Project Vault current Chinese UI.
- Current Next.js route structure unless there is a strong reason to change.
- Current API contracts unless explicitly planned.
- Current Tauri release packaging.
- Current local-first security boundary.
- Current test and release validation chain.

### 4.3 Must Avoid

- landing page redesign.
- marketing dashboard.
- OA/task management drift.
- cloud-first assumptions.
- auth/multi-user design in V1.
- mobile-first layout work.
- replacing current frontend with the Vite prototype.

## 5. Feature Mapping

| archive-essence-design feature | Project Vault target | Planning decision |
| --- | --- | --- |
| Sidebar navigation | Existing Sidebar | Upgrade styling and add pinned/tag sections |
| TopBar | Missing/partial | Add global top bar with breadcrumb and command search |
| Command Palette | Existing | Improve grouping, shortcuts, result actions |
| Dashboard onboarding | Existing empty state | Convert to real first-run flow using Settings/Scanner APIs |
| Demo metrics | Existing dashboard APIs | Use real backend data only |
| Recent projects | Existing | Keep, restyle to reference density |
| Pending tasks | Not in V1 scope | Do not copy as task management |
| Storage usage | Partial/system info | Add real local storage/index status when backend supports it |
| Recent activity | Existing History | Surface history summary on dashboard |
| Pinned projects | Existing favorites | Render favorites in sidebar and dashboard |
| Tags | Existing project tags | Add tag navigation/filter entry |
| AI provider setup | Existing AI Center | Fold into onboarding as optional step |
| Backup setup | Existing Settings/Backup | Fold into onboarding as optional step |

## 6. Proposed Roadmap

### V1.3 Visual Baseline Alignment

Goal:

```text
Make current Project Vault visually match archive-essence-design without changing core architecture.
```

Scope:

- global CSS token cleanup
- Sidebar redesign
- TopBar introduction
- Dashboard density alignment
- tables, badges, cards, buttons polish
- Command Palette visual alignment
- first-run empty state polish

Exit criteria:

- all existing pages remain functional.
- production static export still works.
- Tauri packaged UI still renders.
- no API contract changes required.

Verification:

- frontend build
- frontend tests
- desktop cargo check
- packaged smoke if shell changes

### V1.4 Workflow and Onboarding Alignment

Goal:

```text
Convert reference onboarding into real Project Vault setup workflow.
```

Scope:

- first-run root path setup
- scan/init project flow
- optional AI provider setup
- optional backup setup
- dashboard system status strip
- sidebar pinned projects and tag filters
- better Settings entry points

Exit criteria:

- new user can configure root path and scan sample project without reading docs.
- no mock onboarding data remains.
- all writes go through existing backend APIs.

Verification:

- local installed usage validation
- scanner flow test
- settings persistence test
- dashboard render test

### V2 Knowledge Platform Preparation

Goal:

```text
Prepare knowledge features without breaking V1 local asset model.
```

Scope:

- project summaries as structured knowledge records
- document text extraction pipeline
- reusable requirement/risk/material fields
- semantic search design only after structured data is stable
- vector layer remains optional and local-first

Exit criteria:

- V1 data can migrate forward.
- knowledge records link back to project/file/history IDs.
- no cloud dependency.

### V3 Agent OS Planning

Goal:

```text
Plan agents after workflow, knowledge, and safety boundaries are mature.
```

Scope:

- archive agent concept
- CAD agent concept
- material agent concept
- task queue and tool permission model
- human approval boundaries

Exit criteria:

- no autonomous write action without explicit approval.
- all agent actions produce history events.
- agents operate on existing local APIs, not direct filesystem shortcuts.

## 7. Architecture Boundaries

These boundaries remain fixed:

- `project.json` is source of truth.
- SQLite is cache and search index.
- backend binds to loopback only.
- frontend uses backend APIs, not direct filesystem paths.
- files are accessed by `file_id`.
- Watcher feeds queue, not direct database writes.
- Tauri remains desktop packaging target.
- Fixed WebView2 runtime packaging remains part of release strategy.

## 8. Documentation Changes Needed

Recommended updates:

- keep existing `task_plan.md` as completed V1/V1.2 history.
- create a new execution plan for V1.3+ instead of rewriting old phases.
- move the proposal documents into `docs/planning/proposals/` if they are adopted as source references.
- write a short visual migration spec before coding V1.3.

Suggested files:

```text
docs/planning/NEXT_PRODUCT_DIRECTION.md
docs/planning/V1_3_VISUAL_ALIGNMENT_PLAN.md
docs/planning/V1_4_ONBOARDING_WORKFLOW_PLAN.md
```

## 9. Open Questions

1. Should `archive-essence-design` be copied into docs as a frozen reference snapshot, or should it remain only a GitHub reference?
2. Should the app stay dark-only for V1.3, despite current light theme support?
3. Should TopBar become mandatory on all pages, including Settings and AI Center?
4. Should pinned projects in Sidebar use existing favorites API only, or add a separate pinned model later?

## 10. Immediate Next Step

Create V1.3 visual alignment plan:

```text
1. inventory current UI against archive-essence-design
2. define component-by-component migration
3. implement CSS tokens first
4. update Sidebar
5. add TopBar
6. update Dashboard
7. verify packaged frontend
```

No backend rewrite needed for V1.3.

