@echo off
setlocal enabledelayedexpansion

:: ================================================
:: Sync proto files from packages/proto (source of truth)
:: to service/user-service/proto (runtime artifact)
:: ================================================

set "SCRIPT_DIR=%~dp0"
set "SERVICE_DIR=%SCRIPT_DIR%.."
pushd "%SERVICE_DIR%"
set "SERVICE_DIR=%CD%"
popd

pushd "%SERVICE_DIR%\..\..\packages\proto"
set "PROTO_SRC=%CD%"
popd

set "PROTO_DEST=%SERVICE_DIR%\proto"

echo.
echo ================================================
echo   Proto Sync: packages/proto -^> service/proto
echo ================================================
echo.
echo    Source : %PROTO_SRC%
echo    Dest   : %PROTO_DEST%
echo.

:: Clean and recreate destination
if exist "%PROTO_DEST%" (
    rmdir /s /q "%PROTO_DEST%"
)
mkdir "%PROTO_DEST%"

:: Copy user proto files
xcopy /E /I /Y "%PROTO_SRC%\user" "%PROTO_DEST%\user" >nul

:: Copy common proto files if they exist
if exist "%PROTO_SRC%\common" (
    xcopy /E /I /Y "%PROTO_SRC%\common" "%PROTO_DEST%\common" >nul
)

echo Proto files synced successfully!
echo.

:: List synced files
echo Synced files:
for /r "%PROTO_DEST%" %%f in (*.proto) do (
    set "filepath=%%f"
    set "relative=!filepath:%PROTO_DEST%\=!"
    echo    - !relative!
)

echo.
echo ================================================

endlocal
