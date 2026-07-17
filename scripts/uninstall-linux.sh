#!/bin/bash
# Nova Linux Uninstaller
# Uninstalls Nova agentic coding system from Linux

echo "========================================"
echo "Nova Linux Uninstaller"
echo "========================================"
echo ""

INSTALL_DIR="$HOME/.nova"
BIN_DIR="$HOME/.local/bin"

echo "Uninstalling Nova..."
echo ""

echo "Removing installation directory..."
if [ -d "$INSTALL_DIR" ]; then
    rm -rf "$INSTALL_DIR"
    echo "Installation directory removed."
else
    echo "Installation directory not found."
fi

echo "Removing executable..."
if [ -f "$BIN_DIR/nova" ]; then
    rm "$BIN_DIR/nova"
    echo "Executable removed."
fi

echo "Removing from PATH..."
sed -i "/$BIN_DIR/d" "$HOME/.bashrc" 2>/dev/null || true
sed -i "/$BIN_DIR/d" "$HOME/.zshrc" 2>/dev/null || true

echo "========================================"
echo "Nova uninstalled successfully!"
echo "========================================"

exit 0
