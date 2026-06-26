# Project Vault Development

Project Vault is the new formal application structure for the local-first project asset manager.

## Structure

- `backend/`: FastAPI service, SQLite initialization, scanner and APIs.
- `frontend/`: Next.js UI.
- `database/`: local SQLite runtime database.
- `desktop/`: future Tauri desktop shell.
- `docs/architecture/`: planning documents `00` through `13`.
- `docs/product/`: product requirements document.
- `prototype/`: static prototype migrated from the previous `web` folder.

## Current Milestone

Project Vault V1 Final release gate is complete.

- Backend scanner, watcher, FTS5 search, core APIs, CAD Center APIs, AI Provider CRUD, and system maintenance APIs are implemented.
- Frontend MVP pages are implemented: Dashboard, Projects, Project Detail, CAD Center, History, Settings maintenance, AI Center, Sidebar, and Command Palette.
- Phase 11 adds controlled Explorer Open / Reveal by `file_id`, scan history retention cleanup, SQLite incremental vacuum, and database backup/restore entry points.
- Phase 12 adds an RC validation script and an incremental-scan changed-path fast path for Watcher-style single-file changes.
- RC evidence: temporary 100k-file fixture passed full scan, incremental scan, FTS rebuild, search, backup, and restore; search measured `2.869 ms`, and known changed-path incremental scan measured `370 ms`.
- Production sidecar packaging is now implemented locally: PyInstaller builds `project-vault-backend-x86_64-pc-windows-msvc.exe`, Tauri `externalBin` includes it, and the desktop launcher uses the bundled sidecar instead of `backend/.venv/Scripts/python.exe`.
- Sidecar smoke evidence: the generated exe serves `/api/v1/health` and writes SQLite under `%LOCALAPPDATA%\ProjectVault\database\project_vault.db`.
- Release docs now live in `docs/release/`.
- Clean Windows evidence: Windows Sandbox validation passed without Python or Node installed. The installer started the bundled sidecar, `/api/v1/health` returned `status=ok`, SQLite was created under `%LOCALAPPDATA%\ProjectVault\database\project_vault.db`, and backend exit cleanup passed.
- Final validation report: `release-validation/clean-windows-validation.json`.
- Packaged UI fix: the frontend now exports static assets to `frontend/out`, and Tauri loads that directory instead of the internal `.next` build folder.
- Local UI smoke: the newly built installer can open the main Dashboard on the local machine.
- Phase 12.2 fix now serves the packaged frontend through an embedded `127.0.0.1` static server and injects the bundled backend port into HTML before WebView load.
- Local packaged smoke now verifies frontend HTML, nested route assets, sidecar health, and `%LOCALAPPDATA%` SQLite path.
- WebView2 packaging is now fixed-runtime based: `scripts/prepare_webview2_fixed_runtime.ps1` prepares Microsoft WebView2 Fixed Version Runtime `149.0.4022.96` under `desktop/src-tauri/binaries/webview2-fixed-runtime`, and Tauri bundles it with `webviewInstallMode.type = fixedRuntime`.
- Latest release installer: `desktop/src-tauri/target/release/bundle/nsis/Project Vault_0.1.0_x64-setup.exe`, size `240,129,228` bytes.
- V1 release manifest: `docs/release/V1_RELEASE_MANIFEST.md`, installer SHA256 `0478EFE6C0E81D8F9B39F102E66642B129E30E06FE244D6757482AF0851772D8`.
- Final clean Windows validation passed in Windows Sandbox on 2026-06-26. `clean-windows-validation.json` has `passed=true`; `fixed_webview2_runtime_bundled`, `webview2_runtime_error_dialog_absent`, `frontend_render`, `backend_health`, `database_path`, and `backend_exit_cleanup` all passed. Manual Sandbox launch from the desktop shortcut also opens the main Project Vault page.
- Local installed usage validation passed on 2026-06-26. `local-installed-usage-validation.json` has `passed=true`; the installed app opened, Settings root path was saved, a dedicated fixture project was discovered, initialized, scanned, and verified through Dashboard, Projects, Project Detail, CAD Center, Search, History, and backup/restore.
- Phase 13 release quality validation passed on 2026-06-26. `phase13-release-quality-validation.json` has `passed=true`; install, uninstall, reinstall, loopback-only launch, invalid root path, damaged `project.json`, inaccessible directory, release docs, and database restore checks all passed.

## Project Management

Use the root planning files as the source of truth for execution:

- `task_plan.md`: phase order, deliverables, acceptance criteria.
- `findings.md`: product and architecture decisions.
- `progress.md`: work log and verification records.

## Start

Run backend:

```bat
scripts\鍚姩ProjectVault鍚庣.bat
```

Run frontend:

```bat
scripts\鍚姩ProjectVault鍓嶇.bat
```
