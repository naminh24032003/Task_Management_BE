#!/bin/bash
# Generate TypeScript code from proto files using protoc and ts-proto

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT_DIR="$SCRIPT_DIR"

# Generate user service types
protoc \
  --plugin=protoc-gen-ts_proto="$(which protoc-gen-ts_proto)" \
  --ts_proto_out="$OUT_DIR/user/v1/generated" \
  --ts_proto_opt=nestJs=true \
  --ts_proto_opt=outputServices=grpc-js \
  --ts_proto_opt=esModuleInterop=true \
  --ts_proto_opt=exportCommonSymbols=false \
  -I "$SCRIPT_DIR" \
  "$SCRIPT_DIR/user/v1/user.proto"

# Generate task service types  
protoc \
  --plugin=protoc-gen-ts_proto="$(which protoc-gen-ts_proto)" \
  --ts_proto_out="$OUT_DIR/task/v1/generated" \
  --ts_proto_opt=nestJs=true \
  --ts_proto_opt=outputServices=grpc-js \
  --ts_proto_opt=esModuleInterop=true \
  --ts_proto_opt=exportCommonSymbols=false \
  -I "$SCRIPT_DIR" \
  "$SCRIPT_DIR/task/v1/task.proto"

echo "✅ Proto files generated successfully!"
