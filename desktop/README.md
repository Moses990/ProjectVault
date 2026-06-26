# Desktop Shell

Project Vault desktop shell uses Tauri to load the local frontend and supervise
the Python backend process during development.

## Development check

```powershell
cd D:\Workflows\ProjectVault\desktop
npm install
npm run dev
```

The shell allocates a free backend port, starts `backend/.venv/Scripts/python.exe`
with `app.run_server`, injects `window.__BACKEND_PORT__`, and terminates the
backend process when the desktop window exits.
