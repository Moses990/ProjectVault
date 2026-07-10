param(
    [Parameter(Mandatory = $true)]
    [string]$InstallerPath,

    [string]$ReportDir = "$env:USERPROFILE\Desktop\ProjectVaultValidation",
    [string]$InstallDir = "$env:LOCALAPPDATA\Programs\ProjectVaultCleanTest",
    [int]$StartupTimeoutSeconds = 45
)

$ErrorActionPreference = "Stop"

function Write-Utf8NoBom {
    param(
        [string]$Path,
        [string]$Value
    )
    $encoding = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $Value, $encoding)
}

function Add-Step {
    param(
        [string]$Name,
        [string]$Status,
        [object]$Details = $null
    )
    $script:Steps += [ordered]@{
        name = $Name
        status = $Status
        details = $Details
    }
}

function Test-ExecutableUnavailable {
    param([string]$CommandName)

    $result = [ordered]@{
        command = $CommandName
        found = $false
        versionExitCode = $null
        versionOutput = ""
        unavailable = $true
    }

    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $whereOutput = & cmd.exe /d /c "where $CommandName 2>&1"
        $whereExitCode = $LASTEXITCODE
        $versionOutput = & cmd.exe /d /c "$CommandName --version 2>&1"
        $versionExitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }

    if ($whereExitCode -eq 0) {
        $result.found = $true
        $result.where = ($whereOutput -join "`n")
    }

    $result.versionExitCode = $versionExitCode
    $result.versionOutput = ($versionOutput -join "`n")
    $result.unavailable = ($versionExitCode -ne 0)

    return $result
}

function Wait-ForBackendHealth {
    param([int]$TimeoutSeconds)

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        $backendProcesses = Get-Process -ErrorAction SilentlyContinue |
            Where-Object { $_.ProcessName -like "project-vault-backend*" }

        foreach ($backendProcess in $backendProcesses) {
            $listeners = Get-NetTCPConnection -State Listen -OwningProcess $backendProcess.Id -ErrorAction SilentlyContinue |
                Where-Object { $_.LocalAddress -eq "127.0.0.1" -or $_.LocalAddress -eq "::1" }

            foreach ($listener in $listeners) {
                $uri = "http://127.0.0.1:$($listener.LocalPort)/api/v1/health"
                try {
                    $health = Invoke-RestMethod -Uri $uri -TimeoutSec 2
                    if ($health.status -eq "ok") {
                        return [ordered]@{
                            processId = $backendProcess.Id
                            processName = $backendProcess.ProcessName
                            port = $listener.LocalPort
                            uri = $uri
                            health = $health
                        }
                    }
                }
                catch {
                    continue
                }
            }
        }

        Start-Sleep -Milliseconds 500
    }

    throw "Backend health endpoint did not respond within $TimeoutSeconds seconds."
}

function Wait-ForBackendExit {
    param(
        [int]$ProcessId,
        [int]$TimeoutSeconds
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        $backendProcess = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
        if (-not $backendProcess) {
            return $true
        }
        Start-Sleep -Milliseconds 500
    }

    return $false
}

function Wait-ForMainWindow {
    param(
        [int]$ProcessId,
        [int]$TimeoutSeconds
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        $process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
        if ($process -and $process.MainWindowHandle -ne 0 -and $process.MainWindowTitle -eq "Project Vault") {
            return [ordered]@{
                processId = $process.Id
                processName = $process.ProcessName
                mainWindowTitle = $process.MainWindowTitle
                mainWindowHandle = $process.MainWindowHandle
            }
        }
        Start-Sleep -Milliseconds 500
    }

    throw "Project Vault WebView main window did not appear within $TimeoutSeconds seconds."
}

function Get-VisibleWindowInfos {
    $code = @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

public static class WindowInspector {
    public class WindowInfo {
        public int ProcessId;
        public IntPtr Handle;
        public string Title;
    }

    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll", SetLastError=true)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll", SetLastError=true)]
    public static extern int GetWindowTextLength(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

    public static WindowInfo[] VisibleWindows() {
        var windows = new List<WindowInfo>();
        EnumWindows(delegate(IntPtr hWnd, IntPtr lParam) {
            if (!IsWindowVisible(hWnd)) {
                return true;
            }
            int length = GetWindowTextLength(hWnd);
            if (length <= 0) {
                return true;
            }
            var title = new StringBuilder(length + 1);
            GetWindowText(hWnd, title, title.Capacity);
            uint processId;
            GetWindowThreadProcessId(hWnd, out processId);
            windows.Add(new WindowInfo {
                ProcessId = (int)processId,
                Handle = hWnd,
                Title = title.ToString()
            });
            return true;
        }, IntPtr.Zero);
        return windows.ToArray();
    }
}
"@

    if (-not ([System.Management.Automation.PSTypeName]"WindowInspector").Type) {
        Add-Type -TypeDefinition $code
    }

    return [WindowInspector]::VisibleWindows()
}

function Assert-NoWebView2RuntimeErrorDialog {
    param([int]$ProcessId)

    $windows = Get-VisibleWindowInfos
    $matches = @($windows | Where-Object {
        ($_.ProcessId -eq $ProcessId -or $_.Title -eq "Project Vault") -and
        ($_.Title -like "*WebView2 Runtime*" -or $_.Title -like "*Could not find*")
    })

    if ($matches.Count -gt 0) {
        throw "WebView2 Runtime error dialog is visible."
    }

    return [ordered]@{
        checkedProcessId = $ProcessId
        matchingDialogs = $matches.Count
    }
}

function Wait-ForFrontendRender {
    param(
        [int]$ProcessId,
        [int]$BackendPort,
        [int]$TimeoutSeconds
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        $listeners = Get-NetTCPConnection -State Listen -OwningProcess $ProcessId -ErrorAction SilentlyContinue |
            Where-Object { $_.LocalAddress -eq "127.0.0.1" -or $_.LocalAddress -eq "::1" }

        foreach ($listener in $listeners) {
            if ($listener.LocalPort -eq $BackendPort) {
                continue
            }

            $uri = "http://127.0.0.1:$($listener.LocalPort)/"
            try {
                $response = Invoke-WebRequest -Uri $uri -TimeoutSec 2 -UseBasicParsing
                $html = [string]$response.Content
                $hasShell = $html.Contains("Project Vault")
                $hasBackendPort = $html.Contains("__BACKEND_PORT__") -and $html.Contains([string]$BackendPort)
                if ($response.StatusCode -eq 200 -and $hasShell -and $hasBackendPort) {
                    return [ordered]@{
                        processId = $ProcessId
                        port = $listener.LocalPort
                        uri = $uri
                        statusCode = $response.StatusCode
                        containsProjectVaultShell = $hasShell
                        containsBackendPortInjection = $hasBackendPort
                    }
                }
            }
            catch {
                continue
            }
        }

        Start-Sleep -Milliseconds 500
    }

    throw "Packaged frontend did not serve renderable Project Vault HTML within $TimeoutSeconds seconds."
}

function Test-PackagedKnowledgeRoute {
    param([int]$BackendPort)

    $openApiUri = "http://127.0.0.1:$BackendPort/openapi.json"
    $openApi = Invoke-RestMethod -Uri $openApiUri -TimeoutSec 5
    $route = "/api/v1/projects/{project_id}/knowledge"
    $routes = @($openApi.paths.PSObject.Properties.Name)
    if ($route -notin $routes) {
        throw "Packaged backend is missing Knowledge route: $route"
    }

    return [ordered]@{
        uri = $openApiUri
        route = $route
        present = $true
    }
}

function Test-FixedWebView2RuntimeBundled {
    param([string]$InstallDir)

    $runtimeExe = Get-ChildItem -LiteralPath $InstallDir -Recurse -File -Filter "msedgewebview2.exe" -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -like "*webview2-fixed-runtime*" -or $_.FullName -like "*FixedVersionRuntime*" } |
        Select-Object -First 1

    if ($runtimeExe) {
        return [ordered]@{
            bundled = $true
            path = $runtimeExe.FullName
            size = $runtimeExe.Length
        }
    }

    return [ordered]@{
        bundled = $false
        installDir = $InstallDir
    }
}

function Test-WebView2RuntimeAvailable {
    $registryPaths = @(
        "HKLM:\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}",
        "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}",
        "HKCU:\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}",
        "HKCU:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"
    )

    foreach ($registryPath in $registryPaths) {
        if (Test-Path -LiteralPath $registryPath) {
            $item = Get-ItemProperty -LiteralPath $registryPath
            return [ordered]@{
                available = $true
                registryPath = $registryPath
                name = $item.name
                version = $item.pv
            }
        }
    }

    return [ordered]@{
        available = $false
        checkedRegistryPaths = $registryPaths
    }
}

$Steps = @()
$Report = [ordered]@{
    startedAt = (Get-Date).ToString("o")
    installerPath = $InstallerPath
    installDir = $InstallDir
    reportDir = $ReportDir
    passed = $false
    steps = $Steps
}

New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null
$appProcess = $null
$healthResult = $null

try {
    if (-not (Test-Path -LiteralPath $InstallerPath)) {
        throw "Installer not found: $InstallerPath"
    }
    Add-Step "installer_exists" "pass" @{ path = $InstallerPath; size = (Get-Item -LiteralPath $InstallerPath).Length }

    $python = Test-ExecutableUnavailable "python"
    $node = Test-ExecutableUnavailable "node"
    Add-Step "python_unavailable" ($(if ($python.unavailable) { "pass" } else { "fail" })) $python
    Add-Step "node_unavailable" ($(if ($node.unavailable) { "pass" } else { "fail" })) $node
    if (-not $python.unavailable -or -not $node.unavailable) {
        throw "Clean-machine precondition failed: Python or Node is executable in this environment."
    }

    if (Test-Path -LiteralPath $InstallDir) {
        Remove-Item -LiteralPath $InstallDir -Recurse -Force
    }
    New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null

    $installArgs = "/S /D=$InstallDir"
    $installer = Start-Process -FilePath $InstallerPath -ArgumentList $installArgs -Wait -PassThru
    Add-Step "installer_silent_run" ($(if ($installer.ExitCode -eq 0) { "pass" } else { "fail" })) @{
        exitCode = $installer.ExitCode
        args = $installArgs
    }
    if ($installer.ExitCode -ne 0) {
        throw "Installer exited with code $($installer.ExitCode)."
    }

    $fixedWebView2 = Test-FixedWebView2RuntimeBundled -InstallDir $InstallDir
    Add-Step "fixed_webview2_runtime_bundled" ($(if ($fixedWebView2.bundled) { "pass" } else { "fail" })) $fixedWebView2
    if (-not $fixedWebView2.bundled) {
        throw "Bundled fixed WebView2 Runtime was not found in the install directory."
    }

    $webview2 = Test-WebView2RuntimeAvailable
    Add-Step "webview2_runtime_available" ($(if ($webview2.available) { "pass" } else { "info" })) $webview2

    $appExe = Get-ChildItem -LiteralPath $InstallDir -Recurse -File -Filter "*.exe" |
        Where-Object {
            $_.Name -notlike "*backend*" -and
            $_.Name -notlike "unins*" -and
            $_.Name -notlike "*uninstall*"
        } |
        Select-Object -First 1

    if (-not $appExe) {
        throw "Installed Project Vault executable was not found under $InstallDir."
    }
    Add-Step "app_executable_found" "pass" @{ path = $appExe.FullName; size = $appExe.Length }

    $appProcess = Start-Process -FilePath $appExe.FullName -PassThru
    Add-Step "app_started" "pass" @{ processId = $appProcess.Id; processName = $appProcess.ProcessName }

    $windowResult = Wait-ForMainWindow -ProcessId $appProcess.Id -TimeoutSeconds $StartupTimeoutSeconds
    Add-Step "app_main_webview_window" "pass" $windowResult

    $dialogResult = Assert-NoWebView2RuntimeErrorDialog -ProcessId $appProcess.Id
    Add-Step "webview2_runtime_error_dialog_absent" "pass" $dialogResult

    $healthResult = Wait-ForBackendHealth -TimeoutSeconds $StartupTimeoutSeconds
    Add-Step "backend_health" "pass" $healthResult

    $knowledgeRoute = Test-PackagedKnowledgeRoute -BackendPort $healthResult.port
    Add-Step "packaged_knowledge_route" "pass" $knowledgeRoute

    $frontendResult = Wait-ForFrontendRender -ProcessId $appProcess.Id -BackendPort $healthResult.port -TimeoutSeconds $StartupTimeoutSeconds
    Add-Step "frontend_render" "pass" $frontendResult

    $databasePath = [string]$healthResult.health.database.path
    $expectedDatabaseRoot = Join-Path $env:LOCALAPPDATA "ProjectVault\database"
    $databasePathValid = $databasePath.StartsWith($expectedDatabaseRoot, [System.StringComparison]::OrdinalIgnoreCase)
    Add-Step "database_path" ($(if ($databasePathValid -and (Test-Path -LiteralPath $databasePath)) { "pass" } else { "fail" })) @{
        actual = $databasePath
        expectedRoot = $expectedDatabaseRoot
        exists = Test-Path -LiteralPath $databasePath
    }
    if (-not $databasePathValid) {
        throw "Database path is not under expected LOCALAPPDATA root: $databasePath"
    }
    if (-not (Test-Path -LiteralPath $databasePath)) {
        throw "Database file does not exist: $databasePath"
    }

    $closed = $false
    try {
        $closed = $appProcess.CloseMainWindow()
    }
    catch {
        $closed = $false
    }
    Start-Sleep -Seconds 5
    if (-not $appProcess.HasExited) {
        Stop-Process -Id $appProcess.Id -Force
    }

    $backendExited = Wait-ForBackendExit -ProcessId $healthResult.processId -TimeoutSeconds 15
    Add-Step "backend_exit_cleanup" ($(if ($backendExited) { "pass" } else { "fail" })) @{
        closeMainWindow = $closed
        checkedBackendProcessId = $healthResult.processId
    }
    if (-not $backendExited) {
        throw "Backend process remained after closing the desktop app."
    }

    $Report.passed = $true
}
catch {
    $Report.error = $_.Exception.Message
    $Report.passed = $false
}
finally {
    if ($appProcess) {
        Stop-Process -Id $appProcess.Id -Force -ErrorAction SilentlyContinue
    }
    if ($healthResult) {
        Stop-Process -Id $healthResult.processId -Force -ErrorAction SilentlyContinue
    }

    $Report.finishedAt = (Get-Date).ToString("o")
    $Report.steps = $Steps
    $jsonPath = Join-Path $ReportDir "clean-windows-validation.json"
    $json = ($Report | ConvertTo-Json -Depth 20) -replace "`r`n", "`n"
    Write-Utf8NoBom -Path $jsonPath -Value ($json + "`n")

    $textPath = Join-Path $ReportDir "clean-windows-validation.txt"
    $summaryLines = @(
        "Project Vault Clean Windows Validation"
        "Passed: $($Report.passed)"
        "Installer: $InstallerPath"
        "InstallDir: $InstallDir"
        "Report: $jsonPath"
        $(if ($Report.error) { "Error: $($Report.error)" } else { "Error:" })
    )
    Write-Utf8NoBom -Path $textPath -Value (($summaryLines -join "`n") + "`n")

    if ($Report.passed) {
        Write-Host "Project Vault clean Windows validation passed."
        Write-Host "Report: $jsonPath"
        exit 0
    }

    Write-Error "Project Vault clean Windows validation failed. Report: $jsonPath"
    exit 1
}
