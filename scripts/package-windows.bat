@echo off
REM Nova Windows Package Builder
REM Builds Windows distribution package for agentic-coding-agent

echo ========================================
echo Nova Windows Package Builder
echo ========================================
echo.

set VERSION=0.4.0-mission-004
set PACKAGE_NAME=nova-windows-%VERSION%
set BUILD_DIR=build\windows
set OUTPUT_DIR=dist\packages

echo Cleaning previous build...
if exist %BUILD_DIR% rmdir /s /q %BUILD_DIR%
if exist %OUTPUT_DIR% rmdir /s /q %OUTPUT_DIR%

echo Creating build directories...
if not exist %BUILD_DIR% mkdir %BUILD_DIR%
if not exist %OUTPUT_DIR% mkdir %OUTPUT_DIR%

echo Building project...
call npm run build
if errorlevel 1 (
    echo Build failed!
    exit /b 1
)

echo Building cockpit...
cd cockpit
call npm run build
if errorlevel 1 (
    echo Cockpit build failed!
    cd ..
    exit /b 1
)
cd ..

echo Copying files to package...
xcopy dist %BUILD_DIR%\dist\ /E /I /Y
xcopy cockpit\dist %BUILD_DIR%\cockpit\dist\ /E /I /Y
xcopy cockpit\package.json %BUILD_DIR%\cockpit\ /Y
xcopy cockpit\package-lock.json %BUILD_DIR%\cockpit\ /Y
xcopy node_modules %BUILD_DIR%\node_modules\ /E /I /Y
xcopy inas %BUILD_DIR%\inas\ /E /I /Y
xcopy agent %BUILD_DIR%\agent\ /E /I /Y
xcopy backend %BUILD_DIR%\backend\ /E /I /Y
xcopy shell %BUILD_DIR%\shell\ /E /I /Y
xcopy scripts %BUILD_DIR%\scripts\ /E /I /Y
xcopy docs %BUILD_DIR%\docs\ /E /I /Y
xcopy config %BUILD_DIR%\config\ /E /I /Y
xcopy package.json %BUILD_DIR%\ /Y
xcopy package-lock.json %BUILD_DIR%\ /Y
xcopy README.md %BUILD_DIR%\ /Y
xcopy LICENSE %BUILD_DIR%\ /Y
xcopy scripts\install-windows.bat %BUILD_DIR%\ /Y
xcopy scripts\uninstall-windows.bat %BUILD_DIR%\ /Y

echo Creating Windows executable...
copy dist\agent\cli.js %BUILD_DIR%\nova.js
echo @echo off > %BUILD_DIR%\nova.cmd
echo node %~dp0nova.js %%* >> %BUILD_DIR%\nova.cmd

echo Creating package...
cd %BUILD_DIR%
powershell -Command "Compress-Archive -Path * -DestinationPath '..\..\dist\packages\%PACKAGE_NAME%.zip' -Force"
cd ..

echo ========================================
echo Windows package created successfully!
echo Package: %OUTPUT_DIR%\%PACKAGE_NAME%.zip
echo ========================================

exit /b 0
