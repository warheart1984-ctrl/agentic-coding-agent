# Windows Skill

Rules for operating on Windows systems — paths, executables, PowerShell, process management, and Nova agentic coding workflow.

## Path conventions

| Pattern | Example |
|---------|---------|
| Backslash paths | `C:\Users\user\project` |
| Forward-slash also works | `C:/Users/user/project` |
| `%USERPROFILE%` | `C:\Users\user` |
| `%LOCALAPPDATA%` | `C:\Users\user\AppData\Local` |
| `%APPDATA%` | `C:\Users\user\AppData\Roaming` |
| `%PROGRAMFILES%` | `C:\Program Files` |
| `%TEMP%` / `%TMP%` | User temp directory |

Always use double-quote paths containing spaces. Use `Resolve-Path` or `Convert-Path` to normalize.

## Running .exe programs

```powershell
# Run and wait
& "C:\Program Files\SomeApp\app.exe" --flag value

# Capture output
$output = & ".\tool.exe" arg1 arg2 2>&1 | Out-String

# Check exit code
$LASTEXITCODE -eq 0
```

## PowerShell vs CMD

| Task | PowerShell | CMD |
|------|-----------|-----|
| Run .exe | `& ".\path\to\exe"` | `path\to\exe.exe` |
| Environment var | `$env:VAR_NAME` | `%VAR_NAME%` |
| Pipeline | `cmd1 \| cmd2` | `cmd1 \| cmd2` |
| Conditionals | `if ($cond) { ... }` | `if %cond% (...)` |
| `&&` chaining | `cmd1; if ($?) { cmd2 }` | `cmd1 && cmd2` |

When in doubt, use PowerShell. Prefer `cmd1; if ($?) { cmd2 }` for command chaining.

## Process management

```powershell
# List processes
Get-Process

# Start background
Start-Process -FilePath "notepad.exe" -NoNewWindow

# Kill by name
Stop-Process -Name "node" -Force

# Check if running
Get-Process -Name "myapp" -ErrorAction SilentlyContinue
```

## File system

```powershell
# Read file
Get-Content -Path "file.txt"
# Set content
Set-Content -Path "file.txt" -Value "text"
# Test existence
Test-Path -LiteralPath "C:\path"
# Create directory
New-Item -ItemType Directory -Path "C:\path" -Force
# Remove
Remove-Item -LiteralPath "file.txt" -Force
# Copy
Copy-Item -Path "src" -Destination "dst" -Recurse
```

## Execution policy

```powershell
# Check
Get-ExecutionPolicy
# Set (if needed)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
# Bypass for one script
powershell -ExecutionPolicy Bypass -File script.ps1
```

## Nova CLI on Windows

The Nova agentic coding assistant runs on Node.js 18+. Use `npm run nova` or `ts-node src/cli/nova.ts`.

### Running Nova

```powershell
# One-shot task
npm run nova "add sorting to src/utils.ts"
ts-node src/cli/nova.ts "find where JWT is verified"

# Interactive REPL mode
ts-node src/cli/nova.ts --interactive

# With LLM configured (set env vars first)
$env:LLM_PROVIDER = "openai"
$env:LLM_API_KEY = "sk-..."
$env:LLM_MODEL = "gpt-4o"
npm run nova "refactor auth to use JWT"
```

### Nova configuration (Windows paths)

| Path | Purpose |
|------|---------|
| `.nova/memory.json` | Durable project memory (created automatically) |
| `%USERPROFILE%\.novarc` | Global Nova config (future) |
| `.nova/` | Per-project Nova directory |

### Full agentic lifecycle on Windows

```powershell
# 1. Nova builds semantic index, plans, executes, debugs, creates git branch
ts-node src/cli/nova.ts "upgrade axios to v2 across the project"

# 2. Nova creates branch nova/upgrade-axios-to-v2-across-the-project
# 3. Nova commits each edit with message "Nova: <intent>"
# 4. Nova runs tests and auto-fixes failures (up to 5 iterations)
# 5. Nova shows git diff and prompts: Accept? [y/n/pr]
# 6. If "pr", prompts for GitHub credentials and creates PR
```

### Notable Windows traps for Nova

- `&&` does not exist in PowerShell — use `; if ($?) { }`
- `npm test` may fail due to execution policy — use `node --test` directly
- Windows line endings (`CRLF`) can break bash scripts — check with `file` or `Format-Hex`
- `npx` may trigger a SmartScreen/Windows Defender prompt on first run
- Paths with spaces MUST be double-quoted everywhere
- `Remove-Item -Recurse -Force` is irreversible — always list items first
- Node.js on Windows uses `node_modules\.bin\*.cmd` not symlinks
- Docker on Windows requires Docker Desktop; `--network none` sandbox works the same

## Detecting Windows

```powershell
$IsWindows -eq $true
$env:OS -eq "Windows_NT"
```
