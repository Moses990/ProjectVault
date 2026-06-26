# Clean Windows Validation

Status: passed. V1 Final clean Windows release gate is complete.

Last checked: 2026-06-26 09:41.

## Goal

Validate the V1 installer on a clean Windows 10/11 environment without Python, Node, or the project source tree.

## Result

Windows Sandbox validation passed.

Report:

```text
D:\Workflows\ProjectVault\release-validation\clean-windows-validation.json
```

Summary:

- `passed`: `true`
- `python_unavailable`: pass
- `node_unavailable`: pass
- `installer_silent_run`: pass, exit code 0
- `fixed_webview2_runtime_bundled`: pass
- `webview2_runtime_error_dialog_absent`: pass
- `app_started`: pass
- `app_main_webview_window`: pass, title `Project Vault`
- `backend_health`: pass, `status=ok`
- `frontend_render`: pass
- `database_path`: pass, under `%LOCALAPPDATA%\ProjectVault\database`
- `backend_exit_cleanup`: pass

Validated runtime details:

- Installer: `Project Vault_0.1.0_x64-setup.exe`
- Installed app: `C:\Users\WDAGUtilityAccount\AppData\Local\Programs\ProjectVaultCleanTest\project-vault.exe`
- Fixed WebView2 runtime: `C:\Users\WDAGUtilityAccount\AppData\Local\Programs\ProjectVaultCleanTest\binaries\webview2-fixed-runtime\Microsoft.WebView2.FixedVersionRuntime.149.0.4022.96.x64\msedgewebview2.exe`
- Backend health: `http://127.0.0.1:49823/api/v1/health`
- Frontend render: `http://127.0.0.1:49824/`
- SQLite path: `C:\Users\WDAGUtilityAccount\AppData\Local\ProjectVault\database\project_vault.db`
- Manual UI validation: launching `Project Vault` from the Sandbox desktop shortcut opens the main app page.

## Script Fix

The first Sandbox run failed before installer validation because `where python` returned the expected "not found" message in a clean environment, and `$ErrorActionPreference = "Stop"` treated it as a terminating error. `scripts\verify_clean_windows_release.ps1` now captures the `where` and `--version` probes through `cmd.exe` and records missing Python/Node as expected pass conditions.

## UI Render Follow-Up

Manual Sandbox testing later showed that the first packaged build could start the backend but did not render the main UI. Root cause: Tauri was loading `frontend/.next`, which is a Next.js internal build directory, not a static site output.

First fix applied:

- `frontend/next.config.ts` now uses `output: "export"`.
- Tauri `frontendDist` now points to `../../frontend/out`.
- Project detail navigation now uses the static route `/project-detail?id=...`.
- `scripts\verify_clean_windows_release.ps1` checks for the desktop main window via `app_main_window`.

Follow-up Sandbox testing still showed a black WebView even though backend health passed. The release loader has now been hardened:

- `desktop/src-tauri/src/main.rs` starts an embedded static frontend server on `127.0.0.1:<frontend_port>`.
- The Tauri WebView navigates to `http://127.0.0.1:<frontend_port>/`.
- The static server serves packaged assets from Tauri's asset resolver and injects `window.__BACKEND_PORT__` into HTML before load.
- Nested route asset requests such as `/projects/_next/static/...` are normalized back to `/_next/static/...`.
- `scripts\verify_clean_windows_release.ps1` now adds `frontend_render`, which fetches the packaged frontend HTML and requires both `Project Vault V1` and `__BACKEND_PORT__`.

Local packaged smoke passed after this fix:

- Frontend HTML: `http://127.0.0.1:50151/`, status 200, contains Project Vault shell and backend port injection.
- Nested route asset: `http://127.0.0.1:50151/projects/_next/static/chunks/0acb211be0a29b2f.js`, status 200.
- Backend health: `http://127.0.0.1:50150/api/v1/health`, `status=ok`.
- SQLite path: `C:\Users\admin\AppData\Local\ProjectVault\database\project_vault.db`.

## Prepared Automation

Use:

```powershell
scripts\verify_clean_windows_release.ps1
```

The script checks:

- `python --version` is not executable.
- `node --version` is not executable.
- The NSIS installer installs successfully.
- The desktop app starts.
- The fixed WebView2 Runtime is bundled under the install directory through `fixed_webview2_runtime_bundled`.
- No visible `Could not find the WebView2 Runtime` dialog is present through `webview2_runtime_error_dialog_absent`.
- System WebView2 registry availability is recorded through `webview2_runtime_available`, but fixed runtime bundling is the release gate.
- The bundled sidecar process starts.
- `/api/v1/health` returns `status=ok`.
- The packaged frontend serves renderable Project Vault HTML through `frontend_render`.
- The SQLite cache is created under `%LOCALAPPDATA%\ProjectVault\database\project_vault.db`.
- Closing the desktop app leaves no `project-vault-backend` process.

## Manual Clean Machine Command

On a clean Windows machine, copy only the installer and the validation script, then run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\verify_clean_windows_release.ps1 `
  -InstallerPath ".\Project Vault_0.1.0_x64-setup.exe" `
  -ReportDir ".\validation-report"
```

Expected result:

```text
Project Vault clean Windows validation passed.
```

## Windows Sandbox Option

If Windows Sandbox is enabled on the host, create this output folder first:

```powershell
New-Item -ItemType Directory -Force D:\Workflows\ProjectVault\release-validation
```

Then open:

```text
D:\Workflows\ProjectVault\scripts\ProjectVaultCleanWindows.wsb
```

The Sandbox config maps only the installer folder, scripts folder, and validation output folder. It writes:

```text
D:\Workflows\ProjectVault\release-validation\clean-windows-validation.json
D:\Workflows\ProjectVault\release-validation\clean-windows-validation.txt
```

## Release Installer Gate

The previous Sandbox black window was caused by validating a debug NSIS build. The debug desktop binary uses the Windows console subsystem and can show a console-style window whose title is the full exe path. It is not valid evidence for the final packaged UI gate.

Current release installer:

```text
D:\Workflows\ProjectVault\desktop\src-tauri\target\release\bundle\nsis\Project Vault_0.1.0_x64-setup.exe
```

Current Sandbox mapping:

```text
D:\Workflows\ProjectVault\desktop\src-tauri\target\release\bundle\nsis
```

The release desktop binary has been checked as Windows GUI subsystem, while the debug binary is console subsystem.

The latest release NSIS package embeds Microsoft WebView2 Fixed Version Runtime via Tauri `bundle.windows.webviewInstallMode.type = fixedRuntime`. This avoids relying on the target machine's WebView2 registry state. The runtime is prepared by:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\prepare_webview2_fixed_runtime.ps1
```

Current fixed runtime:

```text
Version: 149.0.4022.96
Architecture: x64
SHA256: C4B3F527B5C6D29BAFFB6EC6B4E1EC7404F9417AC4153DAA57634B389203FDF4
Path: desktop/src-tauri/binaries/webview2-fixed-runtime/Microsoft.WebView2.FixedVersionRuntime.149.0.4022.96.x64
```

Current release installer:

```text
D:\Workflows\ProjectVault\desktop\src-tauri\target\release\bundle\nsis\Project Vault_0.1.0_x64-setup.exe
Size: 240,129,228 bytes
```

## V1 Final Gate

V1 Final is complete. The latest Windows Sandbox report confirms `passed=true`, `fixed_webview2_runtime_bundled=pass`, `webview2_runtime_error_dialog_absent=pass`, `frontend_render=pass`, `backend_health=pass`, `database_path=pass`, and `backend_exit_cleanup=pass`; manual desktop shortcut launch renders the main Project Vault page.
