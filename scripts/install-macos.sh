#!/bin/bash
# Nova macOS Installer
# Installs Nova agentic coding system on macOS

echo "========================================"
echo "Nova macOS Installer"
echo "========================================"
echo ""

VERSION="0.2.0-mission-002"
INSTALL_DIR="$HOME/.nova"
BIN_DIR="$HOME/.local/bin"

echo "Installing Nova $VERSION..."
echo ""

echo "Creating installation directories..."
mkdir -p "$INSTALL_DIR"
mkdir -p "$BIN_DIR"

echo "Copying files to installation directory..."
cp -r dist "$INSTALL_DIR/"
cp -r cockpit "$INSTALL_DIR/"
cp -r node_modules "$INSTALL_DIR/"
cp package.json "$INSTALL_DIR/"
cp README.md "$INSTALL_DIR/"
cp LICENSE "$INSTALL_DIR/"
cp MISSION-002.md "$INSTALL_DIR/"
cp observer-bundle-mission-002.zip "$INSTALL_DIR/"
cp -r docs "$INSTALL_DIR/"
cp -r config "$INSTALL_DIR/"

echo "Creating executable..."
cp dist/agent/cli.js "$BIN_DIR/nova"
chmod +x "$BIN_DIR/nova"

echo "Adding to PATH..."
if ! grep -q "$BIN_DIR" "$HOME/.zshrc" 2>/dev/null; then
    echo "export PATH=\"$BIN_DIR:\$PATH\"" >> "$HOME/.zshrc"
    echo "export PATH=\"$BIN_DIR:\$PATH\"" >> "$HOME/.bash_profile" 2>/dev/null || true
fi

echo "========================================"
echo "Nova installed successfully!"
echo "Installation directory: $INSTALL_DIR"
echo "Executable: $BIN_DIR/nova"
echo "========================================"
echo ""
echo "Please run 'source ~/.zshrc' or restart your terminal to use Nova."
echo "Run 'nova --help' to get started."

exit 0
