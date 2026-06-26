# Project Vault V1 Release Manifest

Status: V1 Final release gate passed.

Last updated: 2026-06-26.

## Release Artifact

- Product: Project Vault
- Version: 0.1.0
- Build target: Windows x64 NSIS installer
- Installer: `D:\Workflows\ProjectVault\desktop\src-tauri\target\release\bundle\nsis\Project Vault_0.1.0_x64-setup.exe`
- Size: `240,129,228` bytes
- Last write UTC: `2026-06-26T01:21:32.8380995Z`
- SHA256: `0478EFE6C0E81D8F9B39F102E66642B129E30E06FE244D6757482AF0851772D8`

## Validation Evidence

- Clean Windows report: `D:\Workflows\ProjectVault\release-validation\clean-windows-validation.json`
- Report size: `7,911` bytes
- Report last write UTC: `2026-06-26T01:41:55.2897461Z`
- Report SHA256: `1A128EA00BFF4C25648B09AF2D3F95904FCDAF2B129E5EF4EBA02F32D86D5E2D`
- Result: `passed=true`
- Local installed usage report: `D:\Workflows\ProjectVault\release-validation\local-installed-usage-validation.json`
- Local usage report SHA256: `1B31EC6AC8B87563094072DE496D64DB465783580A0030D06DB48C3DAE6157AE`
- Local usage result: `passed=true`
- Phase 13 release quality report: `D:\Workflows\ProjectVault\release-validation\phase13-release-quality-validation.json`
- Phase 13 release quality report SHA256: `BB183E9F90481CE3D65395E8EF2D3E8DFF2ED01BD68EF25569909B93DC3CB3A9`
- Phase 13 release quality result: `passed=true`

Critical passed checks:

- `python_unavailable=pass`
- `node_unavailable=pass`
- `installer_silent_run=pass`
- `fixed_webview2_runtime_bundled=pass`
- `webview2_runtime_error_dialog_absent=pass`
- `app_main_webview_window=pass`
- `backend_health=pass`
- `frontend_render=pass`
- `database_path=pass`
- `backend_exit_cleanup=pass`

Local installed usage passed checks:

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
- `previous_local_database_restored=pass`

Phase 13 release quality passed checks:

- `initial_install=pass`
- `silent_uninstall=pass`
- `reinstall=pass`
- `reinstall_launch=pass`
- `offline_launch_loopback_only=pass`
- `invalid_root_path_rejected=pass`
- `damaged_project_json_controlled_error=pass`
- `inaccessible_directory_controlled_error=pass`
- `release_docs_present=pass`

Manual confirmation:

- Windows Sandbox desktop shortcut `Project Vault` opens the main application page.

## Rebuild Inputs

- Backend sidecar builder: `scripts/build_backend_sidecar.ps1`
- Fixed WebView2 runtime preparer: `scripts/prepare_webview2_fixed_runtime.ps1`
- Clean Windows validator: `scripts/verify_clean_windows_release.ps1`
- Local installed usage validator: `scripts/verify_local_installed_usage.ps1`
- Phase 13 release quality validator: `scripts/verify_phase13_release_quality.ps1`
- Sandbox config: `scripts/ProjectVaultCleanWindows.wsb`
- Tauri config: `desktop/src-tauri/tauri.conf.json`

## Release Decision

V1 Final and Phase 13 release hardening can be treated as complete. The source state is ready for a V1.0 checkpoint/tag after normal repository hygiene and source artifact review.
