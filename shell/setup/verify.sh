#!/usr/bin/env bash
set -euo pipefail
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'

VERBOSE=false; [[ "${1:-}" == "--verbose" ]] && VERBOSE=true
PASS=0; FAIL=0; WARN=0

ok()   { echo -e "  ${GREEN}✔${NC} $*"; ((PASS++)); }
fail() { echo -e "  ${RED}✖${NC} $*"; ((FAIL++)); }
warn() { echo -e "  ${YELLOW}⚠${NC}  $*"; ((WARN++)); }
sep()  { echo -e "\n${BOLD}${BLUE}── $* ──────────────────────────────${NC}"; }

check_cmd() { command -v "$1" &>/dev/null && ok "${2:-$1}" || fail "${2:-$1}: not found"; }
check_env()  { [[ -n "${!1:-}" ]] && ok "$1 set" || warn "$1 not set (add to ~/.novarc)"; }
check_dir()  { [[ -d "${!1:-}" ]] && ok "$1 → ${!1}" || warn "$1 path not found or not set"; }

[[ -f "$HOME/.novarc" ]] && source "$HOME/.novarc"
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"; [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

echo -e "\n${BOLD}🌌 Lawful Nova — Agentic Shell Verification${NC}"
echo -e "   $(date)\n"

sep "Core Tools"
for cmd in git curl jq rg fzf gh zsh; do check_cmd "$cmd"; done

sep "Runtimes"
check_cmd node "Node.js"; check_cmd npm; check_cmd python "Python 3.12"

sep "Nova LLM Stack"
check_env NOVA_PORT
check_env NOVA_API_URL
check_env NOVA_CLI
check_dir NOVA_VOSS_RUNTIME_PATH
check_dir NOVA_CORTEX_PATH
check_env NOVA_GOW_CONFIG
check_dir NOVA_RSL_PATH
check_env NOVA_GPU_DEVICE

NOVA_CLI_CMD="${NOVA_CLI:-nova}"
command -v "$NOVA_CLI_CMD" &>/dev/null && ok "Nova CLI reachable" || fail "Nova CLI not in PATH"

NOVA_API_URL="${NOVA_API_URL:-http://localhost:${NOVA_PORT:-8080}}"
if curl -sf "${NOVA_API_URL}/health" &>/dev/null; then
  ok "Nova API responding at ${NOVA_API_URL}"
else
  warn "Nova API not responding at ${NOVA_API_URL} (stack may not be running)"
fi

sep "NVIDIA GPU"
if command -v nvidia-smi &>/dev/null; then
  GPU_NAME=$(nvidia-smi --query-gpu=name --format=csv,noheader 2>/dev/null | head -1)
  GPU_MEM=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader 2>/dev/null | head -1)
  ok "GPU: $GPU_NAME | $GPU_MEM"
else
  warn "nvidia-smi not found — GPU acceleration unavailable"
fi

sep "Config Files"
[[ -f "$HOME/.novarc" ]]               && ok "~/.novarc"              || warn "~/.novarc missing"
[[ -f "$HOME/.nova/nova-stack.json" ]] && ok "~/.nova/nova-stack.json" || warn "~/.nova/nova-stack.json missing"
[[ -f "$HOME/.gitconfig" ]]            && ok "~/.gitconfig"           || warn "~/.gitconfig missing"

sep "Optional"
check_cmd docker "Docker"; command -v code &>/dev/null && ok "VS Code" || warn "VS Code not in PATH"

echo -e "\n${BOLD}── Summary ───────────────────────────────${NC}"
echo -e "  ${GREEN}Passed:${NC} $PASS   ${YELLOW}Warnings:${NC} $WARN   ${RED}Failed:${NC} $FAIL\n"
[[ "$FAIL" -gt 0 ]] && echo -e "  ${RED}Run ./setup/bootstrap.sh to fix.${NC}" && exit 1
[[ "$WARN" -gt 0 ]] && echo -e "  ${YELLOW}Critical checks passed. Some items need attention.${NC}" && exit 0
echo -e "  ${GREEN}All checks passed! 🌌 Nova shell is ready.${NC}"
