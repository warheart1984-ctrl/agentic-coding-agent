# Cross-Platform Distribution Packages

**Version:** 0.2.0-mission-002
**Last Updated:** 2026-07-17

---

## Overview

Nova agentic coding system is now available as cross-platform distribution packages for Windows, Linux, and macOS. Each package includes the complete governed runtime with CRK-2 kernel, Nova SDK, Control Tower, Cockpit, and Mission #002 verification bundle.

---

## Available Packages

### Windows Package

**File:** `nova-windows-0.2.0-mission-002.zip`
**Format:** ZIP archive
**Executable:** `nova.cmd`
**Installer:** `install-windows.bat`
**Uninstaller:** `uninstall-windows.bat`

**Requirements:**
- Windows 10 or later
- Node.js 18 or later (included in package)
- PowerShell (for installation)

**Installation:**
```bash
# Extract the ZIP file
# Run the installer
install-windows.bat

# Restart your terminal
# Verify installation
nova --help
```

**Uninstallation:**
```bash
uninstall-windows.bat
```

---

### Linux Package

**File:** `nova-linux-0.2.0-mission-002.tar.gz`
**Format:** TAR.GZ archive
**Executable:** `nova`
**Installer:** `install-linux.sh`
**Uninstaller:** `uninstall-linux.sh`

**Requirements:**
- Linux (Ubuntu 20.04+, Debian 11+, CentOS 8+, or equivalent)
- Node.js 18 or later (included in package)
- Bash 4.0 or later

**Installation:**
```bash
# Extract the archive
tar -xzf nova-linux-0.2.0-mission-002.tar.gz
cd nova-linux-0.2.0-mission-002

# Run the installer
chmod +x install-linux.sh
./install-linux.sh

# Source your shell configuration
source ~/.bashrc

# Verify installation
nova --help
```

**Uninstallation:**
```bash
chmod +x uninstall-linux.sh
./uninstall-linux.sh
```

---

### macOS Package

**File:** `nova-macos-0.2.0-mission-002.tar.gz`
**Format:** TAR.GZ archive
**Executable:** `nova`
**Installer:** `install-macos.sh`
**Uninstaller:** `uninstall-macos.sh`

**Requirements:**
- macOS 11 (Big Sur) or later
- Node.js 18 or later (included in package)
- Bash or Zsh

**Installation:**
```bash
# Extract the archive
tar -xzf nova-macos-0.2.0-mission-002.tar.gz
cd nova-macos-0.2.0-mission-002

# Run the installer
chmod +x install-macos.sh
./install-macos.sh

# Source your shell configuration
source ~/.zshrc

# Verify installation
nova --help
```

**Uninstallation:**
```bash
chmod +x uninstall-macos.sh
./uninstall-macos.sh
```

---

## Package Contents

Each package includes:

**Core Components:**
- CRK-2 Constitutional Runtime Kernel
- Nova Agent SDK (AgentRuntime + governance)
- Control Tower (multi-agent orchestration)
- Cockpit (operator UI)
- Observer (Mission #002 verification)

**Documentation:**
- Architecture documentation
- CRK-2 specification
- API documentation
- Getting started guides
- Operator certification materials

**Verification:**
- Observer bundle (observer-bundle-mission-002.zip)
- Mission #002 reproduction protocol
- Verification checklist

**Configuration:**
- Nova configuration files
- CRK-1 formal specification
- Local governed configuration

---

## Building Packages

### Windows

```bash
scripts\package-windows.bat
```

### Linux

```bash
chmod +x scripts/package-linux.sh
scripts/package-linux.sh
```

### macOS

```bash
chmod +x scripts/package-macos.sh
scripts/package-macos.sh
```

---

## Installation Locations

**Windows:**
- Installation directory: `%LOCALAPPDATA%\Nova`
- Executable directory: `%USERPROFILE%\AppData\Local\Programs\nova`
- PATH: Automatically added to system PATH

**Linux:**
- Installation directory: `~/.nova`
- Executable directory: `~/.local/bin`
- PATH: Added to `~/.bashrc` and `~/.zshrc`

**macOS:**
- Installation directory: `~/.nova`
- Executable directory: `~/.local/bin`
- PATH: Added to `~/.zshrc` and `~/.bash_profile`

---

## Usage After Installation

### Start Cockpit

```bash
nova cockpit
```

### Run Governed Agent

```bash
nova agent
```

### Generate Code

```bash
nova generate "Write a factorial function in TypeScript"
```

### View Receipts

```bash
nova receipts
```

### Check Continuity

```bash
nova continuity
```

---

## Troubleshooting

### Windows

**Issue:** Command not found after installation
**Solution:** Restart your terminal or run `refreshenv` (if using PowerShell)

**Issue:** PowerShell execution policy
**Solution:** Run `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`

### Linux

**Issue:** Permission denied
**Solution:** Run `chmod +x ~/.local/bin/nova`

**Issue:** PATH not updated
**Solution:** Run `source ~/.bashrc` manually

### macOS

**Issue:** Permission denied
**Solution:** Run `chmod +x ~/.local/bin/nova`

**Issue:** PATH not updated
**Solution:** Run `source ~/.zshrc` manually

---

## Verification

After installation, verify the package integrity:

```bash
# Check Nova version
nova --version

# Run cockpit smoke test
nova cockpit

# Run Mission #002 verification
cd ~/.nova
# Follow observer/REPRO_PROTOCOL.md
```

---

## Support

For issues or questions:
- Documentation: See `docs/` directory
- Mission #002: See `MISSION-002.md`
- Architecture: See `docs/ARCHITECTURE.md`
- GitHub Issues: https://github.com/warheart1984-ctrl/agentic-coding-agent/issues

---

*Cross-Platform Distribution: Nova Mission #002*
*Version: 0.2.0-mission-002*
*License: MIT*
