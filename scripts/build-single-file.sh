#!/bin/bash
set -e

echo "🔨 Building single-file executable..."
echo ""

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIST="$ROOT/packages/app/dist"
SERVER_DIR="$ROOT/packages/server"
OUTPUT="$ROOT/friend-server"
TEMP_DIR="$ROOT/.build-temp"

# Step 1: Build frontend if needed
if [ ! -d "$APP_DIST" ]; then
  echo "📦 Building frontend..."
  cd "$ROOT/packages/app"
  bun run build
fi
echo "✅ Frontend ready: $APP_DIST"

# Step 2: Build binary
echo "🚀 Compiling binary..."
cd "$SERVER_DIR"
bun build src/index.ts --compile --outfile="$OUTPUT"
echo "✅ Binary compiled"

# Step 3: Create assets archive
echo "📦 Embedding assets..."
rm -rf "$TEMP_DIR"
mkdir -p "$TEMP_DIR"

# Create asset manifest
cd "$APP_DIST"
find . -type f | sed 's|^\./|/|' > "$TEMP_DIR/manifest.txt"

# Create tarball of assets
tar -cf "$TEMP_DIR/assets.tar" .

# Step 4: Append marker, manifest size, manifest, and assets to binary
MARKER="FRND_ASSETS"
MANIFEST_SIZE=$(wc -c < "$TEMP_DIR/manifest.txt")
ASSETS_SIZE=$(wc -c < "$TEMP_DIR/assets.tar")

# Write marker
printf "%s" "$MARKER" >> "$OUTPUT"

# Write manifest size (8 hex digits)
printf "%08x" "$MANIFEST_SIZE" >> "$OUTPUT"

# Write manifest
cat "$TEMP_DIR/manifest.txt" >> "$OUTPUT"

# Write assets size (8 hex digits)
printf "%08x" "$ASSETS_SIZE" >> "$OUTPUT"

# Write assets
cat "$TEMP_DIR/assets.tar" >> "$OUTPUT"

# Cleanup
rm -rf "$TEMP_DIR"

# Done
BINARY_SIZE=$(du -h "$OUTPUT" | cut -f1)
ASSET_COUNT=$(wc -l < "$APP_DIST/../..")
echo ""
echo "✅ Build complete!"
echo "   Binary: $OUTPUT"
echo "   Size: $BINARY_SIZE"
echo "   Assets: $(find "$APP_DIST" -type f | wc -l) files embedded"
echo ""
echo "   Usage: ./friend-server"
