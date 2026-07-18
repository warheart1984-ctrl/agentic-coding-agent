#!/bin/bash
# Nova Linux Package Builder
# Builds Linux distribution package for agentic-coding-agent

echo "========================================"
echo "Nova Linux Package Builder"
echo "========================================"
echo ""

VERSION="0.4.0-mission-004"
PACKAGE_NAME="nova-linux-${VERSION}"
BUILD_DIR="build/linux"
OUTPUT_DIR="dist/packages"

echo "Cleaning previous build..."
rm -rf "$BUILD_DIR"
rm -rf "$OUTPUT_DIR"

echo "Creating build directories..."
mkdir -p "$BUILD_DIR"
mkdir -p "$OUTPUT_DIR"

echo "Building project..."
npm run build
if [ $? -ne 0 ]; then
    echo "Build failed!"
    exit 1
fi

echo "Building cockpit..."
cd cockpit
npm run build
if [ $? -ne 0 ]; then
    echo "Cockpit build failed!"
    cd ..
    exit 1
fi
cd ..

echo "Copying files to package..."
cp -r dist "$BUILD_DIR/"
cp -r cockpit/dist "$BUILD_DIR/cockpit/"
cp cockpit/package.json "$BUILD_DIR/cockpit/"
cp cockpit/package-lock.json "$BUILD_DIR/cockpit/"
cp -r node_modules "$BUILD_DIR/"
cp -r inas "$BUILD_DIR/"
cp -r agent "$BUILD_DIR/"
cp -r backend "$BUILD_DIR/"
cp -r shell "$BUILD_DIR/"
cp -r scripts "$BUILD_DIR/"
cp -r docs "$BUILD_DIR/"
cp -r config "$BUILD_DIR/"
cp package.json "$BUILD_DIR/"
cp package-lock.json "$BUILD_DIR/"
cp README.md "$BUILD_DIR/"
cp LICENSE "$BUILD_DIR/"
cp scripts/install-linux.sh "$BUILD_DIR/"
cp scripts/uninstall-linux.sh "$BUILD_DIR/"

echo "Creating Linux executable..."
cp dist/agent/cli.js "$BUILD_DIR/nova.js"
chmod +x "$BUILD_DIR/nova.js"
echo '#!/bin/bash' > "$BUILD_DIR/nova"
echo 'DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"' >> "$BUILD_DIR/nova"
echo 'node "$DIR/nova.js" "$@"' >> "$BUILD_DIR/nova"
chmod +x "$BUILD_DIR/nova"

echo "Creating package..."
cd "$BUILD_DIR"
tar -czf "../$OUTPUT_DIR/$PACKAGE_NAME.tar.gz" *
cd ..

echo "========================================"
echo "Linux package created successfully!"
echo "Package: $OUTPUT_DIR/$PACKAGE_NAME.tar.gz"
echo "========================================"

exit 0
