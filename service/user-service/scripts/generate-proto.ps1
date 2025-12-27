#!/usr/bin/env pwsh
# Auto-generate TypeScript types from proto files

$ErrorActionPreference = "Stop"

# Get paths
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ServiceDir = Split-Path -Parent $ScriptDir
$ProtoDir = Join-Path $ServiceDir "..\..\packages\proto"
$OutDir = Join-Path $ServiceDir "src\generated"

# Resolve to absolute paths
$ProtoDir = (Resolve-Path $ProtoDir).Path
$OutDir = Join-Path $ServiceDir "src\generated"

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Proto TypeScript Generator" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Ensure output directory exists
if (!(Test-Path $OutDir)) {
    New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
    Write-Host "📁 Created output directory: $OutDir" -ForegroundColor Gray
}

Write-Host "🔧 Generating TypeScript types from proto files..." -ForegroundColor Yellow
Write-Host "   Proto Dir : $ProtoDir" -ForegroundColor Gray
Write-Host "   Output Dir: $OutDir" -ForegroundColor Gray
Write-Host ""

# Find protoc-gen-ts_proto plugin
$TsProtoPlugin = Join-Path $ServiceDir "node_modules\.bin\protoc-gen-ts_proto.cmd"

if (!(Test-Path $TsProtoPlugin)) {
    Write-Host "❌ ts-proto not found at: $TsProtoPlugin" -ForegroundColor Red
    Write-Host "   Run 'npm install' first." -ForegroundColor Yellow
    exit 1
}

# Check if protoc is available
$protocPath = Get-Command protoc -ErrorAction SilentlyContinue
if (!$protocPath) {
    Write-Host "❌ protoc not found in PATH" -ForegroundColor Red
    Write-Host "   Please install Protocol Buffers compiler:" -ForegroundColor Yellow
    Write-Host "   - Windows: choco install protoc" -ForegroundColor Gray
    Write-Host "   - Or download from: https://github.com/protocolbuffers/protobuf/releases" -ForegroundColor Gray
    exit 1
}

# Generate user service types
$UserProto = Join-Path $ProtoDir "user\v1\user.proto"

if (!(Test-Path $UserProto)) {
    Write-Host "❌ Proto file not found: $UserProto" -ForegroundColor Red
    exit 1
}

Write-Host "📄 Processing: user/v1/user.proto" -ForegroundColor Cyan

try {
    & protoc `
        --plugin="protoc-gen-ts_proto=$TsProtoPlugin" `
        --ts_proto_out="$OutDir" `
        --ts_proto_opt=nestJs=true `
        --ts_proto_opt=outputServices=grpc-js `
        --ts_proto_opt=esModuleInterop=true `
        --ts_proto_opt=addGrpcMetadata=true `
        --ts_proto_opt=exportCommonSymbols=false `
        --ts_proto_opt=snakeToCamel=true `
        --ts_proto_opt=useDate=true `
        --ts_proto_opt=oneof=unions `
        -I "$ProtoDir" `
        "$UserProto"

    if ($LASTEXITCODE -ne 0) {
        throw "protoc exited with code $LASTEXITCODE"
    }
}
catch {
    Write-Host "❌ Proto generation failed: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ Proto generation completed!" -ForegroundColor Green
Write-Host "   Generated files:" -ForegroundColor Gray

# List generated files
Get-ChildItem -Path $OutDir -Recurse -Filter "*.ts" | ForEach-Object {
    $relativePath = $_.FullName.Replace($OutDir, "").TrimStart("\")
    Write-Host "   - $relativePath" -ForegroundColor Gray
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
