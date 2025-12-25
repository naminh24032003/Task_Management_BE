# Generate TypeScript code from proto files using protoc and ts-proto
# PowerShell script for Windows

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$OutDir = $ScriptDir

# Create output directories if they don't exist
New-Item -ItemType Directory -Force -Path "$OutDir\user\v1\generated" | Out-Null
New-Item -ItemType Directory -Force -Path "$OutDir\task\v1\generated" | Out-Null

Write-Host "🔧 Generating User Service types..." -ForegroundColor Cyan

# Generate user service types
protoc `
  --plugin=protoc-gen-ts_proto="$env:APPDATA\npm\protoc-gen-ts_proto.cmd" `
  --ts_proto_out="$OutDir\user\v1\generated" `
  --ts_proto_opt=nestJs=true `
  --ts_proto_opt=outputServices=grpc-js `
  --ts_proto_opt=esModuleInterop=true `
  --ts_proto_opt=exportCommonSymbols=false `
  -I "$ScriptDir" `
  "$ScriptDir\user\v1\user.proto"

Write-Host "🔧 Generating Task Service types..." -ForegroundColor Cyan

# Generate task service types
protoc `
  --plugin=protoc-gen-ts_proto="$env:APPDATA\npm\protoc-gen-ts_proto.cmd" `
  --ts_proto_out="$OutDir\task\v1\generated" `
  --ts_proto_opt=nestJs=true `
  --ts_proto_opt=outputServices=grpc-js `
  --ts_proto_opt=esModuleInterop=true `
  --ts_proto_opt=exportCommonSymbols=false `
  -I "$ScriptDir" `
  "$ScriptDir\task\v1\task.proto"

Write-Host "✅ Proto files generated successfully!" -ForegroundColor Green
