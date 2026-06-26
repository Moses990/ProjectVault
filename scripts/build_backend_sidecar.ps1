param(
    [switch]$SkipInstall,
    [switch]$Clean
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$BackendDir = Join-Path $ProjectRoot "backend"
$Python = Join-Path $BackendDir ".venv\Scripts\python.exe"
$BuildRequirements = Join-Path $BackendDir "requirements-build.txt"
$BinaryName = "project-vault-backend-x86_64-pc-windows-msvc"
$OutputDir = Join-Path $ProjectRoot "desktop\src-tauri\binaries"
$WorkDir = Join-Path $ProjectRoot "desktop\src-tauri\target\pyinstaller"
$SpecDir = $WorkDir
$OutputExe = Join-Path $OutputDir "$BinaryName.exe"

if (-not (Test-Path -LiteralPath $Python)) {
    throw "Backend venv Python not found: $Python"
}

if (-not (Test-Path -LiteralPath $BuildRequirements)) {
    throw "Build requirements file not found: $BuildRequirements"
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
New-Item -ItemType Directory -Force -Path $WorkDir | Out-Null

if (-not $SkipInstall) {
    & $Python -m pip install -r $BuildRequirements
}

if ($Clean) {
    $SpecFile = Join-Path $SpecDir "$BinaryName.spec"
    if (Test-Path -LiteralPath $SpecFile) {
        Remove-Item -LiteralPath $SpecFile -Force
    }
    if (Test-Path -LiteralPath $OutputExe) {
        Remove-Item -LiteralPath $OutputExe -Force
    }
}

Push-Location $BackendDir
try {
    & $Python -m PyInstaller `
        --onefile `
        --clean `
        --noconfirm `
        --name $BinaryName `
        --distpath $OutputDir `
        --workpath $WorkDir `
        --specpath $SpecDir `
        --paths $BackendDir `
        --hidden-import app.main `
        --hidden-import app.api.projects `
        --hidden-import app.api.search `
        --hidden-import app.api.providers `
        --hidden-import app.api.system `
        --hidden-import uvicorn.logging `
        --hidden-import uvicorn.loops.auto `
        --hidden-import uvicorn.protocols.http.auto `
        --hidden-import uvicorn.protocols.websockets.auto `
        app\run_server.py
}
finally {
    Pop-Location
}

if (-not (Test-Path -LiteralPath $OutputExe)) {
    throw "Expected sidecar executable was not produced: $OutputExe"
}

Write-Host "Built backend sidecar: $OutputExe"
