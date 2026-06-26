# Project Vault Workspace Structure

This workspace is the clean development home for Project Vault.

## Folders

- `backend/`: FastAPI backend source code.
- `frontend/`: Next.js frontend source code.
- `desktop/`: Tauri desktop shell placeholder.
- `database/`: local SQLite runtime folder. Database files are ignored by Git.
- `scripts/`: helper startup and environment scripts.
- `docs/architecture/`: architecture documents `00` through `13`.
- `docs/product/`: PRD and product-scope documents.
- `docs/project-management/`: planning, findings, and progress notes.
- `prototype/`: original static prototype files from the old `web` folder.

## Local Runtime Files Not Migrated

The following environment/runtime files are intentionally excluded:

- `backend/.venv/`
- `frontend/node_modules/`
- `frontend/.next/`
- `database/*.db`
- local secret settings such as `config/local_settings.json`

## Start Development

Install dependencies after migration:

```bat
cd /d D:\Workflows\ProjectVault\backend
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
```

```bat
cd /d D:\Workflows\ProjectVault\frontend
npm install
```

Run services:

```bat
scripts\启动ProjectVault后端.bat
scripts\启动ProjectVault前端.bat
```
