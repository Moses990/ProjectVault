import json
import os
import sys
import tempfile
import tomllib
import unittest
from pathlib import Path
from unittest.mock import patch


PROJECT_ROOT = Path(__file__).resolve().parents[2]


class Phase12SidecarPackagingTests(unittest.TestCase):
    def test_v2_beta_version_is_consistent_across_runtime_surfaces(self):
        expected = "2.0.0-beta.1"
        frontend_package = json.loads((PROJECT_ROOT / "frontend" / "package.json").read_text(encoding="utf-8"))
        desktop_package = json.loads((PROJECT_ROOT / "desktop" / "package.json").read_text(encoding="utf-8"))
        tauri_config = json.loads((PROJECT_ROOT / "desktop" / "src-tauri" / "tauri.conf.json").read_text(encoding="utf-8"))
        cargo = tomllib.loads((PROJECT_ROOT / "desktop" / "src-tauri" / "Cargo.toml").read_text(encoding="utf-8"))
        backend_main = (PROJECT_ROOT / "backend" / "app" / "main.py").read_text(encoding="utf-8")

        self.assertEqual(frontend_package["version"], expected)
        self.assertEqual(desktop_package["version"], expected)
        self.assertEqual(tauri_config["version"], expected)
        self.assertEqual(cargo["package"]["version"], expected)
        self.assertIn(f'version="{expected}"', backend_main)
        self.assertIn(f"Project Vault_{expected}_x64-setup.exe", (PROJECT_ROOT / "scripts" / "ProjectVaultCleanWindows.wsb").read_text(encoding="utf-8"))

    def test_release_build_script_declares_pyinstaller_sidecar_output(self):
        script = PROJECT_ROOT / "scripts" / "build_backend_sidecar.ps1"

        self.assertTrue(script.exists(), "backend sidecar build script is missing")
        content = script.read_text(encoding="utf-8")

        self.assertIn("PyInstaller", content)
        self.assertIn("project-vault-backend-x86_64-pc-windows-msvc", content)
        self.assertIn("desktop", content)
        self.assertIn("src-tauri", content)
        self.assertIn("binaries", content)
        self.assertIn("--hidden-import app.api.knowledge", content)

    def test_desktop_build_rebuilds_frontend_and_sidecar(self):
        package_json = PROJECT_ROOT / "desktop" / "package.json"
        scripts = json.loads(package_json.read_text(encoding="utf-8"))["scripts"]

        self.assertIn("npm run build:frontend", scripts["prebuild"])
        self.assertIn("npm run build:sidecar", scripts["prebuild"])
        self.assertIn("../frontend", scripts["build:frontend"])
        self.assertIn("build_backend_sidecar.ps1", scripts["build:sidecar"])

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
        self.assertIn("Project Vault", content)
        self.assertIn("__BACKEND_PORT__", content)
        self.assertIn("frontend_render", content)
        self.assertIn("app_main_webview_window", content)
        self.assertIn("MainWindowTitle -eq \"Project Vault\"", content)
        self.assertIn("Test-PackagedKnowledgeRoute", content)
        self.assertIn("packaged_knowledge_route", content)
        self.assertIn('"/api/v1/projects/{project_id}/knowledge"', content)

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

    def test_local_installed_validation_retries_locked_install_directory_cleanup(self):
        script = PROJECT_ROOT / "scripts" / "verify_local_installed_usage.ps1"
        mock_provider = PROJECT_ROOT / "scripts" / "mock_openai_provider.ps1"
        content = script.read_text(encoding="utf-8")

        self.assertTrue(mock_provider.exists())
        self.assertIn("function Remove-PathWithRetry", content)
        self.assertIn("function Stop-ProjectVaultRuntimeProcesses", content)
        self.assertIn("Refusing to recursively remove drive root", content)
        self.assertIn("Remove-PathWithRetry -Path $InstallDir", content)
        self.assertIn('mode = "ai"', content)
        self.assertIn("v2_knowledge_create_ai_draft", content)
        self.assertIn("-WindowStyle Hidden", content)
        self.assertIn('release-validation\\v2.0.0-beta.1', content)
        self.assertIn("StartsWith($installPrefix", content)
        self.assertNotIn('Where-Object { $_.ProcessName -like "project-vault*" }', content)

    def test_windows_sandbox_maps_release_installer_not_debug_installer(self):
        sandbox_config = PROJECT_ROOT / "scripts" / "ProjectVaultCleanWindows.wsb"
        content = sandbox_config.read_text(encoding="utf-8")

        self.assertIn(r"target\release\bundle\nsis", content)
        self.assertNotIn(r"target\debug\bundle\nsis", content)
        self.assertIn(r"release-validation\v2.0.0-beta.1", content)

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
