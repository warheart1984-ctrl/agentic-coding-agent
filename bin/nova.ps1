# Repo-local Nova CLI shim for the Lawful Nova slice.
param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Args
)

$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ShellRoot = Split-Path -Parent $ScriptRoot
$ProjectRoot = Split-Path -Parent $ShellRoot

$Python = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
if (-not (Test-Path $Python)) {
    $Python = Join-Path $ShellRoot ".venv\Scripts\python.exe"
}
if (-not (Test-Path $Python)) {
    $Python = "python"
}

& $Python -m nova.cli @Args
exit $LASTEXITCODE
