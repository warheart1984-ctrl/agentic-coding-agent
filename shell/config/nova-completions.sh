# Nova CLI shell auto-completions
# Source this file in your .bashrc, .zshrc, or PowerShell profile

# Bash/Zsh completions
_nova_completions() {
  local cur="${COMP_WORDS[COMP_CWORD]}"
  local commands="init generate plan continuity receipts invariants models chat run"
  COMPREPLY=($(compgen -W "$commands" -- "$cur"))
}
complete -F _nova_completions nova

# PowerShell completions (register via profile.ps1)
# Register-ArgumentCompleter -CommandName nova -ScriptBlock {
#   param($wordToComplete)
#   @("init","generate","plan","continuity","receipts","invariants","models","chat","run") -like "$wordToComplete*" | ForEach-Object { "'$_'" }
# }
