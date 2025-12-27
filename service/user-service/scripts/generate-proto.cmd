    @echo off
setlocal enabledelayedexpansion

:: Auto-generate TypeScript types from proto files

:: Get paths
set "SCRIPT_DIR=%~dp0"
set "SERVICE_DIR=%SCRIPT_DIR%.."
pushd "%SERVICE_DIR%"
set "SERVICE_DIR=%CD%"
popd

pushd "%SERVICE_DIR%\..\..\packages\proto"
set "PROTO_DIR=%CD%"
popd

set "OUT_DIR=%SERVICE_DIR%\src\generated"

echo.
echo ================================================
echo   Proto TypeScript Generator
echo ================================================
echo.

:: Ensure output directory exists
if not exist "%OUT_DIR%" (
    mkdir "%OUT_DIR%"
    echo Created output directory: %OUT_DIR%
)

echo Generating TypeScript types from proto files...
echo    Proto Dir : %PROTO_DIR%
echo    Output Dir: %OUT_DIR%
echo.

:: Find protoc-gen-ts_proto plugin
set "TS_PROTO_PLUGIN=%SERVICE_DIR%\node_modules\.bin\protoc-gen-ts_proto.cmd"

if not exist "%TS_PROTO_PLUGIN%" (
    echo ERROR: ts-proto not found at: %TS_PROTO_PLUGIN%
    echo    Run 'npm install' first.
    exit /b 1
)

:: Check if protoc is available
where protoc >nul 2>nul
if errorlevel 1 (
    echo ERROR: protoc not found in PATH
    echo    Please install Protocol Buffers compiler:
    echo    - Windows: choco install protoc
    echo    - Or download from: https://github.com/protocolbuffers/protobuf/releases
    exit /b 1
)

:: Generate user service types
set "USER_PROTO=%PROTO_DIR%\user\v1\user.proto"

if not exist "%USER_PROTO%" (
    echo ERROR: Proto file not found: %USER_PROTO%
    exit /b 1
)

echo Processing: user/v1/user.proto

protoc ^
    --plugin="protoc-gen-ts_proto=%TS_PROTO_PLUGIN%" ^
    --ts_proto_out="%OUT_DIR%" ^
    --ts_proto_opt=nestJs=true ^
    --ts_proto_opt=outputServices=grpc-js ^
    --ts_proto_opt=esModuleInterop=true ^
    --ts_proto_opt=addGrpcMetadata=true ^
    --ts_proto_opt=exportCommonSymbols=false ^
    --ts_proto_opt=snakeToCamel=true ^
    --ts_proto_opt=useDate=true ^
    --ts_proto_opt=oneof=unions ^
    -I "%PROTO_DIR%" ^
    "%USER_PROTO%"

if errorlevel 1 (
    echo ERROR: Proto generation failed!
    exit /b 1
)

echo.
echo Proto generation completed!
echo    Generated files in: %OUT_DIR%

:: List generated files
echo    Generated files:
for /r "%OUT_DIR%" %%f in (*.ts) do (
    set "filepath=%%f"
    set "relative=!filepath:%OUT_DIR%\=!"
    echo    - !relative!
)

echo.
echo ================================================

endlocal
