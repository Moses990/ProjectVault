param(
    [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
    [string]$InstallerPath = "",
    [string]$ReportDir = "",
    [string]$InstallDir = "$env:LOCALAPPDATA\Programs\ProjectVaultPhase13QualityTest",
    [string]$FixtureRoot = "",
    [int]$StartupTimeoutSeconds = 45
)

$ErrorActionPreference = "Stop"

if (-not $InstallerPath) {
    $InstallerPath = Join-Path $ProjectRoot "desktop\src-tauri\target\release\bundle\nsis\Project Vault_2.0.0-beta.1_x64-setup.exe"
}
if (-not $ReportDir) {
    $ReportDir = Join-Path $ProjectRoot "release-validation\v2.0.0-beta.1"
}
if (-not $FixtureRoot) {
    $FixtureRoot = Join-Path $ReportDir "phase13-quality-fixture"
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

function Get-SafeInstallPrefix {
    param([string]$InstallRoot)

    $fullRoot = [System.IO.Path]::GetFullPath($InstallRoot).TrimEnd('\')
    $driveRoot = [System.IO.Path]::GetPathRoot($fullRoot).TrimEnd('\')
    if (-not $fullRoot -or $fullRoot -eq $driveRoot) {
        throw "Refusing to use drive root as validation install directory: $InstallRoot"
    }
    return $fullRoot + [System.IO.Path]::DirectorySeparatorChar
}

function Invoke-ProjectVaultApi {
    param(
        [int]$Port,
        [string]$Method,
        [string]$Path,
        [object]$Body = $null,
        [int[]]$AllowedStatusCodes = @(200)
    )

    $uri = "http://127.0.0.1:$Port/api/v1$Path"
    try {
        $params = @{
            Uri = $uri
            Method = $Method
            TimeoutSec = 15
        }
        if ($null -ne $Body) {
            $params.ContentType = "application/json"
            $params.Body = ($Body | ConvertTo-Json -Depth 20)
        }
        $result = Invoke-RestMethod @params
        if ($AllowedStatusCodes -notcontains 200) {
            throw "Expected status $($AllowedStatusCodes -join ',') but request returned 200."
        }
        return [ordered]@{
            statusCode = 200
            body = $result
        }
    }
    catch {
        $response = $_.Exception.Response
        if ($null -eq $response) {
            throw
        }
        $statusCode = [int]$response.StatusCode
        $reader = New-Object System.IO.StreamReader($response.GetResponseStream())
        $content = $reader.ReadToEnd()
        if ($AllowedStatusCodes -contains $statusCode) {
            return [ordered]@{
                statusCode = $statusCode
                body = $content
            }
        }
        throw "Request $Method $uri failed with status ${statusCode}: $content"
    }
}

function Wait-ForBackendHealth {
    param(
        [int]$TimeoutSeconds,
        [string]$InstallRoot
    )

    $installPrefix = Get-SafeInstallPrefix -InstallRoot $InstallRoot
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        $backendProcesses = Get-Process -ErrorAction SilentlyContinue |
            Where-Object {
                $_.ProcessName -like "project-vault-backend*" -and
                $_.Path -and
                [System.IO.Path]::GetFullPath($_.Path).StartsWith($installPrefix, [System.StringComparison]::OrdinalIgnoreCase)
            }

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
                $hasShell = $html.Contains("Project Vault V1") -or $html.Contains("Dashboard")
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

function Wait-ForBackendExit {
    param(
        [int]$ProcessId,
        [int]$TimeoutSeconds
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if (-not (Get-Process -Id $ProcessId -ErrorAction SilentlyContinue)) {
            return $true
        }
        Start-Sleep -Milliseconds 500
    }
    return $false
}

function Write-Utf8NoBom {
    param(
        [string]$Path,
        [string]$Value
    )
    $encoding = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $Value, $encoding)
}

function New-QualityFixture {
    param([string]$Root)

    if (Test-Path -LiteralPath $Root) {
        Remove-Item -LiteralPath $Root -Recurse -Force
    }

    $validProjectDir = Join-Path $Root "PV-V1-Quality-Acceptance"
    $damagedProjectDir = Join-Path $Root "PV-V1-Damaged-Project"
    New-Item -ItemType Directory -Force -Path (Join-Path $validProjectDir "01_Drawings") | Out-Null
    New-Item -ItemType Directory -Force -Path (Join-Path $validProjectDir "02_Materials") | Out-Null
    New-Item -ItemType Directory -Force -Path $damagedProjectDir | Out-Null

    Write-Utf8NoBom -Path (Join-Path $validProjectDir "01_Drawings\Reflected-Ceiling_FINAL.dwg") -Value "DWG placeholder."
    Write-Utf8NoBom -Path (Join-Path $validProjectDir "02_Materials\Stone-Schedule.xlsx") -Value "material,spec`nstone,gray"
    Write-Utf8NoBom -Path (Join-Path $validProjectDir "quality-note.txt") -Value "Phase 13 release quality searchable note."
    Write-Utf8NoBom -Path (Join-Path $damagedProjectDir "project.json") -Value "{ invalid json"

    return [ordered]@{
        root = $Root
        validProjectDir = $validProjectDir
        damagedProjectDir = $damagedProjectDir
        projectId = ""
    }
}

function Copy-ExistingDatabaseAside {
    param([string]$DatabasePath)

    $backup = [ordered]@{
        databasePath = $DatabasePath
        existed = $false
        backupPath = ""
    }

    if (Test-Path -LiteralPath $DatabasePath) {
        $backup.existed = $true
        $backupDir = Join-Path (Split-Path -Parent $DatabasePath) "phase13-quality-backup"
        New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
        $backupPath = Join-Path $backupDir ("project_vault_before_phase13_3_{0}.db" -f (Get-Date -Format "yyyyMMdd_HHmmss"))
        Copy-Item -LiteralPath $DatabasePath -Destination $backupPath -Force
        $backup.backupPath = $backupPath
    }

    foreach ($suffix in @("", "-wal", "-shm")) {
        $candidate = "$DatabasePath$suffix"
        if (Test-Path -LiteralPath $candidate) {
            Remove-Item -LiteralPath $candidate -Force
        }
    }

    return $backup
}

function Restore-ExistingDatabase {
    param([object]$Backup)

    foreach ($suffix in @("", "-wal", "-shm")) {
        $candidate = "$($Backup.databasePath)$suffix"
        if (Test-Path -LiteralPath $candidate) {
            Remove-Item -LiteralPath $candidate -Force
        }
    }

    if ($Backup.existed -and $Backup.backupPath -and (Test-Path -LiteralPath $Backup.backupPath)) {
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Backup.databasePath) | Out-Null
        Copy-Item -LiteralPath $Backup.backupPath -Destination $Backup.databasePath -Force
        return [ordered]@{
            restored = $true
            databasePath = $Backup.databasePath
            backupPath = $Backup.backupPath
        }
    }

    return [ordered]@{
        restored = $false
        databasePath = $Backup.databasePath
        reason = "no_previous_database"
    }
}

function Find-AppExecutable {
    param([string]$Root)

    if (-not (Test-Path -LiteralPath $Root)) {
        return $null
    }

    return Get-ChildItem -LiteralPath $Root -Recurse -File -Filter "*.exe" |
        Where-Object {
            $_.Name -notlike "*backend*" -and
            $_.Name -notlike "unins*" -and
            $_.Name -notlike "*uninstall*"
        } |
        Select-Object -First 1
}

function Find-Uninstaller {
    param([string]$Root)

    if (-not (Test-Path -LiteralPath $Root)) {
        return $null
    }

    return Get-ChildItem -LiteralPath $Root -Recurse -File -Filter "*.exe" |
        Where-Object {
            $_.Name -like "unins*" -or $_.Name -like "*uninstall*"
        } |
        Select-Object -First 1
}

function Install-ProjectVault {
    param(
        [string]$Installer,
        [string]$Target
    )

    if (Test-Path -LiteralPath $Target) {
        Remove-Item -LiteralPath $Target -Recurse -Force
    }
    New-Item -ItemType Directory -Force -Path $Target | Out-Null

    $args = "/S /D=$Target"
    $process = Start-Process -FilePath $Installer -ArgumentList $args -Wait -PassThru
    if ($process.ExitCode -ne 0) {
        throw "Installer exited with code $($process.ExitCode)."
    }
    return [ordered]@{
        exitCode = $process.ExitCode
        args = $args
        target = $Target
    }
}

function Stop-ProjectVaultProcesses {
    param([string]$InstallRoot)

    $installPrefix = Get-SafeInstallPrefix -InstallRoot $InstallRoot
    Get-Process -ErrorAction SilentlyContinue |
        Where-Object {
            $_.Path -and
            [System.IO.Path]::GetFullPath($_.Path).StartsWith($installPrefix, [System.StringComparison]::OrdinalIgnoreCase)
        } |
        Stop-Process -Force -ErrorAction SilentlyContinue
}

function Start-And-SmokeApp {
    param(
        [string]$AppPath,
        [string]$InstallRoot
    )

    $appProcess = Start-Process -FilePath $AppPath -PassThru
    try {
        $window = Wait-ForMainWindow -ProcessId $appProcess.Id -TimeoutSeconds $StartupTimeoutSeconds
        $health = Wait-ForBackendHealth -TimeoutSeconds $StartupTimeoutSeconds -InstallRoot $InstallRoot
        $frontend = Wait-ForFrontendRender -ProcessId $appProcess.Id -BackendPort $health.port -TimeoutSeconds $StartupTimeoutSeconds
        return [ordered]@{
            appProcess = $appProcess
            window = $window
            health = $health
            frontend = $frontend
        }
    }
    catch {
        if ($appProcess -and -not $appProcess.HasExited) {
            Stop-Process -Id $appProcess.Id -Force -ErrorAction SilentlyContinue
        }
        throw
    }
}

function Stop-SmokedApp {
    param([object]$Smoke)

    $appProcess = $Smoke.appProcess
    $health = $Smoke.health
    $closed = $false
    if ($appProcess) {
        try {
            $closed = $appProcess.CloseMainWindow()
        }
        catch {
            $closed = $false
        }
        Start-Sleep -Seconds 5
        if (-not $appProcess.HasExited) {
            Stop-Process -Id $appProcess.Id -Force -ErrorAction SilentlyContinue
        }
    }
    $backendExited = $true
    if ($health) {
        $backendExited = Wait-ForBackendExit -ProcessId $health.processId -TimeoutSeconds 15
    }
    return [ordered]@{
        closeMainWindow = $closed
        backendExited = $backendExited
        checkedBackendProcessId = $health.processId
    }
}

$Steps = @()
$Report = [ordered]@{
    startedAt = (Get-Date).ToString("o")
    projectRoot = $ProjectRoot
    installerPath = $InstallerPath
    installDir = $InstallDir
    fixtureRoot = $FixtureRoot
    passed = $false
    steps = $Steps
}

$databaseBackup = $null
$smoke = $null

New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null

try {
    if (-not (Test-Path -LiteralPath $InstallerPath)) {
        throw "Installer not found: $InstallerPath"
    }
    $installerFile = Get-Item -LiteralPath $InstallerPath
    Add-Step "installer_exists" "pass" @{
        path = $installerFile.FullName
        size = $installerFile.Length
        sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $installerFile.FullName).Hash
    }

    Stop-ProjectVaultProcesses -InstallRoot $InstallDir

    $databasePath = Join-Path $env:LOCALAPPDATA "ProjectVault\database\project_vault.db"
    $databaseBackup = Copy-ExistingDatabaseAside -DatabasePath $databasePath
    Add-Step "existing_local_database_backed_up" "pass" $databaseBackup

    $installResult = Install-ProjectVault -Installer $InstallerPath -Target $InstallDir
    Add-Step "initial_install" "pass" $installResult

    $appExe = Find-AppExecutable -Root $InstallDir
    if (-not $appExe) {
        throw "Installed Project Vault executable was not found under $InstallDir."
    }
    Add-Step "app_executable_found" "pass" @{ path = $appExe.FullName; size = $appExe.Length }

    $uninstaller = Find-Uninstaller -Root $InstallDir
    Add-Step "uninstaller_found" ($(if ($uninstaller) { "pass" } else { "fail" })) @{
        path = $(if ($uninstaller) { $uninstaller.FullName } else { "" })
    }
    if (-not $uninstaller) {
        throw "Uninstaller executable was not found under $InstallDir."
    }

    $smoke = Start-And-SmokeApp -AppPath $appExe.FullName -InstallRoot $InstallDir
    Add-Step "initial_launch" "pass" @{
        window = $smoke.window
        backend = $smoke.health
        frontend = $smoke.frontend
    }

    $frontendLoopback = ([string]$smoke.frontend.uri).StartsWith("http://127.0.0.1:")
    $backendLoopback = ([string]$smoke.health.uri).StartsWith("http://127.0.0.1:")
    Add-Step "offline_launch_loopback_only" ($(if ($frontendLoopback -and $backendLoopback) { "pass" } else { "fail" })) @{
        note = "Host network adapters are not disabled by this script; the packaged app is verified to launch using only local loopback backend/frontend endpoints."
        backendUri = $smoke.health.uri
        frontendUri = $smoke.frontend.uri
    }
    if (-not ($frontendLoopback -and $backendLoopback)) {
        throw "Packaged app did not launch using loopback-only backend/frontend endpoints."
    }

    $fixture = New-QualityFixture -Root $FixtureRoot
    Add-Step "dedicated_fixture_created" "pass" $fixture

    $invalidRoot = Join-Path $FixtureRoot "missing-root-path"
    $invalidRootResult = Invoke-ProjectVaultApi -Port $smoke.health.port -Method "PUT" -Path "/settings" -Body @{
        root_path = $invalidRoot
        scan_interval = 60
        theme = "system"
    } -AllowedStatusCodes @(400)
    $invalidRootOk = $invalidRootResult.statusCode -eq 400
    Add-Step "invalid_root_path_rejected" ($(if ($invalidRootOk) { "pass" } else { "fail" })) @{
        statusCode = $invalidRootResult.statusCode
        response = $invalidRootResult.body
    }
    if (-not $invalidRootOk) {
        throw "Invalid root_path was not rejected with HTTP 400."
    }

    $inaccessibleProbe = "C:\System Volume Information"
    $inaccessibleResult = Invoke-ProjectVaultApi -Port $smoke.health.port -Method "GET" -Path "/projects/candidates?root_path=$([System.Uri]::EscapeDataString($inaccessibleProbe))" -AllowedStatusCodes @(400, 403)
    $inaccessibleOk = $inaccessibleResult.statusCode -eq 400 -or $inaccessibleResult.statusCode -eq 403
    Add-Step "inaccessible_directory_controlled_error" ($(if ($inaccessibleOk) { "pass" } else { "fail" })) @{
        path = $inaccessibleProbe
        statusCode = $inaccessibleResult.statusCode
        response = $inaccessibleResult.body
    }
    if (-not $inaccessibleOk) {
        throw "Inaccessible directory did not return a controlled 400/403 response."
    }

    $settings = Invoke-ProjectVaultApi -Port $smoke.health.port -Method "PUT" -Path "/settings" -Body @{
        root_path = $fixture.root
        scan_interval = 60
        theme = "system"
    }
    $settingsOk = $settings.body.data.root_path -eq $fixture.root
    Add-Step "settings_root_path_saved" ($(if ($settingsOk) { "pass" } else { "fail" })) $settings.body.data
    if (-not $settingsOk) {
        throw "Settings root_path was not persisted."
    }

    $candidates = Invoke-ProjectVaultApi -Port $smoke.health.port -Method "GET" -Path "/projects/candidates?root_path=$([System.Uri]::EscapeDataString($fixture.root))"
    $validProjectResolved = [System.IO.Path]::GetFullPath($fixture.validProjectDir)
    $candidateMatch = @($candidates.body.data | Where-Object {
            [string]$candidatePath = $_.absolute_path
            $candidatePath -and
            [System.IO.Path]::GetFullPath($candidatePath).Equals(
                $validProjectResolved,
                [System.StringComparison]::OrdinalIgnoreCase
            )
        })
    Add-Step "candidate_discovery_skips_existing_project_json" ($(if ($candidateMatch.Count -eq 1) { "pass" } else { "fail" })) @{
        candidateCount = @($candidates.body.data).Count
        validProjectDir = $fixture.validProjectDir
        damagedProjectDir = $fixture.damagedProjectDir
    }
    if ($candidateMatch.Count -ne 1) {
        throw "Valid fixture project was not discovered as an initialization candidate."
    }

    $initialize = Invoke-ProjectVaultApi -Port $smoke.health.port -Method "POST" -Path "/projects/initialize" -Body @{
        paths = @($fixture.validProjectDir)
        default_tags = @("phase13", "release-quality", "v1-checkpoint")
    }
    $initializedIds = @($initialize.body.data.project_ids)
    $initializeOk = [int]$initialize.body.data.initialized_count -eq 1 -and $initializedIds.Count -eq 1
    Add-Step "project_initialized" ($(if ($initializeOk) { "pass" } else { "fail" })) $initialize.body.data
    if (-not $initializeOk) {
        throw "Fixture project was not initialized."
    }
    $fixture.projectId = [string]$initializedIds[0]

    $scan = Invoke-ProjectVaultApi -Port $smoke.health.port -Method "POST" -Path "/scanner/scan" -Body @{
        project_id = $fixture.projectId
    }
    $scanOk = $scan.body.data.project_id -eq $fixture.projectId
    Add-Step "valid_project_scan" ($(if ($scanOk) { "pass" } else { "fail" })) $scan.body.data
    if (-not $scanOk) {
        throw "Valid fixture project scan failed."
    }

    Write-Utf8NoBom -Path (Join-Path $fixture.validProjectDir "project.json") -Value "{ damaged project json"
    $damagedScan = Invoke-ProjectVaultApi -Port $smoke.health.port -Method "POST" -Path "/scanner/scan" -Body @{
        project_id = $fixture.projectId
    } -AllowedStatusCodes @(404)
    Add-Step "damaged_project_json_controlled_error" ($(if ($damagedScan.statusCode -eq 404) { "pass" } else { "fail" })) @{
        projectId = $fixture.projectId
        statusCode = $damagedScan.statusCode
        response = $damagedScan.body
    }
    if ($damagedScan.statusCode -ne 404) {
        throw "Damaged project.json did not return a controlled scanner error."
    }

    $cleanup = Stop-SmokedApp -Smoke $smoke
    $smoke = $null
    Add-Step "backend_exit_cleanup_after_initial_launch" ($(if ($cleanup.backendExited) { "pass" } else { "fail" })) $cleanup
    if (-not $cleanup.backendExited) {
        throw "Backend process remained after closing the desktop app."
    }

    $uninstaller = Find-Uninstaller -Root $InstallDir
    $uninstallProcess = Start-Process -FilePath $uninstaller.FullName -ArgumentList "/S" -Wait -PassThru
    Start-Sleep -Seconds 3
    $remainingAppExe = Find-AppExecutable -Root $InstallDir
    $uninstallOk = $uninstallProcess.ExitCode -eq 0 -and -not $remainingAppExe
    Add-Step "silent_uninstall" ($(if ($uninstallOk) { "pass" } else { "fail" })) @{
        exitCode = $uninstallProcess.ExitCode
        installDir = $InstallDir
        appExecutableStillPresent = [bool]$remainingAppExe
    }
    if (-not $uninstallOk) {
        throw "Silent uninstall failed or app executable remained."
    }

    $reinstallResult = Install-ProjectVault -Installer $InstallerPath -Target $InstallDir
    Add-Step "reinstall" "pass" $reinstallResult

    $reinstalledAppExe = Find-AppExecutable -Root $InstallDir
    if (-not $reinstalledAppExe) {
        throw "Reinstalled Project Vault executable was not found under $InstallDir."
    }
    $smoke = Start-And-SmokeApp -AppPath $reinstalledAppExe.FullName -InstallRoot $InstallDir
    Add-Step "reinstall_launch" "pass" @{
        window = $smoke.window
        backend = $smoke.health
        frontend = $smoke.frontend
    }

    $cleanup = Stop-SmokedApp -Smoke $smoke
    $smoke = $null
    Add-Step "backend_exit_cleanup_after_reinstall" ($(if ($cleanup.backendExited) { "pass" } else { "fail" })) $cleanup
    if (-not $cleanup.backendExited) {
        throw "Backend process remained after closing the reinstalled desktop app."
    }

    $requiredDocs = @(
        "docs\release\V1_RELEASE_MANIFEST.md",
        "docs\release\CLEAN_WINDOWS_VALIDATION.md",
        "docs\release\LOCAL_INSTALLED_USAGE_VALIDATION.md",
        "docs\release\USER_GUIDE.md",
        "docs\release\ROLLBACK_REBUILD.md"
    )
    $docResults = @()
    foreach ($doc in $requiredDocs) {
        $path = Join-Path $ProjectRoot $doc
        $exists = Test-Path -LiteralPath $path
        $length = 0
        if ($exists) {
            $length = (Get-Item -LiteralPath $path).Length
        }
        $docResults += [ordered]@{
            path = $path
            exists = $exists
            size = $length
        }
    }
    $docsOk = @($docResults | Where-Object { -not $_.exists -or $_.size -le 0 }).Count -eq 0
    Add-Step "release_docs_present" ($(if ($docsOk) { "pass" } else { "fail" })) $docResults
    if (-not $docsOk) {
        throw "One or more release documents are missing or empty."
    }

    $Report.passed = $true
}
catch {
    $Report.error = $_.Exception.Message
    $Report.passed = $false
}
finally {
    if ($smoke) {
        try {
            $cleanup = Stop-SmokedApp -Smoke $smoke
            Add-Step "backend_exit_cleanup_after_error" ($(if ($cleanup.backendExited) { "pass" } else { "fail" })) $cleanup
        }
        catch {
            Add-Step "backend_exit_cleanup_after_error" "fail" @{ error = $_.Exception.Message }
        }
    }

    Stop-ProjectVaultProcesses -InstallRoot $InstallDir

    if ($databaseBackup) {
        $restorePrevious = Restore-ExistingDatabase -Backup $databaseBackup
        Add-Step "previous_local_database_restored" "pass" $restorePrevious
    }

    $Report.finishedAt = (Get-Date).ToString("o")
    $Report.steps = $Steps
    $jsonPath = Join-Path $ReportDir "phase13-release-quality-validation.json"
    $Report | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $jsonPath -Encoding UTF8

    $textPath = Join-Path $ReportDir "phase13-release-quality-validation.txt"
    @(
        "Project Vault Phase 13 Release Quality Validation"
        "Passed: $($Report.passed)"
        "Installer: $InstallerPath"
        "InstallDir: $InstallDir"
        "FixtureRoot: $FixtureRoot"
        "Report: $jsonPath"
        "Error: $($Report.error)"
    ) | Set-Content -LiteralPath $textPath -Encoding UTF8

    if ($Report.passed) {
        Write-Host "Project Vault Phase 13 release quality validation passed."
        Write-Host "Report: $jsonPath"
        exit 0
    }

    Write-Error "Project Vault Phase 13 release quality validation failed. Report: $jsonPath"
    exit 1
}
