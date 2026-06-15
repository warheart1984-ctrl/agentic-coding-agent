# Agentic Coding Agent (Lawful Nova Shell)

**Repository:** [warheart1984-ctrl/agentic-coding-agent](https://github.com/warheart1984-ctrl/agentic-coding-agent)

Self-bootstrapping agentic coding environment for **macOS**, **Linux**, and **Windows**, powered by the **Nova LLM** stack — Voss Runtime · Gates of Wonder · RSL · Nova Cortex · NVIDIA backend.

This repo does **not** build Nova; it validates paths to your already-built Nova slice and wires your dev shell (zsh / PowerShell), `AGENTS.md`, skills, and devcontainer.

Clone → Run one command → Code with Nova.

[![macOS](https://img.shields.io/badge/macOS-13%2B-black?logo=apple)](https://apple.com)
[![Linux](https://img.shields.io/badge/Linux-Ubuntu%2022.04%2B-orange?logo=linux)](https://ubuntu.com)
[![Windows](https://img.shields.io/badge/Windows-10%2B-0078D6?logo=windows)](https://microsoft.com/windows)
[![NVIDIA](https://img.shields.io/badge/NVIDIA-CUDA%2012%2B-76b900?logo=nvidia)](https://developer.nvidia.com/cuda-downloads)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## Table of Contents

- [Nova Stack Architecture](#nova-stack-architecture)
- [Repo Structure](#repo-structure)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start-one-command)
- [Windows Quick Start](#windows-quick-start)
- [Manual Setup](#manual-setup)
- [Nova Configuration](#nova-configuration)
- [Shell Commands](#shell-commands)
- [AGENTS.md Spec](#agentsmd-spec)
- [Dev Container](#dev-container-support)
- [Troubleshooting](#troubleshooting)

---

## Nova Stack Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       Your Terminal                         │
│  ┌───────────────────────────────────────────────────────┐  │
│  │           Lawful Nova Agentic Shell                     │  │
│  │   nova chat | novr | novtest | novpr | novstack        │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │              Nova LLM Slice                     │  │  │
│  │  │  [Voss Runtime] → [Gates of Wonder] → [RSL]    │  │  │
│  │  │          ↓                                      │  │  │
│  │  │    [Nova Cortex]  ←──────────────────────────  │  │  │
│  │  │          ↓                                      │  │  │
│  │  │  [NVIDIA Megatron / NIM Backend]                │  │  │
│  │  │          ↓                                      │  │  │
│  │  │   REST API  localhost:${NOVA_PORT}              │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

| Layer | Component | Role |
|---|---|---|
| Runtime | Voss Runtime | Execution host for the Nova slice |
| Routing | Gates of Wonder | Request gating, context injection, guardrails |
| Scripting | RSL | Nova's internal scripting/reasoning layer |
| Core | Nova Cortex | The LLM brain — weights + inference loop |
| Backend | NVIDIA Megatron/NIM | GPU-accelerated tensor compute |
| Interface | REST API / CLI | How the shell talks to Nova |

---

## Repo Structure

```
agentic-coding-agent/
├── README.md
├── AGENTS.md
├── LICENSE
├── setup/
│   ├── bootstrap.sh          # macOS / Linux
│   ├── bootstrap.ps1         # Windows
│   ├── install_macos.sh
│   ├── install_linux.sh
│   ├── install_windows.ps1
│   ├── install_nova.sh / install_nova.ps1
│   └── verify.sh / verify.ps1
├── config/
│   ├── .zshrc                # macOS / Linux shell
│   ├── profile.ps1           # Windows PowerShell profile
│   ├── .novarc               # Unix env (gitignored template)
│   ├── novarc.ps1            # Windows env (gitignored template)
│   ├── .gitconfig.template
│   └── nova/nova-stack.json
├── .devcontainer/
├── .nova/commands/
├── skills/
└── .vscode/
```

---

## Prerequisites

| Dependency | macOS | Linux | Windows | Auto-installed |
|---|---|---|---|---|
| Homebrew | Required | — | — | Yes |
| Git / gh | Yes | Yes | Yes | Yes (winget) |
| Node.js 20+ | via nvm | via nvm | nvm-windows / winget | Yes |
| Python 3.12+ | via pyenv | via pyenv | py / winget | Yes |
| NVIDIA Driver + CUDA 12+ | Manual | Manual | Manual | Checked |
| **Nova stack (built)** | **Required** | **Required** | **Required** | No |
| Docker + NVIDIA toolkit | Optional | Optional | WSL2 + toolkit | Prompt |

> Your Nova stack must already be built and paths set in `~/.novarc` (Unix) or `~/.novarc.ps1` (Windows) before bootstrap.

---

## Quick Start (One Command)

### macOS / Linux

```bash
git clone https://github.com/warheart1984-ctrl/agentic-coding-agent.git && \
  cd agentic-coding-agent && \
  chmod +x setup/bootstrap.sh setup/*.sh && \
  ./setup/bootstrap.sh
```

### Windows

```powershell
git clone https://github.com/warheart1984-ctrl/agentic-coding-agent.git
cd agentic-coding-agent
powershell -ExecutionPolicy Bypass -File setup\bootstrap.ps1
```

Bootstrap will:

1. Detect OS and install system dependencies
2. Install Node.js 20 and Python 3.12
3. Validate your Nova stack is reachable
4. Deploy dotfiles / PowerShell profile
5. Prompt for Nova paths (port, Voss, Cortex, etc.)
6. Run verification and print a status report

---

## Windows Quick Start

| Step | Command |
|---|---|
| Clone | `git clone https://github.com/warheart1984-ctrl/agentic-coding-agent.git` |
| Bootstrap | `powershell -ExecutionPolicy Bypass -File setup\bootstrap.ps1` |
| Reload | `. $PROFILE` |
| Verify | `.\setup\verify.ps1` |

Default Windows paths (prompted during bootstrap):

| Variable | Default |
|---|---|
| `NOVA_VOSS_RUNTIME_PATH` | `C:\opt\nova\voss-runtime` |
| `NOVA_CORTEX_PATH` | `C:\opt\nova\cortex` |
| `NOVA_GOW_CONFIG` | `C:\opt\nova\gow\config.json` |
| `NOVA_RSL_PATH` | `C:\opt\nova\rsl` |

PowerShell functions (after profile load): `nova-chat`, `novr`, `novtest`, `novpr`, `novdoc`, `novsec`, `novrefactor`, `novstack`.

---

## Manual Setup

**Unix:**

```bash
./setup/install_macos.sh    # or install_linux.sh
./setup/install_nova.sh
ln -sf "$(pwd)/config/.zshrc" ~/.zshrc
ln -sf "$(pwd)/config/.novarc" ~/.novarc
source ~/.zshrc
./setup/verify.sh
```

**Windows:**

```powershell
.\setup\install_windows.ps1
.\setup\install_nova.ps1
Copy-Item config\novarc.ps1 $env:USERPROFILE\.novarc.ps1
. $PROFILE   # after bootstrap wires profile.ps1
.\setup\verify.ps1
```

---

## Nova Configuration

**Unix** — `~/.novarc` (gitignored):

```bash
export NOVA_PORT=8080
export NOVA_API_URL="http://localhost:${NOVA_PORT}"
export NOVA_CLI="nova"
export NOVA_VOSS_RUNTIME_PATH="/path/to/voss-runtime"
export NOVA_CORTEX_PATH="/path/to/nova-cortex"
export NOVA_GOW_CONFIG="/path/to/gates-of-wonder/config.json"
export NOVA_RSL_PATH="/path/to/rsl"
export NOVA_GPU_DEVICE="0"
export GITHUB_TOKEN=""
```

**Windows** — `~/.novarc.ps1` (gitignored): same variables as `$env:NAME`.

---

## Shell Commands

| Command | macOS / Linux (zsh) | Windows (PowerShell) |
|---|---|---|
| Interactive Nova | `nova chat` / `nova-chat` | `nova-chat` |
| Review + commit | `novr` | `novr` |
| Test + auto-fix | `novtest` | `novtest` |
| Create PR | `novpr` | `novpr` |
| Generate docs | `novdoc` | `novdoc` |
| Security audit | `novsec` | `novsec` |
| Refactor file | `novrefactor <file>` | `novrefactor <file>` |
| Stack status | `novstack` | `novstack` |

---

## AGENTS.md Spec

`AGENTS.md` at the repo root sets behavioral rules Nova follows in every session. Edit it to match your project's conventions.

---

## Dev Container Support

Built on NVIDIA CUDA 12 + Ubuntu 22.04. Requires Docker + NVIDIA Container Toolkit on Linux/WSL2.

```
Ctrl+Shift+P → Dev Containers: Reopen in Container
```

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `nova: command not found` | Add `NOVA_VOSS_RUNTIME_PATH` to PATH in `~/.novarc` or `~/.novarc.ps1` |
| Nova API not responding | `curl $NOVA_API_URL/health` or `Invoke-WebRequest` on Windows |
| CUDA not found | Run `nvidia-smi` — install NVIDIA drivers + CUDA 12 |
| Windows execution policy | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
| GPU index error | Set `NOVA_GPU_DEVICE=0` in novarc |

```bash
./setup/verify.sh --verbose          # Unix
.\setup\verify.ps1 -Verbose          # Windows
```

---

## License

MIT © 2026
