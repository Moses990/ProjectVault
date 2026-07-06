# Project Vault V1.3 Visual Alignment Plan

Status: In Progress
Last Updated: 2026-07-06

## 1. Goal

V1.3 目标：

```text
以 archive-essence-design 为视觉基线，重塑现有 Project Vault UI。
```

本阶段只做视觉、布局、导航和交互密度升级。

不改：

- backend architecture
- database source-of-truth model
- Tauri release model
- API contracts unless unavoidable
- scanner / watcher / AI provider core logic

## 2. Reference Baseline

Reference repo:

```text
https://github.com/Moses990/archive-essence-design.git
```

Reference implementation traits:

- Vite + React prototype
- shadcn-style component set
- narrow dark sidebar
- global top bar
- command search as primary entry
- dense dashboard
- compact tables
- pinned projects
- tag navigation
- system status strip
- subtle grid background

Only the product experience and visual system are imported.

The Vite app structure and mock data are not imported.

## 3. Current Project Baseline

Current frontend:

```text
frontend/app
frontend/app/components
frontend/app/globals.css
frontend/lib/api.ts
```

Current pages:

- Dashboard
- Projects
- Project Detail
- CAD Center
- History
- AI Center
- Settings

Current shell:

- Sidebar exists
- Command Palette exists
- TopBar does not exist as a global shell component
- Dashboard exists but should be rebalanced against reference layout

## 4. Scope

### 4.1 Global Design Tokens

Update:

- background layers
- sidebar background
- border hierarchy
- text hierarchy
- accent color
- status colors
- radius scale
- shadow scale
- compact table tokens
- command palette tokens

Constraints:

- keep CSS variable model
- keep dark-first
- do not introduce one-off colors inside pages when token exists

### 4.2 App Shell

Add global shell structure:

```text
Sidebar
TopBar
MainContent
CommandPalette
```

TopBar must include:

- current page title or breadcrumb
- command search trigger
- optional status/help/actions area

Rules:

- TopBar appears on all main pages.
- Project Detail uses breadcrumb.
- Search trigger opens existing Command Palette.
- No fake notification or user account system unless backed by real product need.

### 4.3 Sidebar

Upgrade Sidebar to reference density.

Must include:

- Project Vault brand
- primary nav
- secondary/tool nav
- search trigger or top search coordination
- favorites/pinned projects section
- tag filter section
- local service status footer

Data rules:

- favorites use existing favorite projects API.
- tags use existing project tags if available.
- if data is unavailable, section can render empty state, not fake data.

### 4.4 Dashboard

Rebuild Dashboard layout around reference:

```text
metrics
recent projects
recent activity
quick actions
storage/system status
first-run onboarding entry
```

Allowed:

- real metrics from backend
- favorites
- history summary
- scanner status
- AI provider status
- backup status

Forbidden:

- task/todo system copied from prototype
- fake team online count
- fake storage data
- mock project rows

### 4.5 Tables and Lists

Align:

- Projects table
- CAD Center table
- History timeline/list
- Project Detail file/drawing/material lists

Rules:

- row height compact
- headers small uppercase or consistent Chinese equivalent
- hover states subtle
- badges use token variants
- actions use icons plus clear labels where needed
- no oversized cards as default list view

### 4.6 Command Palette

Improve:

- result grouping
- shortcut hints
- visual density
- empty state
- action labels

Keep:

- Ctrl+K
- current backend search API
- route mapping

### 4.7 Empty and Loading States

Adopt reference style:

- grid background for empty onboarding states
- compact skeleton/spinner use
- clear first action

Rules:

- no marketing hero
- no generic welcome copy beyond onboarding needs

## 5. Implementation Order

### Step 1: Visual Inventory

Compare current UI and reference UI:

- CSS tokens
- shell layout
- Sidebar
- Dashboard
- tables
- Command Palette

Deliverable:

```text
docs/planning/V1_3_UI_INVENTORY.md
```

### Step 2: Token Pass

Edit:

```text
frontend/app/globals.css
```

Validation:

- frontend build
- quick page smoke

### Step 3: App Shell and TopBar

Add:

```text
frontend/app/components/TopBar.tsx
```

Update:

```text
frontend/app/layout.tsx
frontend/app/components/Sidebar.tsx
```

Validation:

- route navigation
- Ctrl+K
- Project Detail breadcrumb

### Step 4: Sidebar Data Integration

Add real sections:

- favorites
- tags
- service status

Backend changes:

- avoid if existing APIs are enough
- add read-only endpoint only if required

Validation:

- favorites appear
- empty state works
- no mock data

### Step 5: Dashboard Recomposition

Update:

```text
frontend/app/page.tsx
```

Use:

- dashboard metrics
- recent projects
- favorite projects
- history summary if available
- scanner/settings status if available

Validation:

- new user empty state
- configured user dashboard
- backend retry behavior still works

### Step 6: Page Polish

Update:

- Projects
- CAD Center
- History
- AI Center
- Settings
- Project Detail tabs

Validation:

- no layout overlap
- table density preserved
- actions still call same APIs

### Step 7: Package Verification

Run:

```powershell
cd D:\Workflows\ProjectVault\frontend
cmd /c npm run build

cd D:\Workflows\ProjectVault\desktop\src-tauri
cargo check
```

If shell/static export changes:

```powershell
cd D:\Workflows\ProjectVault\desktop
cmd /c npm run check
```

## 6. Acceptance Criteria

V1.3 complete when:

- UI visually aligns with `archive-essence-design`.
- all existing pages still work.
- Dashboard uses real data only.
- Sidebar includes real favorites or clean empty state.
- TopBar exists globally.
- Command Palette remains functional.
- no V1-excluded feature is introduced.
- frontend build passes.
- frontend tests pass where applicable.
- Tauri check passes.

## 7. Risks

### Risk: Prototype mock behavior leaks into product

Mitigation:

```text
No fake rows, fake storage, fake team status, fake task system.
```

### Risk: Shell changes break static export

Mitigation:

```text
Verify Next static export and Tauri frontend server after shell changes.
```

### Risk: Styling creates unreadable dense UI

Mitigation:

```text
Check 1366x768 and 1920x1080.
```

### Risk: Visual scope expands into product redesign

Mitigation:

```text
V1.3 is visual alignment only. Workflow changes go to V1.4.
```

## 8. Out of Scope

- real task management
- team presence
- cloud sync
- account/user system
- mobile layout
- online CAD editing
- AI chat interface
- agent workflow

## 9. Next Step

Continue with Sidebar real data sections: favorites first, tags only if existing project data is enough.
