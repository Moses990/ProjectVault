# Project Vault V1 Release Quality Checklist

Status: passed.

Last checked: 2026-06-26 10:31 +08:00.

## Goal

Close Phase 13.3 by validating the final V1 installer against release-quality checks that sit after clean Windows and local installed usage validation.

## Result

Report:

```text
D:\Workflows\ProjectVault\release-validation\phase13-release-quality-validation.json
```

Summary:

- `passed`: `true`
- Report SHA256: `BB183E9F90481CE3D65395E8EF2D3E8DFF2ED01BD68EF25569909B93DC3CB3A9`
- Installer SHA256: `0478EFE6C0E81D8F9B39F102E66642B129E30E06FE244D6757482AF0851772D8`
- Report size: `17,199` bytes
- Report last write UTC: `2026-06-26T02:25:41.0656135Z`

Critical passed checks:

- `initial_install=pass`
- `uninstaller_found=pass`
- `initial_launch=pass`
- `offline_launch_loopback_only=pass`
- `invalid_root_path_rejected=pass`
- `inaccessible_directory_controlled_error=pass`
- `candidate_discovery_skips_existing_project_json=pass`
- `project_initialized=pass`
- `valid_project_scan=pass`
- `damaged_project_json_controlled_error=pass`
- `backend_exit_cleanup_after_initial_launch=pass`
- `silent_uninstall=pass`
- `reinstall=pass`
- `reinstall_launch=pass`
- `backend_exit_cleanup_after_reinstall=pass`
- `release_docs_present=pass`
- `previous_local_database_restored=pass`

## Scope Notes

The offline launch check does not disable host network adapters. It verifies the packaged app launches using only local loopback endpoints:

- Backend: `http://127.0.0.1:<dynamic_port>/api/v1/health`
- Frontend: `http://127.0.0.1:<dynamic_port>/`

This avoids changing the host machine network state during release validation while still proving the packaged app does not need development servers or external service calls to open.

## Data Protection

The script uses a dedicated fixture:

```text
D:\Workflows\ProjectVault\release-validation\phase13-quality-fixture
```

It backs up the local SQLite cache before validation and restores it at the end. The final report includes `previous_local_database_restored=pass`.

## Final Verification Commands

The following commands passed after the Phase 13.3 quality check:

```powershell
cd D:\Workflows\ProjectVault\backend
.venv\Scripts\python.exe -m unittest discover -s tests -v
```

Result: `Ran 64 tests ... OK`.

```powershell
cd D:\Workflows\ProjectVault\frontend
cmd /c npm run build
```

Result: Next.js production static build passed.

```powershell
cd D:\Workflows\ProjectVault\desktop
cmd /c npm run check
```

Result: Tauri debug build and NSIS bundle passed.

## V1.0 Checkpoint Readiness

V1.0 checkpoint/tag is ready if the tag points at the source state containing:

- Fixed release installer evidence in `docs/release/V1_RELEASE_MANIFEST.md`.
- Clean Windows report with `passed=true`.
- Local installed usage report with `passed=true`.
- Phase 13 release quality report with `passed=true`.
- Current release docs under `docs/release/`.

Do not include runtime SQLite databases, local fixture data, virtual environments, `node_modules`, or downloaded fixed WebView2 runtime binaries as source artifacts.
