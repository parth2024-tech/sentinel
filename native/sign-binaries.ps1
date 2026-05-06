# ============================================================
#  sign-binaries.ps1 — Code-sign all Sentinel binaries
#
#  Usage:
#    .\sign-binaries.ps1 -CertPath "C:\certs\sentinel.pfx" -CertPassword "password"
#    .\sign-binaries.ps1 -CertThumbprint "ABCDEF1234..." (for cert-store / EV token)
#
#  Environment variable overrides (for CI):
#    SENTINEL_CERT_PATH       → path to .pfx file
#    SENTINEL_CERT_PASSWORD   → pfx password
#    SENTINEL_CERT_THUMBPRINT → thumbprint for hardware-token / cert-store signing
#    SENTINEL_TIMESTAMP_URL   → override timestamp server (default: DigiCert)
#    SENTINEL_SIGN_PROFILE    → "production" or "development" (affects description)
# ============================================================

param(
    [string]$CertPath       = $env:SENTINEL_CERT_PATH,
    [string]$CertPassword   = $env:SENTINEL_CERT_PASSWORD,
    [string]$CertThumbprint = $env:SENTINEL_CERT_THUMBPRINT,
    [string]$TimestampUrl   = $(if ($env:SENTINEL_TIMESTAMP_URL) { $env:SENTINEL_TIMESTAMP_URL } else { "http://timestamp.digicert.com" }),
    [string]$SignProfile    = $(if ($env:SENTINEL_SIGN_PROFILE) { $env:SENTINEL_SIGN_PROFILE } else { "production" })
)

$ErrorActionPreference = "Stop"

# ── Resolve signtool ─────────────────────────────────────────
function Find-SignTool {
    # Check PATH first
    $inPath = Get-Command signtool.exe -ErrorAction SilentlyContinue
    if ($inPath) { return $inPath.Source }

    # Search Windows SDK directories
    $sdkPaths = @(
        "${env:ProgramFiles(x86)}\Windows Kits\10\bin",
        "${env:ProgramFiles}\Windows Kits\10\bin"
    )
    foreach ($sdk in $sdkPaths) {
        if (Test-Path $sdk) {
            $found = Get-ChildItem -Path $sdk -Recurse -Filter "signtool.exe" -ErrorAction SilentlyContinue |
                     Sort-Object { $_.Directory.Name } -Descending |
                     Select-Object -First 1
            if ($found) { return $found.FullName }
        }
    }

    throw "signtool.exe not found. Install the Windows SDK or add signtool to your PATH."
}

$signtool = Find-SignTool
Write-Host "Using signtool: $signtool" -ForegroundColor Gray

# ── Validate signing parameters ──────────────────────────────
$useThumbprint = -not [string]::IsNullOrEmpty($CertThumbprint)
$usePfx        = -not [string]::IsNullOrEmpty($CertPath)

if (-not $useThumbprint -and -not $usePfx) {
    throw "No signing credential provided. Supply either -CertPath/-CertPassword or -CertThumbprint."
}

if ($usePfx -and -not (Test-Path $CertPath)) {
    throw "Certificate file not found: $CertPath"
}

# ── Description tag ──────────────────────────────────────────
$descPrefix = if ($SignProfile -eq "development") { "[DEV BUILD] " } else { "" }

# ── Binaries to sign ─────────────────────────────────────────
$artifactRoot = Join-Path $PSScriptRoot "..\artifacts\bin"
$binaries = @(
    @{ Path = "$artifactRoot\SentinelOneShot\SentinelOneShot.exe"; Desc = "${descPrefix}Sentinel One-Shot Diagnostics" },
    @{ Path = "$artifactRoot\SentinelAgent\SentinelAgent.exe";     Desc = "${descPrefix}Sentinel Background Agent" },
    @{ Path = "$artifactRoot\SentinelSetup.msi";                   Desc = "${descPrefix}Sentinel Installer" }
)

# ── Sign each binary ─────────────────────────────────────────
$failCount = 0

foreach ($bin in $binaries) {
    $filePath = Resolve-Path $bin.Path -ErrorAction SilentlyContinue
    if (-not $filePath) {
        Write-Host "  SKIP  $($bin.Path) (not found)" -ForegroundColor Yellow
        continue
    }

    Write-Host "  SIGN  $filePath" -ForegroundColor Cyan

    $signArgs = @("sign", "/fd", "sha256", "/tr", $TimestampUrl, "/td", "sha256")

    if ($useThumbprint) {
        # EV / cert-store signing (hardware token plugged in)
        $signArgs += @("/sha1", $CertThumbprint)
    } else {
        # PFX file signing (standard OV)
        $signArgs += @("/f", $CertPath, "/p", $CertPassword)
    }

    $signArgs += @("/d", $bin.Desc, $filePath.Path)

    & $signtool @signArgs
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  FAIL  Signing failed for $filePath" -ForegroundColor Red
        $failCount++
    } else {
        Write-Host "  OK    Signed successfully" -ForegroundColor Green
    }
}

# ── Verify signatures ────────────────────────────────────────
Write-Host "`nVerifying signatures..." -ForegroundColor Cyan
foreach ($bin in $binaries) {
    $filePath = Resolve-Path $bin.Path -ErrorAction SilentlyContinue
    if (-not $filePath) { continue }

    & $signtool verify /pa /v $filePath.Path 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  FAIL  Verification failed: $filePath" -ForegroundColor Red
        $failCount++
    } else {
        Write-Host "  OK    $filePath" -ForegroundColor Green
    }
}

if ($failCount -gt 0) {
    throw "$failCount signing/verification failure(s). Do NOT distribute these binaries."
}

Write-Host "`nAll binaries signed and verified." -ForegroundColor Green
