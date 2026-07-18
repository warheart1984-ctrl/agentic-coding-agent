<#
.SYNOPSIS
Installs nova.exe system-wide on Windows. Adds to PATH so 'nova' works from any terminal.

.DESCRIPTION
- Copies nova.exe to %LOCALAPPDATA%\Nova\nova.exe
- Adds %LOCALAPPDATA%\Nova to your PATH (machine-wide or user-level)
- Creates .nova directory in your user profile
- Remembers your LLM config if provided

.PARAMETER ExePath
Path to nova.exe. Default: ..\dist\nova.exe relative to this script.

.PARAMETER Scope
PATH scope: 'User' (default) or 'Machine'. Machine requires admin.

.PARAMETER ApiKey
Optional: LLM API key to pre-configure.

.PARAMETER Provider
Optional: LLM provider (openai, ollama, custom). Default: ollama.

.EXAMPLE
.\scripts\install-nova.ps1
Installs nova.exe for the current user.

.EXAMPLE
.\scripts\install-nova.ps1 -Scope Machine -Provider openai -ApiKey sk-...
Installs system-wide with OpenAI pre-configured.

.EXAMPLE
.\scripts\install-nova.ps1 -Provider ollama
Installs with Ollama as default provider.
#>

param(
  [string]$ExePath = "",
  [ValidateSet("User", "Machine")]
  [string]$Scope = "User",
  [string]$ApiKey = "",
  [ValidateSet("openai", "ollama", "custom", "")]
  [string]$Provider = ""
)

$ErrorActionPreference = "Stop"

function Write-Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-OK($msg) { Write-Host "  ✓ $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "  ⚠ $msg" -ForegroundColor Yellow }

Write-Host "=== Nova Windows Installer ===" -ForegroundColor Cyan

# Step 1: Locate nova.exe
if (-not $ExePath) {
  $ScriptDir = Split-Path -Parent $PSCommandPath
  $ExePath = Join-Path (Join-Path $ScriptDir "..") "dist\nova.exe"
}
$ExePath = Resolve-Path $ExePath -ErrorAction Stop
Write-OK "Found nova.exe at: $ExePath"

# Step 2: Create install directory
$InstallDir = Join-Path $env:LOCALAPPDATA "Nova"
if (-not (Test-Path -LiteralPath $InstallDir)) {
  New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
  Write-OK "Created: $InstallDir"
} else {
  Write-OK "Directory exists: $InstallDir"
}

# Step 3: Copy executable
$TargetExe = Join-Path $InstallDir "nova.exe"
Copy-Item -Path $ExePath -Destination $TargetExe -Force
Write-OK "Copied nova.exe to: $TargetExe"

# Step 4: Add to PATH
$CurrentPath = [Environment]::GetEnvironmentVariable("Path", $Scope)
if ($CurrentPath -notlike "*$InstallDir*") {
  $NewPath = "$InstallDir;$CurrentPath"
  [Environment]::SetEnvironmentVariable("Path", $NewPath, $Scope)
  # Also update current session
  $env:Path = "$InstallDir;$env:Path"
  Write-OK "Added $InstallDir to $Scope PATH"
} else {
  Write-OK "$InstallDir already in $Scope PATH"
}

# Step 5: Create .nova directory
$NovaDir = Join-Path $env:USERPROFILE ".nova"
if (-not (Test-Path -LiteralPath $NovaDir)) {
  New-Item -ItemType Directory -Path $NovaDir -Force | Out-Null
  Write-OK "Created: $NovaDir"
}

# Step 6: Create user config
$ConfigPath = Join-Path $NovaDir "config.json"
$Config = @{}
if (Test-Path -LiteralPath $ConfigPath) {
  try { $Config = Get-Content -Path $ConfigPath -Raw | ConvertFrom-Json } catch {}
}
if ($Provider) { $Config.LLM_PROVIDER = $Provider }
if ($ApiKey) { $Config.LLM_API_KEY = $ApiKey }
$Config | ConvertTo-Json | Set-Content -Path $ConfigPath -Encoding utf8
Write-OK "Config written to: $ConfigPath"

# Step 7: Create portable .cmd launcher (as backup)
$CmdLauncher = @"
@echo off
"%LOCALAPPDATA%\Nova\nova.exe" %*
"@
$CmdPath = Join-Path $InstallDir "nova.cmd"
Set-Content -Path $CmdPath -Value $CmdLauncher -Encoding ascii
Write-OK "Created launcher: $CmdPath"

# Step 8: Verify
Write-Step "Verification"
Start-Sleep -Seconds 1
try {
  $version = & $TargetExe --help 2>&1 | Out-String
  Write-OK "nova.exe responds to --help"
} catch {
  Write-Warn "Could not verify nova.exe. Check path."
}

Write-Host "`n=== Installation Complete ===" -ForegroundColor Cyan
Write-Host "Open a NEW terminal and run:" -ForegroundColor White
Write-Host "  nova --help" -ForegroundColor Gray
Write-Host "  nova --interactive" -ForegroundColor Gray
Write-Host "  nova ""add sorting to src/utils.ts""" -ForegroundColor Gray
