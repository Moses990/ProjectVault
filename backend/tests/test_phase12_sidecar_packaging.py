import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


PROJECT_ROOT = Path(__file__).resolve().parents[2]


class Phase12SidecarPackagingTests(unittest.TestCase):
    def test_release_build_script_declares_pyinstaller_sidecar_output(self):
        script = PROJECT_ROOT / "scripts" / "build_backend_sidecar.ps1"

        self.assertTrue(script.exists(), "backend sidecar build script is missing")
        content = script.read_text(encoding="utf-8")

        self.assertIn("PyInstaller", content)
        self.assertIn("project-vault-backend-x86_64-pc-windows-msvc", content)
        self.assertIn("desktop", content)
        self.assertIn("src-tauri", content)
        self.assertIn("binaries", content)

    def test_tauri_bundle_declares_backend_external_bin(self):
        config_path = PROJECT_ROOT / "desktop" / "src-tauri" / "tauri.conf.json"
        config = json.loads(config_path.read_text(encoding="utf-8"))

        self.assertEqual(
            ["binaries/project-vault-backend"],
            config["bundle"]["externalBin"],
        )

    def test_tauri_installer_embeds_fixed_webview2_runtime(self):
        config_path = PROJECT_ROOT / "desktop" / "src-tauri" / "tauri.conf.json"
        prepare_script = PROJECT_ROOT / "scripts" / "prepare_webview2_fixed_runtime.ps1"
        config = json.loads(config_path.read_text(encoding="utf-8"))

        webview_install_mode = config["bundle"]["windows"]["webviewInstallMode"]
        runtime_path = PROJECT_ROOT / "desktop" / "src-tauri" / webview_install_mode["path"]

        self.assertEqual("fixedRuntime", webview_install_mode["type"])
        self.assertNotIn("silent", webview_install_mode)
        self.assertTrue(prepare_script.exists(), "fixed WebView2 runtime prepare script is missing")
        self.assertTrue(runtime_path.exists(), "fixed WebView2 runtime directory is missing")
        self.assertTrue((runtime_path / "msedgewebview2.exe").exists(), "fixed WebView2 runtime executable is missing")

    def test_tauri_uses_static_frontend_export_not_next_internal_build(self):
        config_path = PROJECT_ROOT / "desktop" / "src-tauri" / "tauri.conf.json"
        config = json.loads(config_path.read_text(encoding="utf-8"))
        next_config = PROJECT_ROOT / "frontend" / "next.config.ts"
        next_config_content = next_config.read_text(encoding="utf-8")

        self.assertEqual("../../frontend/out", config["build"]["frontendDist"])
        self.assertNotIn(".next", config["build"]["frontendDist"])
        self.assertIn('output: "export"', next_config_content)
        self.assertIn('assetPrefix: "."', next_config_content)

    def test_desktop_launcher_uses_tauri_sidecar_not_local_python(self):
        main_rs = PROJECT_ROOT / "desktop" / "src-tauri" / "src" / "main.rs"
        content = main_rs.read_text(encoding="utf-8")

        self.assertIn(".shell()", content)
        self.assertIn(".sidecar(\"project-vault-backend\")", content)
        self.assertIn("--parent-pid", content)
        self.assertNotIn(".venv", content)
        self.assertNotIn("python.exe", content)
        self.assertNotIn("Command::new(python)", content)

    def test_release_desktop_binary_uses_windows_subsystem_without_console(self):
        main_rs = PROJECT_ROOT / "desktop" / "src-tauri" / "src" / "main.rs"
        content = main_rs.read_text(encoding="utf-8")

        self.assertIn('windows_subsystem = "windows"', content)
        self.assertIn("not(debug_assertions)", content)

    def test_desktop_launcher_serves_packaged_frontend_over_localhost(self):
        main_rs = PROJECT_ROOT / "desktop" / "src-tauri" / "src" / "main.rs"
        content = main_rs.read_text(encoding="utf-8")

        self.assertIn("fn start_frontend_server", content)
        self.assertIn('TcpListener::bind("127.0.0.1:0")', content)
        self.assertIn("app.asset_resolver()", content)
        self.assertIn("WebviewWindowBuilder::new", content)
        self.assertIn("WebviewUrl::External(frontend_url)", content)
        self.assertIn("http://127.0.0.1:{frontend_port}/", content)
        self.assertIn("window.__BACKEND_PORT__", content)
        self.assertNotIn("window.navigate(frontend_url)", content)
        self.assertNotIn("window.eval(&script)", content)

    def test_tauri_does_not_auto_create_blank_window_before_frontend_is_ready(self):
        config_path = PROJECT_ROOT / "desktop" / "src-tauri" / "tauri.conf.json"
        config = json.loads(config_path.read_text(encoding="utf-8"))

        self.assertEqual([], config["app"]["windows"])

    def test_clean_windows_validation_checks_real_frontend_html(self):
        script = PROJECT_ROOT / "scripts" / "verify_clean_windows_release.ps1"
        content = script.read_text(encoding="utf-8")

        self.assertIn("Wait-ForFrontendRender", content)
        self.assertIn("Project Vault V1", content)
        self.assertIn("__BACKEND_PORT__", content)
        self.assertIn("frontend_render", content)
        self.assertIn("app_main_webview_window", content)
        self.assertIn("MainWindowTitle -eq \"Project Vault\"", content)

    def test_clean_windows_validation_checks_webview2_runtime_after_install(self):
        script = PROJECT_ROOT / "scripts" / "verify_clean_windows_release.ps1"
        content = script.read_text(encoding="utf-8")

        self.assertIn("Test-WebView2RuntimeAvailable", content)
        self.assertIn("Test-FixedWebView2RuntimeBundled", content)
        self.assertIn("Assert-NoWebView2RuntimeErrorDialog", content)
        self.assertIn("webview2_runtime_available", content)
        self.assertIn("fixed_webview2_runtime_bundled", content)
        self.assertIn("WebView2 Runtime error dialog is visible.", content)
        self.assertIn("Wait-ForBackendExit -ProcessId $healthResult.processId", content)
        self.assertIn("checkedBackendProcessId", content)

    def test_windows_sandbox_maps_release_installer_not_debug_installer(self):
        sandbox_config = PROJECT_ROOT / "scripts" / "ProjectVaultCleanWindows.wsb"
        content = sandbox_config.read_text(encoding="utf-8")

        self.assertIn(r"target\release\bundle\nsis", content)
        self.assertNotIn(r"target\debug\bundle\nsis", content)

    def test_frozen_sidecar_uses_persistent_user_database_path(self):
        from app.core.config import default_database_path

        with tempfile.TemporaryDirectory() as temp_dir:
            with patch.object(sys, "frozen", True, create=True):
                with patch.dict(os.environ, {"LOCALAPPDATA": temp_dir}):
                    db_path = default_database_path()

        self.assertEqual(
            Path(temp_dir) / "ProjectVault" / "database" / "project_vault.db",
            db_path,
        )


if __name__ == "__main__":
    unittest.main()
