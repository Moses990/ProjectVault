# Project Vault V1 RC Checklist

Date: 2026-06-25
Status: Development RC validation passed; final clean Windows validation passed on 2026-07-07

## Scope

This checklist covers the V1 release candidate gate. It validates the local-first desktop product surface without adding V2 features such as AI chat, Agent, RAG, cloud sync, permissions, or online CAD editing.

## Best Solution

The target release shape is a Tauri desktop app with a bundled FastAPI sidecar executable, SQLite as rebuildable index cache, controlled file operations through `file_id`, and automated RC checks that run against temporary fixture projects rather than real user data.

## Current Limitation

The development RC path is validated, and the production sidecar packaging chain exists:

- `scripts/build_backend_sidecar.ps1` builds the FastAPI backend with PyInstaller.
- `desktop/src-tauri/tauri.conf.json` declares `bundle.externalBin: ["binaries/project-vault-backend"]`.
- `desktop/src-tauri/src/main.rs` starts the Tauri sidecar and no longer launches `backend/.venv/Scripts/python.exe`.
- The generated sidecar responds to `/api/v1/health` and stores the default SQLite cache under `%LOCALAPPDATA%\ProjectVault\database\project_vault.db`.

The former release limitation is closed: the installer was installed and started in Windows Sandbox without Python or Node, and `release-validation/clean-windows-validation.json` reports `passed=true`.

## Recommended Upgrade Path

Before rebuilding a future V1 final installer:

1. Run `scripts\build_backend_sidecar.ps1 -Clean` on the release machine.
2. Run `cd desktop && cmd /c npm run check` or the release build command.
3. Install the generated NSIS installer on a clean Windows 10/11 machine without Python or Node.
4. Validate startup, `/api/v1/health`, dynamic backend port injection, app exit process cleanup, and first-run database creation under `%LOCALAPPDATA%`.

## Fallback Solution

If production packaging remains unavailable, the project can only be treated as a development RC. It can be tested and demonstrated from the local repository, but it should not be labeled as a final end-user installer.

## Validation Results

| Area | Status | Evidence |
| --- | --- | --- |
| Backend tests | Pass | 52 tests OK. |
| Backend compile | Pass | `python -m compileall app tests` passed. |
| Frontend build | Pass | `cmd /c npm run build` passed. |
| Tauri debug build | Pass | `cmd /c npm run check` generated debug NSIS installer with bundled sidecar. |
| Backend sidecar exe | Pass | PyInstaller generated `project-vault-backend-x86_64-pc-windows-msvc.exe`; standalone health check returned `status=ok`. |
| Full scan | Pass | 100,004 files scanned in 25,011 ms on temporary 100k fixture. |
| Incremental scan | Pass | Known changed-path single-file scan in 370 ms on 100k fixture. |
| SQLite/FTS5 | Pass | 100,008 FTS rows rebuilt; search hit returned. |
| Search latency | Pass | `2.869 ms`, below the `<100 ms` target. |
| Backup/restore | Pass | 91,594,752 byte SQLite backup restored successfully. |
| Watcher engine | Pass with scope note | Event queue/debounce tests pass; automatic DB-consuming worker is not part of current implementation. |
| Explorer integration | Pass by tests | `file_id`-based open/reveal is covered by Phase 11 tests. |
| Production sidecar installer | Pass | Current release installer passed clean Windows no-Python/no-Node validation. |
| Clean Windows validation automation | Pass | `scripts/verify_clean_windows_release.ps1`, `scripts/ProjectVaultCleanWindows.wsb`, and `docs/release/CLEAN_WINDOWS_VALIDATION.md` are available; latest report SHA256 is `065A3D264F973771AF0556DBC8B3DC388601C9B48E1EF01E592F55FD14E96023`. |

## RC Command Evidence

```powershell
cd D:\Workflows\ProjectVault\backend
.venv\Scripts\python.exe ..\scripts\phase12_rc_check.py --files 100000
```

Observed result:

```json
{
  "full_scan": {
    "file_count": 100004,
    "duration_ms": 25011
  },
  "incremental_scan": {
    "created_count": 1,
    "duration_ms": 370
  },
  "fts_indexed_count": 100008,
  "search_ms": 2.869,
  "backup": {
    "size_bytes": 91594752
  },
  "restore": {
    "restored": true
  },
  "passed": true
}
```

## Final Verification Commands

```powershell
cd D:\Workflows\ProjectVault\backend
.venv\Scripts\python.exe -m unittest tests.test_database_migrations tests.test_project_discovery tests.test_projects_api tests.test_full_scanner tests.test_incremental_scanner tests.test_watcher_engine tests.test_watchdog_adapter tests.test_watcher_service tests.test_search_index tests.test_search_api tests.test_phase8_core_api tests.test_providers_api tests.test_phase10_cad_center tests.test_phase11_system_maintenance tests.test_phase12_rc_check -v
.venv\Scripts\python.exe -m compileall app tests

cd D:\Workflows\ProjectVault\frontend
cmd /c npm run build

cd D:\Workflows\ProjectVault\desktop
cmd /c npm run check
```

Debug installer generated:

```text
D:\Workflows\ProjectVault\desktop\src-tauri\target\debug\bundle\nsis\Project Vault_0.1.0_x64-setup.exe
```

Sidecar artifact generated:

```text
D:\Workflows\ProjectVault\desktop\src-tauri\binaries\project-vault-backend-x86_64-pc-windows-msvc.exe
```

## Release Gate

Development RC validation passes, production sidecar packaging is implemented, and V1 final clean Windows validation has passed.

## Clean Windows Validation

Prepared command for a clean Windows 10/11 machine:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\verify_clean_windows_release.ps1 `
  -InstallerPath ".\Project Vault_0.1.0_x64-setup.exe" `
  -ReportDir ".\validation-report"
```

Latest Windows Sandbox run completed successfully and wrote `release-validation/clean-windows-validation.json` with `passed=true`.
