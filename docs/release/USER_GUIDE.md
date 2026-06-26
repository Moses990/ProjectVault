# Project Vault V1 User Guide

Status: V1 Final guide

## What Project Vault Does

Project Vault indexes local project folders that contain `project.json`. It helps browse projects, search files, review CAD drawings, inspect materials, manage AI provider configuration references, and run local maintenance tasks.

## What V1 Does Not Do

V1 does not provide AI chat, Agent workflows, RAG, cloud sync, permissions, online CAD viewing, online file editing, OA, reimbursement, or task management.

## Development Startup

Backend:

```powershell
cd D:\Workflows\ProjectVault\backend
.venv\Scripts\python.exe -m app.run_server --host 127.0.0.1 --port 8000
```

Frontend:

```powershell
cd D:\Workflows\ProjectVault\frontend
cmd /c npm run dev
```

Desktop shell:

```powershell
cd D:\Workflows\ProjectVault\desktop
cmd /c npm run dev
```

## First Use

1. Open Settings.
2. Set the project root path.
3. Use project discovery or initialize a project folder with `project.json`.
4. Run scan or rescan after project files change.
5. Use Dashboard, Projects, Project Detail, Search, CAD Center, History, Settings, and AI Center from the sidebar.

## File Access

Open and reveal actions are controlled by `file_id`. The frontend must not send local absolute paths. The backend resolves `projects.project_path + files.relative_path` and rejects missing or out-of-root files.

## Search

Use the command palette or Search API to find projects, files, CAD drawings, and materials. RC validation measured `2.869 ms` search latency on a temporary 100k-file fixture.

## Backup And Restore

Settings provides maintenance, backup, and restore entry points. Backup and restore only operate on the SQLite index cache. They do not modify source project folders or `project.json`.

## Known V1 Notes

- Manual project rescan performs full project reconciliation unless a caller supplies known changed paths.
- Watcher currently validates event capture and debounce queue behavior; a production background consumer loop is not yet wired as an always-on sync worker.
- The final release installer uses a bundled PyInstaller sidecar and fixed WebView2 runtime. It has passed clean Windows validation without Python or Node installed.
