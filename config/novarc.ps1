# .novarc.ps1 — Nova LLM Stack Environment Variables (Windows)
# Fill these in after your Nova stack is built.
# This file is gitignored — NEVER commit it.
# bootstrap.ps1 sets LAWFUL_NOVA_REPO_ROOT automatically.

$env:LAWFUL_NOVA_REPO_ROOT = ""

$env:NOVA_PORT = "8080"
$env:NOVA_API_URL = "http://localhost:$($env:NOVA_PORT)"
$env:NOVA_CLI = "nova"

$env:NOVA_VOSS_RUNTIME_PATH = ""
$env:NOVA_CORTEX_PATH = ""
$env:NOVA_GOW_CONFIG = ""
$env:NOVA_RSL_PATH = ""
$env:NOVA_SLICE_CONFIG = "$env:USERPROFILE\.nova\nova-stack.json"

$env:NOVA_GPU_DEVICE = "0"
$env:NOVA_MEGATRON_ENDPOINT = "http://localhost:5000"
$env:CUDA_VISIBLE_DEVICES = $env:NOVA_GPU_DEVICE

$env:GITHUB_TOKEN = ""

$env:LAWFUL_NOVA_REPO_ROOT = ""
# Set by setup/bootstrap.ps1 to your cloned repo path

$env:DO_NOT_TRACK = "1"
$env:NEXT_TELEMETRY_DISABLED = "1"
