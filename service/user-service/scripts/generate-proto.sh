#!/bin/bash
# Auto-generate TypeScript types from proto files

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

# Get paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_DIR="$(dirname "$SCRIPT_DIR")"
PROTO_DIR="$(cd "$SERVICE_DIR/../../packages/proto" && pwd)"
OUT_DIR="$SERVICE_DIR/src/generated"

echo ""
echo -e "${CYAN}================================================${NC}"
echo -e "${CYAN}  Proto TypeScript Generator${NC}"
echo -e "${CYAN}================================================${NC}"
echo ""

# Ensure output directory exists
mkdir -p "$OUT_DIR"

echo -e "${YELLOW}🔧 Generating TypeScript types from proto files...${NC}"
echo -e "${GRAY}   Proto Dir : $PROTO_DIR${NC}"
echo -e "${GRAY}   Output Dir: $OUT_DIR${NC}"
echo ""

# Find protoc-gen-ts_proto plugin
TS_PROTO_PLUGIN="$SERVICE_DIR/node_modules/.bin/protoc-gen-ts_proto"

if [ ! -f "$TS_PROTO_PLUGIN" ]; then
    echo -e "${RED}❌ ts-proto not found at: $TS_PROTO_PLUGIN${NC}"
    echo -e "${YELLOW}   Run 'npm install' first.${NC}"
    exit 1
fi

# Check if protoc is available
if ! command -v protoc &> /dev/null; then
    echo -e "${RED}❌ protoc not found in PATH${NC}"
    echo -e "${YELLOW}   Please install Protocol Buffers compiler:${NC}"
    echo -e "${GRAY}   - macOS: brew install protobuf${NC}"
    echo -e "${GRAY}   - Ubuntu: apt-get install protobuf-compiler${NC}"
    exit 1
fi

# Generate user service types
USER_PROTO="$PROTO_DIR/user/v1/user.proto"

if [ ! -f "$USER_PROTO" ]; then
    echo -e "${RED}❌ Proto file not found: $USER_PROTO${NC}"
    exit 1
fi

echo -e "${CYAN}📄 Processing: user/v1/user.proto${NC}"

protoc \
    --plugin="protoc-gen-ts_proto=$TS_PROTO_PLUGIN" \
    --ts_proto_out="$OUT_DIR" \
    --ts_proto_opt=nestJs=true \
    --ts_proto_opt=outputServices=grpc-js \
    --ts_proto_opt=esModuleInterop=true \
    --ts_proto_opt=addGrpcMetadata=true \
    --ts_proto_opt=exportCommonSymbols=false \
    --ts_proto_opt=snakeToCamel=true \
    --ts_proto_opt=useDate=true \
    --ts_proto_opt=oneof=unions \
    -I "$PROTO_DIR" \
    "$USER_PROTO"

echo ""
echo -e "${GREEN}✅ Proto generation completed!${NC}"
echo -e "${GRAY}   Generated files:${NC}"

# List generated files
find "$OUT_DIR" -name "*.ts" -type f | while read -r file; do
    relative_path="${file#$OUT_DIR/}"
    echo -e "${GRAY}   - $relative_path${NC}"
done

echo ""
echo -e "${CYAN}================================================${NC}"
