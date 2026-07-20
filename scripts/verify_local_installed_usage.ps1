param(
    [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
    [string]$InstallerPath = "",
    [string]$ReportDir = "",
    [string]$InstallDir = "",
    [string]$FixtureRoot = "",
    [string]$MockAiProviderScript = "",
    [string]$IsolatedLocalAppData = "",
    [string]$FixtureApiKey = $env:PROJECT_VAULT_PHASE10_FIXTURE_KEY,
    [int]$StartupTimeoutSeconds = 45
)

$ErrorActionPreference = "Stop"

if ($IsolatedLocalAppData) {
    $env:LOCALAPPDATA = [System.IO.Path]::GetFullPath($IsolatedLocalAppData)
    New-Item -ItemType Directory -Force -Path $env:LOCALAPPDATA | Out-Null
}
if (-not $InstallDir) {
    $InstallDir = Join-Path $env:LOCALAPPDATA "Programs\ProjectVaultLocalUsageTest"
}
if (-not $FixtureApiKey) {
    throw "FixtureApiKey or PROJECT_VAULT_PHASE10_FIXTURE_KEY is required."
}

if (-not $InstallerPath) {
    $InstallerPath = Join-Path $ProjectRoot "desktop\src-tauri\target\release\bundle\nsis\Project Vault_2.0.0-beta.1_x64-setup.exe"
}
if (-not $ReportDir) {
    $ReportDir = Join-Path $ProjectRoot "release-validation\v2.0.0-beta.1"
}
if (-not $FixtureRoot) {
    $FixtureRoot = Join-Path $ReportDir "local-usage-fixture"
}
if (-not $MockAiProviderScript) {
    $MockAiProviderScript = Join-Path $ProjectRoot "scripts\mock_openai_provider.ps1"
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
                $hasShell = $html.Contains("Project Vault") -or $html.Contains("工作台")
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

function Invoke-ProjectVaultApi {
    param(
        [int]$Port,
        [string]$Method,
        [string]$Path,
        [object]$Body = $null
    )

    $uri = "http://127.0.0.1:$Port/api/v1$Path"
    $params = @{
        Uri = $uri
        Method = $Method
        TimeoutSec = 15
    }
    if ($null -ne $Body) {
        $params.ContentType = "application/json"
        $params.Body = ($Body | ConvertTo-Json -Depth 20)
    }
    return Invoke-RestMethod @params
}

function Write-Utf8NoBom {
    param(
        [string]$Path,
        [string]$Value
    )
    $encoding = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $Value, $encoding)
}

function Get-FreeTcpPort {
    $listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, 0)
    $listener.Start()
    try {
        return ([System.Net.IPEndPoint]$listener.LocalEndpoint).Port
    }
    finally {
        $listener.Stop()
    }
}

function Wait-ForTcpPort {
    param(
        [int]$Port,
        [int]$TimeoutSeconds = 10
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        $client = New-Object System.Net.Sockets.TcpClient
        try {
            $client.Connect("127.0.0.1", $Port)
            return
        }
        catch {
            Start-Sleep -Milliseconds 200
        }
        finally {
            $client.Close()
        }
    }
    throw "Mock AI Provider did not listen on port $Port."
}

function Stop-ProjectVaultRuntimeProcesses {
    param([string]$InstallRoot = "")

    if (-not $InstallRoot) {
        return
    }

    $installPrefix = Get-SafeInstallPrefix -InstallRoot $InstallRoot
    Get-Process -ErrorAction SilentlyContinue |
        Where-Object {
            try {
                $_.Path -and [System.IO.Path]::GetFullPath($_.Path).StartsWith($installPrefix, [System.StringComparison]::OrdinalIgnoreCase)
            }
            catch {
                $false
            }
        } |
        Stop-Process -Force -ErrorAction SilentlyContinue
}

function Remove-PathWithRetry {
    param(
        [string]$Path,
        [int]$Attempts = 8,
        [int]$DelayMilliseconds = 750
    )

    $fullPath = [System.IO.Path]::GetFullPath($Path)
    $rootPath = [System.IO.Path]::GetPathRoot($fullPath).TrimEnd('\')
    if ($fullPath.TrimEnd('\') -eq $rootPath) {
        throw "Refusing to recursively remove drive root: $fullPath"
    }

    for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
        if (-not (Test-Path -LiteralPath $fullPath)) {
            return
        }
        try {
            Remove-Item -LiteralPath $fullPath -Recurse -Force
            return
        }
        catch {
            if ($attempt -eq $Attempts) {
                throw
            }
            Stop-ProjectVaultRuntimeProcesses -InstallRoot $fullPath
            Start-Sleep -Milliseconds $DelayMilliseconds
        }
    }
}

function New-UsageFixture {
    param([string]$Root)

    if (Test-Path -LiteralPath $Root) {
        Remove-PathWithRetry -Path $Root
    }

    $projectDir = Join-Path $Root "PV-V1-Local-Acceptance"
    New-Item -ItemType Directory -Force -Path (Join-Path $projectDir "01_Drawings") | Out-Null
    New-Item -ItemType Directory -Force -Path (Join-Path $projectDir "02_Materials") | Out-Null
    New-Item -ItemType Directory -Force -Path (Join-Path $projectDir "03_Notes") | Out-Null

    Write-Utf8NoBom -Path (Join-Path $projectDir "01_Drawings\Level-01_Plan_V1.dwg") -Value "DWG placeholder for local acceptance."
    Write-Utf8NoBom -Path (Join-Path $projectDir "01_Drawings\Level-01_Plan_V2.dwg") -Value "DWG placeholder for local acceptance v2."
    Write-Utf8NoBom -Path (Join-Path $projectDir "02_Materials\Finish-Schedule.xlsx") -Value "material,spec`npaint,white"
    Write-Utf8NoBom -Path (Join-Path $projectDir "02_Materials\Lighting-Spec.pdf") -Value "PDF placeholder"
    Write-Utf8NoBom -Path (Join-Path $projectDir "03_Notes\site-note.txt") -Value "Phase 13 local usage searchable note."
    Write-Utf8NoBom -Path (Join-Path $projectDir "03_Notes\knowledge-brief.md") -Value "Core need: package-level customer circulation packagebeta route control.`nRisk: sample approval is time-sensitive."

    return [ordered]@{
        root = $Root
        projectDir = $projectDir
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
        $backupDir = Join-Path (Split-Path -Parent $DatabasePath) "phase13-local-usage-backup"
        New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
        $backupPath = Join-Path $backupDir ("project_vault_before_phase13_2_{0}.db" -f (Get-Date -Format "yyyyMMdd_HHmmss"))
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

$appProcess = $null
$healthResult = $null
$databaseBackup = $null
$mockAiProcess = $null
$providerId = $null

New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null

try {
    if (-not (Test-Path -LiteralPath $InstallerPath)) {
        throw "Installer not found: $InstallerPath"
    }
    if (-not (Test-Path -LiteralPath $MockAiProviderScript)) {
        throw "Mock AI Provider script not found: $MockAiProviderScript"
    }
    $installerFile = Get-Item -LiteralPath $InstallerPath
    Add-Step "installer_exists" "pass" @{
        path = $installerFile.FullName
        size = $installerFile.Length
        sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $installerFile.FullName).Hash
    }

    Stop-ProjectVaultRuntimeProcesses -InstallRoot $InstallDir

    $databasePath = Join-Path $env:LOCALAPPDATA "ProjectVault\database\project_vault.db"
    $databaseBackup = Copy-ExistingDatabaseAside -DatabasePath $databasePath
    Add-Step "existing_local_database_backed_up" "pass" $databaseBackup

    if (Test-Path -LiteralPath $InstallDir) {
        Remove-PathWithRetry -Path $InstallDir
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

    $fixture = New-UsageFixture -Root $FixtureRoot
    Add-Step "dedicated_fixture_created" "pass" $fixture

    $appProcess = Start-Process -FilePath $appExe.FullName -PassThru
    Add-Step "app_started" "pass" @{ processId = $appProcess.Id; processName = $appProcess.ProcessName }

    $window = Wait-ForMainWindow -ProcessId $appProcess.Id -TimeoutSeconds $StartupTimeoutSeconds
    Add-Step "app_main_webview_window" "pass" $window

    $healthResult = Wait-ForBackendHealth -TimeoutSeconds $StartupTimeoutSeconds -InstallRoot $InstallDir
    Add-Step "backend_health" "pass" $healthResult

    $frontend = Wait-ForFrontendRender -ProcessId $appProcess.Id -BackendPort $healthResult.port -TimeoutSeconds $StartupTimeoutSeconds
    Add-Step "frontend_render" "pass" $frontend

    $settingsBefore = Invoke-ProjectVaultApi -Port $healthResult.port -Method "GET" -Path "/settings"
    $settingsPut = Invoke-ProjectVaultApi -Port $healthResult.port -Method "PUT" -Path "/settings" -Body @{
        root_path = $fixture.root
        scan_interval = 60
        theme = "system"
    }
    $settingsAfter = Invoke-ProjectVaultApi -Port $healthResult.port -Method "GET" -Path "/settings"
    $settingsOk = $settingsPut.data.root_path -eq $fixture.root -and $settingsAfter.data.root_path -eq $fixture.root
    Add-Step "settings_root_path_saved" ($(if ($settingsOk) { "pass" } else { "fail" })) @{
        before = $settingsBefore.data
        after = $settingsAfter.data
    }
    if (-not $settingsOk) {
        throw "Settings root_path was not persisted."
    }

    $encodedRootPath = [System.Uri]::EscapeDataString($fixture.root)
    $candidates = Invoke-ProjectVaultApi -Port $healthResult.port -Method "GET" -Path "/projects/candidates?root_path=$encodedRootPath"
    $fixtureProjectDirResolved = [System.IO.Path]::GetFullPath($fixture.projectDir)
    $candidateMatch = @($candidates.data | Where-Object {
            [string]$candidatePath = $_.absolute_path
            $candidatePath -and
            [System.IO.Path]::GetFullPath($candidatePath).Equals(
                $fixtureProjectDirResolved,
                [System.StringComparison]::OrdinalIgnoreCase
            )
        })
    Add-Step "project_candidate_discovered" ($(if ($candidateMatch.Count -eq 1) { "pass" } else { "fail" })) @{
        candidateCount = @($candidates.data).Count
        fixtureProjectDir = $fixture.projectDir
        candidates = @($candidates.data | Select-Object -First 5)
    }
    if ($candidateMatch.Count -ne 1) {
        throw "Fixture project was not discovered as an initialization candidate."
    }

    $initialize = Invoke-ProjectVaultApi -Port $healthResult.port -Method "POST" -Path "/projects/initialize" -Body @{
        paths = @($fixture.projectDir)
        default_tags = @("phase13", "local-usage", "v1-final")
        confirmed_paths = @($fixture.projectDir)
    }
    $initializedIds = @($initialize.data.project_ids)
    $initializeOk = [int]$initialize.data.initialized_count -eq 1 -and $initializedIds.Count -eq 1
    Add-Step "project_initialized" ($(if ($initializeOk) { "pass" } else { "fail" })) $initialize.data
    if (-not $initializeOk) {
        throw "Fixture project was not initialized."
    }
    $fixture.projectId = [string]$initializedIds[0]

    $projects = Invoke-ProjectVaultApi -Port $healthResult.port -Method "GET" -Path "/projects?limit=20"
    $projectMatch = @($projects.data | Where-Object { $_.id -eq $fixture.projectId })
    Add-Step "projects_list_contains_fixture" ($(if ($projectMatch.Count -eq 1) { "pass" } else { "fail" })) @{
        total = $projects.meta.total
        fixtureProjectId = $fixture.projectId
    }
    if ($projectMatch.Count -ne 1) {
        throw "Fixture project was not listed."
    }

    $scan = Invoke-ProjectVaultApi -Port $healthResult.port -Method "POST" -Path "/scanner/scan" -Body @{
        project_id = $fixture.projectId
    }
    $scanOk = $scan.data.project_id -eq $fixture.projectId
    Add-Step "scanner_scan_fixture" ($(if ($scanOk) { "pass" } else { "fail" })) $scan.data
    if (-not $scanOk) {
        throw "Scanner did not scan the fixture project."
    }

    $metrics = Invoke-ProjectVaultApi -Port $healthResult.port -Method "GET" -Path "/dashboard/metrics"
    $metricsOk = [int]$metrics.data.project_total -ge 1 -and [int]$metrics.data.cad_total -ge 2 -and [int]$metrics.data.material_total -ge 2
    Add-Step "dashboard_metrics" ($(if ($metricsOk) { "pass" } else { "fail" })) $metrics.data
    if (-not $metricsOk) {
        throw "Dashboard metrics did not reflect the scanned fixture."
    }

    $overview = Invoke-ProjectVaultApi -Port $healthResult.port -Method "GET" -Path "/projects/$($fixture.projectId)/overview"
    $overviewOk = $overview.data.id -eq $fixture.projectId -and [int]$overview.data.file_count -ge 6
    Add-Step "project_detail_overview" ($(if ($overviewOk) { "pass" } else { "fail" })) $overview.data
    if (-not $overviewOk) {
        throw "Project overview did not expose the fixture details."
    }

    $files = Invoke-ProjectVaultApi -Port $healthResult.port -Method "GET" -Path "/projects/$($fixture.projectId)/files?limit=50"
    $filesOk = [int]$files.meta.total -ge 6
    Add-Step "project_detail_files" ($(if ($filesOk) { "pass" } else { "fail" })) @{
        total = $files.meta.total
    }
    if (-not $filesOk) {
        throw "Project files tab data was incomplete."
    }

    $drawings = Invoke-ProjectVaultApi -Port $healthResult.port -Method "GET" -Path "/projects/$($fixture.projectId)/drawings"
    $drawingsOk = @($drawings.data).Count -ge 2
    Add-Step "project_detail_drawings" ($(if ($drawingsOk) { "pass" } else { "fail" })) @{
        count = @($drawings.data).Count
        sample = @($drawings.data | Select-Object -First 3)
    }
    if (-not $drawingsOk) {
        throw "Project drawings tab data was incomplete."
    }

    $materials = Invoke-ProjectVaultApi -Port $healthResult.port -Method "GET" -Path "/projects/$($fixture.projectId)/materials"
    $materialsOk = @($materials.data).Count -ge 2
    Add-Step "project_detail_materials" ($(if ($materialsOk) { "pass" } else { "fail" })) @{
        count = @($materials.data).Count
        sample = @($materials.data | Select-Object -First 3)
    }
    if (-not $materialsOk) {
        throw "Project materials tab data was incomplete."
    }

    $cadCenter = Invoke-ProjectVaultApi -Port $healthResult.port -Method "GET" -Path "/drawings/center?limit=20&q=Plan"
    $cadOk = [int]$cadCenter.meta.total -ge 2
    Add-Step "cad_center" ($(if ($cadOk) { "pass" } else { "fail" })) @{
        total = $cadCenter.meta.total
        sample = @($cadCenter.data | Select-Object -First 3)
    }
    if (-not $cadOk) {
        throw "CAD Center did not return fixture drawings."
    }

    $search = Invoke-ProjectVaultApi -Port $healthResult.port -Method "GET" -Path "/search?q=PV-V1-Local-Acceptance&limit=20"
    $searchOk = @($search.data.items | Where-Object { $_.project_id -eq $fixture.projectId }).Count -gt 0
    Add-Step "search_ctrl_k_backend_path" ($(if ($searchOk) { "pass" } else { "fail" })) @{
        total = $search.data.total
        sample = @($search.data.items | Select-Object -First 5)
    }
    if (-not $searchOk) {
        throw "Search did not return the fixture project."
    }

    $history = Invoke-ProjectVaultApi -Port $healthResult.port -Method "GET" -Path "/history?project_id=$($fixture.projectId)&limit=20"
    $historyOk = [int]$history.meta.total -ge 1
    Add-Step "history_records" ($(if ($historyOk) { "pass" } else { "fail" })) @{
        total = $history.meta.total
        sample = @($history.data | Select-Object -First 3)
    }
    if (-not $historyOk) {
        throw "History did not include scan records for the fixture project."
    }

    $knowledgeFile = @($files.data | Where-Object { $_.relative_path -eq "03_Notes/knowledge-brief.md" } | Select-Object -First 1)
    $knowledgeFileOk = $knowledgeFile.Count -eq 1 -and [string]$knowledgeFile[0].id
    Add-Step "v2_knowledge_file_indexed" ($(if ($knowledgeFileOk) { "pass" } else { "fail" })) @{
        file = $knowledgeFile[0]
    }
    if (-not $knowledgeFileOk) {
        throw "V2 knowledge fixture file was not indexed."
    }

    $mockAiPort = Get-FreeTcpPort
    $mockAiArgs = @("-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "`"$MockAiProviderScript`"", "-Port", $mockAiPort)
    $mockAiProcess = Start-Process -FilePath (Get-Process -Id $PID).Path -ArgumentList $mockAiArgs -WindowStyle Hidden -PassThru
    Wait-ForTcpPort -Port $mockAiPort
    $provider = Invoke-ProjectVaultApi -Port $healthResult.port -Method "POST" -Path "/providers" -Body @{
        name = "Fixture AI"
        base_url = "http://127.0.0.1:$mockAiPort/v1"
        default_model = "fixture-model"
        api_key = $FixtureApiKey
        is_enabled = $true
    }
    $providerId = [string]$provider.data.id
    $providerOk = $provider.data.name -eq "Fixture AI" -and $provider.data.has_key -eq $true -and
        -not ($provider.data.PSObject.Properties.Name -contains "api_key") -and
        -not ($provider.data.PSObject.Properties.Name -contains "key_reference")
    Add-Step "v2_ai_provider_fixture" ($(if ($providerOk) { "pass" } else { "fail" })) $provider.data
    if (-not $providerOk) {
        throw "V2 fixture AI Provider was not created."
    }

    $models = Invoke-ProjectVaultApi -Port $healthResult.port -Method "GET" -Path "/providers/$providerId/models"
    $modelsOk = @($models.data.items | Where-Object { $_.id -eq "fixture-model" }).Count -eq 1
    Add-Step "v2_ai_provider_models" ($(if ($modelsOk) { "pass" } else { "fail" })) @{ total = $models.data.total }
    if (-not $modelsOk) {
        throw "V2 fixture AI Provider did not return the packaged model list."
    }

    $databaseBytes = [System.IO.File]::ReadAllBytes($databasePath)
    $databaseText = [System.Text.Encoding]::UTF8.GetString($databaseBytes)
    $managedReference = "wincred:$providerId"
    $credentialTarget = "ProjectVault.AIProvider:$providerId"
    $plaintextAbsent = -not $databaseText.Contains($FixtureApiKey)
    $managedReferencePresent = $databaseText.Contains($managedReference)
    Add-Step "provider_secret_not_plaintext_in_sqlite" ($(if ($plaintextAbsent -and $managedReferencePresent) { "pass" } else { "fail" })) @{
        plaintext_in_sqlite = -not $plaintextAbsent
        managed_reference_present = $managedReferencePresent
    }
    if (-not $plaintextAbsent -or -not $managedReferencePresent) {
        throw "Provider credential storage contract was not preserved."
    }

    $credentialList = (& cmdkey.exe /list 2>&1 | Out-String)
    $credentialPresent = $credentialList.Contains($credentialTarget)
    Add-Step "provider_credential_manager_entry" ($(if ($credentialPresent) { "pass" } else { "fail" })) @{ key_present = $credentialPresent }
    if (-not $credentialPresent) {
        throw "Provider credential was not stored in Windows Credential Manager."
    }

    $extract = Invoke-ProjectVaultApi -Port $healthResult.port -Method "POST" -Path "/projects/$($fixture.projectId)/knowledge/extract-text" -Body @{
        file_ids = @($knowledgeFile[0].id)
    }
    $source = @($extract.data.sources | Where-Object { $_.status -eq "ready" } | Select-Object -First 1)
    $extractOk = [int]$extract.data.ready -ge 1 -and $source.Count -eq 1 -and [string]$source[0].id
    Add-Step "v2_knowledge_extract_text" ($(if ($extractOk) { "pass" } else { "fail" })) $extract.data
    if (-not $extractOk) {
        throw "V2 knowledge text extraction did not produce a ready source."
    }

    $draft = Invoke-ProjectVaultApi -Port $healthResult.port -Method "POST" -Path "/projects/$($fixture.projectId)/knowledge/draft" -Body @{
        source_ids = @($source[0].id)
        mode = "ai"
        provider_id = $providerId
        model_id = "fixture-model"
    }
    $draftOk = $draft.data.status -eq "draft" -and
        [string]$draft.data.draft_id -and
        $draft.data.provider_name -eq "Fixture AI" -and
        $draft.data.model_name -eq "fixture-model" -and
        ([string]$draft.data.draft.summary).Contains("packagebeta")
    Add-Step "v2_knowledge_create_ai_draft" ($(if ($draftOk) { "pass" } else { "fail" })) $draft.data
    if (-not $draftOk) {
        throw "V2 AI knowledge draft was not created from the extracted source."
    }

    $apply = Invoke-ProjectVaultApi -Port $healthResult.port -Method "POST" -Path "/projects/$($fixture.projectId)/knowledge/apply" -Body @{
        draft_id = $draft.data.draft_id
        fields = @("summary", "core_needs", "special_reqs", "risks", "lessons", "tags", "evidence")
        confirm = $true
    }
    $projectJsonPath = Join-Path $fixture.projectDir "project.json"
    $projectJson = Get-Content -Raw -LiteralPath $projectJsonPath | ConvertFrom-Json
    $backupPath = Join-Path $fixture.projectDir $apply.data.project_json_backup
    $applyOk = $apply.data.applied -eq $true -and
        (Test-Path -LiteralPath $backupPath) -and
        ([string]$projectJson.ai.summary).Contains("packagebeta")
    Add-Step "v2_knowledge_apply_draft" ($(if ($applyOk) { "pass" } else { "fail" })) @{
        apply = $apply.data
        projectJsonBackupExists = Test-Path -LiteralPath $backupPath
        savedSummary = $projectJson.ai.summary
    }
    if (-not $applyOk) {
        throw "V2 knowledge apply did not update project.json and create backup."
    }

    $databaseTextAfterApply = [System.Text.Encoding]::UTF8.GetString(
        [System.IO.File]::ReadAllBytes([string]$healthResult.health.database.path)
    )
    $knowledgeFtsOk = $databaseTextAfterApply.Contains("knowledge:$($fixture.projectId)") -and
        $databaseTextAfterApply.Contains("packagebeta")
    Add-Step "v2_knowledge_fts_sync" ($(if ($knowledgeFtsOk) { "pass" } else { "fail" })) @{
        knowledge_entity_present = $databaseTextAfterApply.Contains("knowledge:$($fixture.projectId)")
        indexed_term_present = $databaseTextAfterApply.Contains("packagebeta")
    }
    if (-not $knowledgeFtsOk) {
        throw "V2 knowledge was not synchronized to FTS."
    }

    $historyBeforeProviderDelete = Invoke-ProjectVaultApi -Port $healthResult.port -Method "GET" -Path "/projects/$($fixture.projectId)/knowledge/history?limit=20&offset=0"
    $providerDelete = Invoke-ProjectVaultApi -Port $healthResult.port -Method "DELETE" -Path "/providers/$providerId"
    $knowledgeAfterProviderDelete = Invoke-ProjectVaultApi -Port $healthResult.port -Method "GET" -Path "/projects/$($fixture.projectId)/knowledge"
    $credentialListAfterDelete = (& cmdkey.exe /list 2>&1 | Out-String)
    $providerDeleteOk = $providerDelete.data.deleted -eq $true -and
        [int]$historyBeforeProviderDelete.data.total -ge 2 -and
        ([string]$knowledgeAfterProviderDelete.data.knowledge.summary).Contains("packagebeta") -and
        -not $credentialListAfterDelete.Contains($credentialTarget)
    Add-Step "provider_delete_keeps_knowledge_and_removes_credential" ($(if ($providerDeleteOk) { "pass" } else { "fail" })) @{
        deleted = $providerDelete.data.deleted
        knowledge_history_total = $historyBeforeProviderDelete.data.total
        key_present = $credentialListAfterDelete.Contains($credentialTarget)
    }
    if (-not $providerDeleteOk) {
        throw "Provider deletion did not preserve Knowledge or remove the managed credential."
    }
    $providerId = $null

    $backup = Invoke-ProjectVaultApi -Port $healthResult.port -Method "POST" -Path "/system/backup/create"
    $backupOk = [string]$backup.data.name -like "project_vault_*.db" -and [int64]$backup.data.size_bytes -gt 0
    Add-Step "backup_entry_point" ($(if ($backupOk) { "pass" } else { "fail" })) $backup.data
    if (-not $backupOk) {
        throw "Backup endpoint did not create a usable backup."
    }

    $restore = Invoke-ProjectVaultApi -Port $healthResult.port -Method "POST" -Path "/system/backup/restore" -Body @{
        name = $backup.data.name
        confirm = $true
    }
    $restoreOk = $restore.data.restored -eq $true
    Add-Step "restore_entry_point" ($(if ($restoreOk) { "pass" } else { "fail" })) $restore.data
    if (-not $restoreOk) {
        throw "Restore endpoint did not confirm restoration."
    }

    $databasePathFromHealth = [string]$healthResult.health.database.path
    $expectedRoot = Join-Path $env:LOCALAPPDATA "ProjectVault\database"
    $databasePathOk = $databasePathFromHealth.StartsWith($expectedRoot, [System.StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $databasePathFromHealth)
    Add-Step "database_path" ($(if ($databasePathOk) { "pass" } else { "fail" })) @{
        actual = $databasePathFromHealth
        expectedRoot = $expectedRoot
        exists = Test-Path -LiteralPath $databasePathFromHealth
    }
    if (-not $databasePathOk) {
        throw "Database path was not under the expected LOCALAPPDATA root."
    }

    $Report.passed = $true
}
catch {
    $Report.error = $_.Exception.Message
    $Report.passed = $false
}
finally {
    if ($providerId -and $healthResult) {
        try {
            $null = Invoke-ProjectVaultApi -Port $healthResult.port -Method "DELETE" -Path "/providers/$providerId"
        }
        catch {
            & cmdkey.exe "/delete:ProjectVault.AIProvider:$providerId" | Out-Null
        }
    }
    if ($mockAiProcess -and -not $mockAiProcess.HasExited) {
        Stop-Process -Id $mockAiProcess.Id -Force -ErrorAction SilentlyContinue
    }

    if ($appProcess) {
        try {
            $null = $appProcess.CloseMainWindow()
        }
        catch {
        }
        Start-Sleep -Seconds 5
        if (-not $appProcess.HasExited) {
            Stop-Process -Id $appProcess.Id -Force -ErrorAction SilentlyContinue
        }
    }

    $backendExited = $null
    if ($healthResult) {
        $backendExited = Wait-ForBackendExit -ProcessId $healthResult.processId -TimeoutSeconds 15
        Add-Step "backend_exit_cleanup" ($(if ($backendExited) { "pass" } else { "fail" })) @{
            checkedBackendProcessId = $healthResult.processId
        }
    }

    Stop-ProjectVaultRuntimeProcesses -InstallRoot $InstallDir

    if ($databaseBackup) {
        $restorePrevious = Restore-ExistingDatabase -Backup $databaseBackup
        Add-Step "previous_local_database_restored" "pass" $restorePrevious
    }

    $Report.finishedAt = (Get-Date).ToString("o")
    $Report.steps = $Steps
    $jsonPath = Join-Path $ReportDir "local-installed-usage-validation.json"
    $json = ($Report | ConvertTo-Json -Depth 20) -replace "`r`n", "`n"
    Write-Utf8NoBom -Path $jsonPath -Value ($json + "`n")

    $textPath = Join-Path $ReportDir "local-installed-usage-validation.txt"
    $summaryLines = @(
        "Project Vault Local Installed Usage Validation"
        "Passed: $($Report.passed)"
        "Installer: $InstallerPath"
        "InstallDir: $InstallDir"
        "FixtureRoot: $FixtureRoot"
        "Report: $jsonPath"
        $(if ($Report.error) { "Error: $($Report.error)" } else { "Error:" })
    )
    Write-Utf8NoBom -Path $textPath -Value (($summaryLines -join "`n") + "`n")

    if ($Report.passed -and ($null -eq $backendExited -or $backendExited)) {
        Write-Host "Project Vault local installed usage validation passed."
        Write-Host "Report: $jsonPath"
        exit 0
    }

    Write-Error "Project Vault local installed usage validation failed. Report: $jsonPath"
    exit 1
}
