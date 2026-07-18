<#
.SYNOPSIS
Builds nova.exe — standalone Windows executable for Nova.
Uses esbuild to bundle all JS into a single file, then Node.js SEA for the executable.

.DESCRIPTION
1. Compiles TypeScript to JavaScript (dist/)
2. Bundles with esbuild into a single file
3. Creates SEA config and generates blob
4. Injects blob into a copy of node.exe -> nova.exe

.PARAMETER SkipTsc
Skip TypeScript compilation.

.PARAMETER OutputDir
Output directory for the executable. Default: dist/

.EXAMPLE
.\scripts\build-exe.ps1 -SkipTsc
#>

param(
  [switch]$SkipTsc,
  [string]$OutputDir = "dist"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Resolve-Path "$PSScriptRoot\.."

Write-Host "=== Nova Windows Executable Builder ===" -ForegroundColor Cyan

if (-not $SkipTsc) {
  Write-Host "`n[1/5] Compiling TypeScript..." -ForegroundColor Yellow
  Push-Location $ProjectRoot
  try { & "npx.cmd" tsc 2>&1; if ($LASTEXITCODE -ne 0) { exit 1 } } finally { Pop-Location }
  Write-Host "  OK" -ForegroundColor Green
} else {
  Write-Host "`n[1/5] Skipping TypeScript compilation." -ForegroundColor Gray
}

Write-Host "`n[2/5] Bundling with esbuild..." -ForegroundColor Yellow
Push-Location $ProjectRoot
try {
  & "npx.cmd" esbuild dist/src/cli/nova.js --bundle --platform=node --outfile=dist/nova-bundle.js 2>&1
  if ($LASTEXITCODE -ne 0) { exit 1 }
} finally { Pop-Location }
Write-Host "  OK" -ForegroundColor Green

Write-Host "`n[3/5] Generating SEA blob..." -ForegroundColor Yellow
Push-Location (Join-Path $ProjectRoot $OutputDir)
try {
  $SeaConfig = @{ main = "nova-bundle.js"; output = "nova-sea.blob"; disableExperimentalSEAWarning = $true }
  $SeaConfig | ConvertTo-Json | Set-Content -Path "sea-config.json" -Encoding utf8
  & "node" --experimental-sea-config "sea-config.json" 2>&1
  if ($LASTEXITCODE -ne 0) { exit 1 }
} finally { Pop-Location }
Write-Host "  OK" -ForegroundColor Green

Write-Host "`n[4/5] Creating nova.exe..." -ForegroundColor Yellow
$OutputFull = Join-Path $ProjectRoot $OutputDir
$NodeExe = (Get-Command node).Source
$NovaExe = Join-Path $OutputFull "nova.exe"
Copy-Item -Path $NodeExe -Destination $NovaExe -Force
& "npx.cmd" --yes --package postject -c "postject `"$NovaExe`" NODE_SEA_BLOB `"$OutputFull\nova-sea.blob`" --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2" 2>&1
if ($LASTEXITCODE -ne 0) { exit 1 }
Write-Host "  OK" -ForegroundColor Green

Write-Host "`n[5/5] Verifying..." -ForegroundColor Yellow
$FileInfo = Get-Item -LiteralPath $NovaExe
$test = & $NovaExe --help 2>&1 | Out-String
if ($test -match "nova <task>") { Write-Host "  Executable verified." -ForegroundColor Green }
else { Write-Host "  WARNING: Executable may not work correctly." -ForegroundColor Yellow }

$sizeInMb = [math]::Round($FileInfo.Length / 1MB, 1)
Write-Host "`n=== Build Complete ===" -ForegroundColor Cyan
Write-Host "  nova.exe: $NovaExe" -ForegroundColor Green
Write-Host "  Size: $sizeInMb MB" -ForegroundColor Green
Write-Host "`nTry: $NovaExe --interactive" -ForegroundColor Gray
