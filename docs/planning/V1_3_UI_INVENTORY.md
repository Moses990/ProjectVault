# Project Vault V1.3 UI Inventory

Status: Draft
Last Updated: 2026-07-06

## 1. Purpose

本文件是 V1.3 的第一步：

```text
对照当前 Project Vault UI 与 archive-essence-design，确定后续视觉迁移顺序。
```

本阶段只做清单，不改代码。

## 2. Inputs Checked

### Current ProjectVault

Root:

```text
D:\Workflows\ProjectVault
```

Checked files:

```text
frontend/app/layout.tsx
frontend/app/globals.css
frontend/app/components/Sidebar.tsx
frontend/app/components/CommandPalette.tsx
frontend/app/page.tsx
frontend/app/projects/page.tsx
frontend/app/cad-center/page.tsx
frontend/app/history/page.tsx
frontend/app/project-detail/page.tsx
frontend/app/project-detail/tabs/*
frontend/app/settings/page.tsx
frontend/app/ai-center/page.tsx
frontend/lib/api.ts
```

Current stack:

```text
Next.js 16
React 19
plain CSS variables
lucide-react
no Tailwind runtime
no shadcn runtime
```

### Reference: archive-essence-design

Checked files:

```text
D:\Workflows\.codex-tmp\archive-essence-design\src\index.css
D:\Workflows\.codex-tmp\archive-essence-design\src\pages\Index.tsx
D:\Workflows\.codex-tmp\archive-essence-design\src\components\vault\Sidebar.tsx
D:\Workflows\.codex-tmp\archive-essence-design\src\components\vault\TopBar.tsx
D:\Workflows\.codex-tmp\archive-essence-design\src\components\vault\CommandPalette.tsx
D:\Workflows\.codex-tmp\archive-essence-design\src\components\vault\views\Dashboard.tsx
```

Reference stack:

```text
Vite
React 18
Tailwind
shadcn-style components
mock data
React Router-style local view switching
```

## 3. Key Constraint

Do not copy the reference app structure.

Reason:

```text
ProjectVault is a real Next/Tauri product.
archive-essence-design is a Vite mock prototype.
```

Allowed:

- copy visual direction
- copy layout intent
- copy density rules
- copy interaction patterns

Forbidden:

- copy mock data
- copy Vite routing model
- add Tailwind/shadcn just for visual parity
- add task/todo features
- add fake user/team/notification features

## 4. Current vs Reference Summary

| Area | Current ProjectVault | archive-essence-design | Gap |
| --- | --- | --- | --- |
| App shell | Sidebar + main only | Sidebar + TopBar + content | Need global TopBar |
| Sidebar | Basic nav, search, status | Workspace switcher, nav, pinned projects, tags, storage/status | Need real favorites/tags sections |
| TopBar | Missing | Breadcrumb, command search, compact actions | Add real TopBar |
| Dashboard | Metrics, favorites, recent projects, empty state | Onboarding, metrics, quick actions, recent activity, status strip, storage | Recompose using real data |
| Command Palette | Functional search grouped by entity | More prominent shell search and shortcut surface | Keep backend, polish UI |
| Tables | Compact enough, mixed styles | Dense tables and row-hover system | Normalize table/panel style |
| Cards | Many inline styles | Component/token-driven cards | Remove inline style drift gradually |
| Tokens | CSS vars exist, light theme exists | HSL token set, dark-only baseline | Token pass needed, no new dependency |
| Empty states | Basic onboarding copy | Grid-backed guided onboarding | V1.3 visual polish; V1.4 real wizard |
| Icons | Some manual SVG, lucide installed | lucide icons | Replace manual SVG over time |

## 5. Detailed Inventory

### 5.1 App Shell

Current:

```text
frontend/app/layout.tsx
```

Current structure:

```text
<div className="app-shell">
  <Sidebar />
  <main className="main">{children}</main>
</div>
<CommandPalette />
```

Reference structure:

```text
Sidebar
TopBar
Scrollable main content
CommandPalette
```

Finding:

```text
TopBar is the largest missing shell element.
```

V1.3 action:

- add `frontend/app/components/TopBar.tsx`
- change shell to Sidebar + right column
- keep existing `CommandPalette` state in layout
- derive title/breadcrumb from pathname

Do not add:

- fake notifications
- fake user avatar
- fake help center

### 5.2 Sidebar

Current:

```text
frontend/app/components/Sidebar.tsx
```

Current capabilities:

- brand
- search trigger
- primary nav
- tool nav
- service status footer

Reference capabilities:

- workspace switcher visual
- compact nav row height
- active dot
- pinned projects
- tag groups
- storage/status footer

Gap:

- no pinned/favorite project section
- no tag section
- no real workspace/root-path context
- manual SVG icons instead of lucide components

V1.3 action:

- keep route links
- replace manual SVG with lucide icons
- add favorites section using existing favorite projects data if feasible in client layout
- add tag section only if tags can be sourced without new backend work
- keep collapsed/empty section when no data

Ponytail decision:

```text
Use existing favorites API first. Add tag endpoint only when UI cannot read tags from existing project data.
```

### 5.3 TopBar

Current:

```text
No global TopBar.
Page headers repeat inside pages.
```

Reference:

- 44px top bar
- breadcrumb or page label
- command search button
- compact right-side action area

V1.3 action:

- add TopBar globally
- title map from route
- Project Detail breadcrumb uses current query/project name if cheap; otherwise use generic "项目详情" first
- search button opens existing Command Palette

Skip for V1.3:

- user account avatar
- notifications
- help center actions

Add later:

- real health indicator
- real root path indicator

### 5.4 Dashboard

Current:

```text
frontend/app/page.tsx
```

Current data:

- dashboard metrics
- recent projects
- favorite projects
- retry on backend startup race
- first-run empty state

Reference layout:

- onboarding wizard
- metric row
- quick actions
- recent projects table
- recent activity
- storage/status card
- system status strip

Gap:

- no top-level quick action cluster
- no recent activity panel
- no system status strip
- favorites shown as separate card, not integrated into sidebar/dashboard rhythm
- inline styles heavy
- onboarding is a simple empty state, not a guided flow

V1.3 action:

- keep real API calls
- keep retry logic
- recompose layout into dense reference pattern
- add recent activity only from existing History API if cheap
- add status strip using existing health/settings/scanner status if cheap
- move full wizard to V1.4

Do not copy:

- demo task list
- fake storage usage
- fake team online count
- fake date/status copy

### 5.5 Command Palette

Current:

```text
frontend/app/components/CommandPalette.tsx
```

Current capabilities:

- Ctrl+K open
- debounced backend search
- entity grouping
- keyboard navigation
- route to project/detail tabs

Reference:

- more integrated shell search trigger
- tighter command item style
- shortcut visual language

Gap:

- no shortcut footer/hints
- selected state basic
- project id shown as raw suffix
- no action text per entity

V1.3 action:

- keep existing logic
- improve item layout
- add subtle shortcut/empty state copy
- keep search API unchanged

### 5.6 Projects Page

Current:

```text
frontend/app/projects/page.tsx
```

Current capabilities:

- list/card segmented control
- search
- type and phase filters
- sorting
- favorite toggle
- pagination

Gap:

- toolbar and table use mixed inline styles
- card view exists but should be secondary
- table row density acceptable but needs shared panel style

V1.3 action:

- keep list as default
- normalize toolbar/table styles
- align segmented control with reference
- preserve filters and pagination

### 5.7 Project Detail

Current:

```text
frontend/app/project-detail/page.tsx
frontend/app/project-detail/tabs/*
```

Current capabilities:

- Overview
- Files
- Drawings
- Materials
- AI
- History
- scan action
- URL `tab` parameter
- file preview/tree in Files tab

Gap:

- page-level header should move into TopBar/breadcrumb pattern
- tabs are OK but need tighter reference spacing
- FilesTab has many inline styles
- AI tab has many inline styles

V1.3 action:

- keep tabs
- make TopBar show breadcrumb
- normalize cards/tables/actions inside tabs only after shell pass

### 5.8 CAD Center

Current:

```text
frontend/app/cad-center/page.tsx
```

Current capabilities:

- CAD list
- filters/segments
- version side panel
- open/reveal/export actions

Gap:

- already close to reference density
- should mainly receive token/table/action normalization

V1.3 action:

- lowest-risk polish after shell/dashboard

### 5.9 History

Current:

```text
frontend/app/history/page.tsx
```

Current capabilities:

- history table
- status badges
- pagination

Reference intent:

- recent activity appears on Dashboard
- full History remains searchable/dense

Gap:

- no dashboard summary extraction
- full page is table-first, not timeline-first

V1.3 action:

- keep full table
- optionally show recent activity summary on Dashboard using existing endpoint
- timeline redesign is not required for V1.3

### 5.10 Settings and AI Center

Current:

```text
frontend/app/settings/page.tsx
frontend/app/ai-center/page.tsx
```

Current capabilities:

- root path
- scan interval
- auto scan
- backup retention
- theme
- maintenance
- backup/restore
- AI provider management

Gap:

- many inline styles
- settings grid OK but should use same panel rhythm
- V1.4 onboarding should reuse these backend actions

V1.3 action:

- only visual polish
- no workflow expansion yet

## 6. Token Inventory

Current CSS already has:

- `--bg`
- `--bg-elev`
- `--bg-sidebar`
- `--border`
- `--text`
- `--accent`
- semantic status colors
- radius scale
- shadows
- table styles
- command palette styles

Reference CSS has:

- HSL token system
- Tailwind utility classes
- surface aliases
- hairline border helper
- focus-ring helper
- kbd helper
- grid background helper

V1.3 token pass should:

- keep plain CSS variable approach
- add missing helpers only when used immediately
- avoid adding Tailwind
- avoid one-to-one HSL conversion unless it improves maintainability
- preserve current static export compatibility

## 7. Direct Migration Candidates

Use these patterns from reference:

| Reference pattern | Destination |
| --- | --- |
| TopBar search button | `TopBar.tsx` |
| Sidebar pinned projects visual | `Sidebar.tsx` favorites section |
| Sidebar tags visual | `Sidebar.tsx` tags section if data exists |
| Dashboard metric card density | `page.tsx` metric section |
| Dashboard quick actions | `page.tsx`, real actions only |
| Recent activity panel | `page.tsx`, History API only |
| System status strip | `page.tsx`, real health/settings/scanner only |
| Grid empty background | `empty-state` / onboarding sections |
| kbd helper | Sidebar/TopBar/CommandPalette |

## 8. Do Not Migrate

Do not migrate:

- `initialTasks`
- fake team/member online status
- fake storage GB values
- fake project rows
- fake onboarding completion state
- React Router local view switching
- Tailwind-only class system
- shadcn component dependency tree
- notification bell unless backed by real event data
- user avatar/account UI

## 9. Recommended Implementation Order

### Step 2: CSS Token Pass

Target:

```text
frontend/app/globals.css
```

Minimal changes:

- add/adjust helper classes needed for TopBar
- add `grid-bg` if not enough for onboarding
- normalize panel/card/table spacing
- avoid broad rewrite

### Step 3: TopBar

Target:

```text
frontend/app/components/TopBar.tsx
frontend/app/layout.tsx
```

Minimal version:

- route title
- Project Detail breadcrumb placeholder
- command search trigger

No right-side fake controls.

### Step 4: Sidebar

Target:

```text
frontend/app/components/Sidebar.tsx
```

Minimal version:

- lucide icons
- favorites section from real API or empty state
- tags section only if data already available
- service status footer

### Step 5: Dashboard

Target:

```text
frontend/app/page.tsx
```

Minimal version:

- keep current API load
- dense metric cards
- recent projects table
- favorites panel
- quick actions
- optional real recent activity
- no tasks

### Step 6: Page Polish

Targets:

```text
frontend/app/projects/page.tsx
frontend/app/cad-center/page.tsx
frontend/app/history/page.tsx
frontend/app/project-detail/page.tsx
frontend/app/project-detail/tabs/*
frontend/app/settings/page.tsx
frontend/app/ai-center/page.tsx
```

Do after shell and Dashboard.

## 10. Verification Plan

After UI code starts:

```powershell
cd D:\Workflows\ProjectVault\frontend
cmd /c npm run build
cmd /c npm run test

cd D:\Workflows\ProjectVault\desktop\src-tauri
cargo check
```

If layout shell or static export behavior changes:

```powershell
cd D:\Workflows\ProjectVault\desktop
cmd /c npm run check
```

Visual verification:

- 1920x1080
- 1366x768
- Dashboard
- Projects
- Project Detail
- CAD Center
- History
- AI Center
- Settings
- Command Palette

## 11. Final Recommendation

Start implementation with:

```text
CSS token/helper pass + TopBar shell.
```

Reason:

```text
TopBar changes page hierarchy and affects every page.
Dashboard and Sidebar should be adjusted after shell is fixed.
```

