# Local Installed Usage Validation

Status: passed.

Last checked: 2026-06-26 10:09.

## Goal

Validate the fixed V1 release installer on the local host through the main real-use workflow after installation, without using development servers.

This validation is separate from clean Windows validation. Clean Windows proves standalone installation on a machine without Python/Node. Local installed usage validation proves the everyday product path works against the packaged app and bundled sidecar.

## Result

Report:

```text
D:\Workflows\ProjectVault\release-validation\local-installed-usage-validation.json
```

Summary:

- `passed`: `true`
- Report SHA256: `1B31EC6AC8B87563094072DE496D64DB465783580A0030D06DB48C3DAE6157AE`
- Installer SHA256: `0478EFE6C0E81D8F9B39F102E66642B129E30E06FE244D6757482AF0851772D8`
- Installed app: `C:\Users\admin\AppData\Local\Programs\ProjectVaultLocalUsageTest\project-vault.exe`
- Fixture root: `D:\Workflows\ProjectVault\release-validation\local-usage-fixture`
- SQLite path: `C:\Users\admin\AppData\Local\ProjectVault\database\project_vault.db`

Critical passed checks:

- `installer_silent_run=pass`
- `app_main_webview_window=pass`
- `backend_health=pass`
- `frontend_render=pass`
- `settings_root_path_saved=pass`
- `project_candidate_discovered=pass`
- `project_initialized=pass`
- `scanner_scan_fixture=pass`
- `dashboard_metrics=pass`
- `project_detail_overview=pass`
- `project_detail_files=pass`
- `project_detail_drawings=pass`
- `project_detail_materials=pass`
- `cad_center=pass`
- `search_ctrl_k_backend_path=pass`
- `history_records=pass`
- `backup_entry_point=pass`
- `restore_entry_point=pass`
- `database_path=pass`
- `backend_exit_cleanup=pass`
- `previous_local_database_restored=pass`

## Fixture

The validation script creates a dedicated fixture under:

```text
D:\Workflows\ProjectVault\release-validation\local-usage-fixture\PV-V1-Local-Acceptance
```

It contains:

- Two `.dwg` drawing placeholders.
- One `.xlsx` material placeholder.
- One `.pdf` material placeholder.
- One `.txt` note.
- A generated `project.json` created through the real `/projects/initialize` workflow.

No real production project data is used.

## Database Protection

Before validation, the script backs up the existing local database if present:

```text
C:\Users\admin\AppData\Local\ProjectVault\database\phase13-local-usage-backup\
```

It then clears the active database for an isolated acceptance run and restores the previous database at the end. The final report includes `previous_local_database_restored=pass`.

## Command

Run from the project root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\verify_local_installed_usage.ps1
```

Expected result:

```text
Project Vault local installed usage validation passed.
```

## Notes

Earlier script attempts failed because the validation flow assumed an already indexed project or used a search term that was not indexed. The final script now follows the product workflow: save Settings root path, discover a first-level candidate, initialize it, scan it, then validate the downstream views and APIs.
