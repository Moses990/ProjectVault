param(
    [string]$Version = "149.0.4022.96",
    [string]$Architecture = "x64",
    [string]$CacheDir = "D:\DevTools\ProjectVaultCache\WebView2",
    [string]$TargetDir = "$PSScriptRoot\..\desktop\src-tauri\binaries\webview2-fixed-runtime",
    [switch]$Force
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$fixedRuntime = @{
    Version = "149.0.4022.96"
    Architecture = "x64"
    Url = "https://msedge.sf.dl.delivery.mp.microsoft.com/filestreamingservice/files/aa0b6b26-294f-48c7-b900-ed4d8ab085f8/Microsoft.WebView2.FixedVersionRuntime.149.0.4022.96.x64.cab"
    Sha256 = "C4B3F527B5C6D29BAFFB6EC6B4E1EC7404F9417AC4153DAA57634B389203FDF4"
}

if ($Version -ne $fixedRuntime.Version -or $Architecture -ne $fixedRuntime.Architecture) {
    throw "Unsupported fixed runtime: version=$Version architecture=$Architecture. Update this script with the official Microsoft URL and SHA256 before changing versions."
}

$runtimeFolderName = "Microsoft.WebView2.FixedVersionRuntime.$Version.$Architecture"
$runtimePath = Join-Path $TargetDir $runtimeFolderName
$runtimeExe = Join-Path $runtimePath "msedgewebview2.exe"

if ((Test-Path -LiteralPath $runtimeExe) -and -not $Force) {
    Write-Host "WebView2 fixed runtime already prepared: $runtimePath"
    exit 0
}

New-Item -ItemType Directory -Force -Path $CacheDir | Out-Null
New-Item -ItemType Directory -Force -Path $TargetDir | Out-Null

$cabPath = Join-Path $CacheDir "Microsoft.WebView2.FixedVersionRuntime.$Version.$Architecture.cab"
if (-not (Test-Path -LiteralPath $cabPath) -or $Force) {
    Invoke-WebRequest -Uri $fixedRuntime.Url -OutFile $cabPath -UseBasicParsing
}

$actualHash = (Get-FileHash -LiteralPath $cabPath -Algorithm SHA256).Hash
if ($actualHash -ne $fixedRuntime.Sha256) {
    throw "WebView2 fixed runtime hash mismatch. Expected $($fixedRuntime.Sha256), got $actualHash."
}

if (Test-Path -LiteralPath $TargetDir) {
    Remove-Item -LiteralPath $TargetDir -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $TargetDir | Out-Null

& expand.exe $cabPath -F:* $TargetDir | Out-Null

if (-not (Test-Path -LiteralPath $runtimeExe)) {
    throw "Extracted fixed runtime is missing msedgewebview2.exe: $runtimeExe"
}

Write-Host "WebView2 fixed runtime prepared: $runtimePath"
