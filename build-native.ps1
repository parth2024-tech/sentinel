$ErrorActionPreference = "Stop"

Write-Host "Building SentinelOneShot (Tier 2)..." -ForegroundColor Cyan
$publishArgsOneShot = @(
    "publish",
    "native\SentinelOneShot\SentinelOneShot.csproj",
    "-c", "Release",
    "-r", "win-x64",
    "--self-contained", "true",
    "-p:PublishSingleFile=true",
    "-p:IncludeNativeLibrariesForSelfExtract=true",
    "-o", "artifacts\bin\SentinelOneShot"
)
dotnet @publishArgsOneShot
Write-Host "SentinelOneShot built successfully.`n" -ForegroundColor Green

Write-Host "Building SentinelAgent (Tier 1)..." -ForegroundColor Cyan
$publishArgsAgent = @(
    "publish",
    "native\SentinelAgent\SentinelAgent.csproj",
    "-c", "Release",
    "-r", "win-x64",
    "--self-contained", "true",
    "-p:PublishSingleFile=true",
    "-p:IncludeNativeLibrariesForSelfExtract=true",
    "-o", "artifacts\bin\SentinelAgent"
)
dotnet @publishArgsAgent
Write-Host "SentinelAgent built successfully.`n" -ForegroundColor Green

Write-Host "Building Installer (WiX)..." -ForegroundColor Cyan
$wixArgs = @(
    "build",
    "native\SentinelAgent\Installer\Installer.wixproj",
    "-c", "Release",
    "-o", "artifacts\bin\SentinelSetup.msi"
)
dotnet @wixArgs
Write-Host "Installer built successfully.`n" -ForegroundColor Green

Write-Host "All builds complete! Binaries located in artifacts\bin\`n" -ForegroundColor Green

# ── Code Signing ─────────────────────────────────────────────
$hasCert = (-not [string]::IsNullOrEmpty($env:SENTINEL_CERT_PATH)) -or
           (-not [string]::IsNullOrEmpty($env:SENTINEL_CERT_THUMBPRINT))

if ($hasCert) {
    Write-Host "Signing binaries..." -ForegroundColor Cyan
    & "$PSScriptRoot\native\sign-binaries.ps1"
} else {
    Write-Host "WARNING: No signing credentials found. Binaries are UNSIGNED." -ForegroundColor Yellow
    Write-Host "  Set SENTINEL_CERT_PATH + SENTINEL_CERT_PASSWORD (OV/PFX)" -ForegroundColor Yellow
    Write-Host "  or  SENTINEL_CERT_THUMBPRINT (EV/hardware token)" -ForegroundColor Yellow
    Write-Host "  Do NOT distribute unsigned binaries to end users.`n" -ForegroundColor Yellow
}
