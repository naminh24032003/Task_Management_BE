#!/bin/bash
# ================================================
# Sync proto files from packages/proto (source of truth)
# to service/user-service/proto (runtime artifact)
# ================================================

set -e

# Colors
GREEN='\033[0;32m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
NC='\033[0m'

# Get paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_DIR="$(dirname "$SCRIPT_DIR")"
PROTO_SRC="$(cd "$SERVICE_DIR/../../packages/proto" && pwd)"
PROTO_DEST="$SERVICE_DIR/proto"

echo ""
echo -e "${CYAN}================================================${NC}"
echo -e "${CYAN}  Proto Sync: packages/proto -> service/proto${NC}"
echo -e "${CYAN}================================================${NC}"
echo ""
echo -e "${GRAY}   Source : $PROTO_SRC${NC}"
echo -e "${GRAY}   Dest   : $PROTO_DEST${NC}"
echo ""

# Clean and recreate destination
rm -rf "$PROTO_DEST"
mkdir -p "$PROTO_DEST"

# Copy user proto files
cp -r "$PROTO_SRC/user" "$PROTO_DEST/"

# Copy common proto files if they exist
if [ -d "$PROTO_SRC/common" ]; then
    cp -r "$PROTO_SRC/common" "$PROTO_DEST/"
fi

# Copy google proto files (required for annotations, http, etc.)
if [ -d "$PROTO_SRC/google" ]; then
    cp -r "$PROTO_SRC/google" "$PROTO_DEST/"
fi

echo -e "${GREEN}✅ Proto files synced successfully!${NC}"
echo ""

# List synced files
echo -e "${GRAY}Synced files:${NC}"
find "$PROTO_DEST" -name "*.proto" -type f | while read -r file; do
    relative_path="${file#$PROTO_DEST/}"
    echo -e "${GRAY}   - $relative_path${NC}"
done

echo ""
echo -e "${CYAN}================================================${NC}"
