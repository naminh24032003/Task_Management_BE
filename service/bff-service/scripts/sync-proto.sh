#!/bin/bash

# ================================================
# Sync proto files from packages/proto (source of truth)
# to service/bff-service/proto (runtime artifact)
# ================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVICE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROTO_SRC="$(cd "$SERVICE_DIR/../../packages/proto" && pwd)"
PROTO_DEST="$SERVICE_DIR/proto"

echo ""
echo "================================================"
echo "  Proto Sync: packages/proto -> bff-service/proto"
echo "================================================"
echo ""
echo "   Source : $PROTO_SRC"
echo "   Dest   : $PROTO_DEST"
echo ""

# Clean and recreate destination
rm -rf "$PROTO_DEST"
mkdir -p "$PROTO_DEST"

# Copy user proto files (BFF needs user service proto)
cp -r "$PROTO_SRC/user" "$PROTO_DEST/"

# Copy task proto files (BFF needs task service proto)
cp -r "$PROTO_SRC/task" "$PROTO_DEST/"

# Copy common proto files if they exist
if [ -d "$PROTO_SRC/common" ]; then
    cp -r "$PROTO_SRC/common" "$PROTO_DEST/"
fi

# Copy google proto files (required for annotations, http, etc.)
if [ -d "$PROTO_SRC/google" ]; then
    cp -r "$PROTO_SRC/google" "$PROTO_DEST/"
fi

echo "Proto files synced successfully!"
echo ""

# List synced files
echo "Synced files:"
find "$PROTO_DEST" -name "*.proto" -print | while read -r file; do
    relative="${file#$PROTO_DEST/}"
    echo "   - $relative"
done

echo ""
echo "================================================"
