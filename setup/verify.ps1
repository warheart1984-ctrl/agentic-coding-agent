# verify.ps1 — Lawful Nova Agentic Shell verification (Windows)
#Requires -Version 5.1
param([switch]$Verbose)

$Pass = 0; $Fail = 0; $Warn = 0

function Write-Ok { param([string]$Message) Write-Host "  ✔ $Message" -ForegroundColor Green; $script:Pass++ }
function Write-Fail { param([string]$Message) Write-Host "  ✖ $Message" -ForegroundColor Red; $script:Fail++ }
function Write-WarnLine { param([string]$Message) Write-Host "  ⚠  $Message" -ForegroundColor Yellow; $script:Warn++ }
function Write-Sep { param([string]$Title)
    Write-Host ""
    Write-Host "── $Title ──────────────────────────────" -ForegroundColor Cyan
}

$NovarcPath = Join-Path $env:USERPROFILE ".novarc.ps1"
if (Test-Path $NovarcPath) { . $NovarcPath }

Write-Host ""
Write-Host "🌌 Lawful Nova — Agentic Shell Verification (Windows)" -ForegroundColor White
Write-Host "   $(Get-Date)"
Write-Host ""

Write-Sep "Core Tools"
foreach ($cmd in @("git", "curl", "gh")) {
    if (Get-Command $cmd -ErrorAction SilentlyContinue) { Write-Ok $cmd } else { Write-Fail "$cmd not found" }
}
if (Get-Command rg -ErrorAction SilentlyContinue) { Write-Ok "ripgrep" } else { Write-WarnLine "ripgrep (rg) not found" }
if (Get-Command fzf -ErrorAction SilentlyContinue) { Write-Ok "fzf" } else { Write-WarnLine "fzf not found" }

Write-Sep "Runtimes"
if (Get-Command node -ErrorAction SilentlyContinue) { Write-Ok "Node.js $(node --version)" } else { Write-Fail "Node.js not found" }
if (Get-Command npm -ErrorAction SilentlyContinue) { Write-Ok "npm" } else { Write-Fail "npm not found" }
if (Get-Command python -ErrorAction SilentlyContinue) { Write-Ok "Python $(python --version)" }
elseif (Get-Command py -ErrorAction SilentlyContinue) { Write-Ok "Python (py launcher)" }
else { Write-Fail "Python not found" }

Write-Sep "Nova LLM Stack"
@("NOVA_PORT", "NOVA_API_URL", "NOVA_CLI", "NOVA_GPU_DEVICE") | ForEach-Object {
    if ($env:$_ ) { Write-Ok "$_ set" } else { Write-WarnLine "$_ not set (add to ~/.novarc.ps1)" }
}
@("NOVA_VOSS_RUNTIME_PATH", "NOVA_CORTEX_PATH", "NOVA_RSL_PATH") | ForEach-Object {
    if ($env:$_ -and (Test-Path $env:$_)) { Write-Ok "$_ → $($env:$_)" }
    else { Write-WarnLine "$_ path not found or not set" }
}
if ($env:NOVA_GOW_CONFIG) { Write-Ok "NOVA_GOW_CONFIG set" } else { Write-WarnLine "NOVA_GOW_CONFIG not set" }

$NovaCli = if ($env:NOVA_CLI) { $env:NOVA_CLI } else { "nova" }
if (Get-Command $NovaCli -ErrorAction SilentlyContinue) { Write-Ok "Nova CLI reachable" } else { Write-Fail "Nova CLI not in PATH" }

$ApiUrl = if ($env:NOVA_API_URL) { $env:NOVA_API_URL } else { "http://localhost:8080" }
try {
    $null = Invoke-WebRequest -Uri "$ApiUrl/health" -UseBasicParsing -TimeoutSec 3
    Write-Ok "Nova API responding at $ApiUrl"
} catch {
    Write-WarnLine "Nova API not responding at $ApiUrl (stack may not be running)"
}

Write-Sep "NVIDIA GPU"
if (Get-Command nvidia-smi -ErrorAction SilentlyContinue) {
    $gpu = (nvidia-smi --query-gpu=name,memory.total --format=csv,noheader 2>$null | Select-Object -First 1)
    Write-Ok "GPU: $gpu"
} else {
    Write-WarnLine "nvidia-smi not found — GPU acceleration unavailable"
}

Write-Sep "Config Files"
if (Test-Path $NovarcPath) { Write-Ok "~/.novarc.ps1" } else { Write-WarnLine "~/.novarc.ps1 missing" }
$StackJson = Join-Path $env:USERPROFILE ".nova\nova-stack.json"
if (Test-Path $StackJson) { Write-Ok "~/.nova/nova-stack.json" } else { Write-WarnLine "~/.nova/nova-stack.json missing" }
if (Test-Path (Join-Path $env:USERPROFILE ".gitconfig")) { Write-Ok "~/.gitconfig" } else { Write-WarnLine "~/.gitconfig missing" }
if (Test-Path $PROFILE) { Write-Ok "PowerShell profile" } else { Write-WarnLine "PowerShell profile missing" }

Write-Sep "Optional"
if (Get-Command docker -ErrorAction SilentlyContinue) { Write-Ok "Docker" } else { Write-WarnLine "Docker not found" }
if (Get-Command code -ErrorAction SilentlyContinue) { Write-Ok "VS Code" } else { Write-WarnLine "VS Code not found" }

Write-Host ""
Write-Host "── Summary ───────────────────────────────" -ForegroundColor White
Write-Host "  Passed: $Pass   Warnings: $Warn   Failed: $Fail"
Write-Host ""
if ($Fail -gt 0) {
    Write-Host "  Run setup\bootstrap.ps1 to fix." -ForegroundColor Red
    exit 1
}
if ($Warn -gt 0) {
    Write-Host "  Critical checks passed. Some items need attention." -ForegroundColor Yellow
    exit 0
}
Write-Host "  All checks passed! 🌌 Nova shell is ready." -ForegroundColor Green
exit 0
