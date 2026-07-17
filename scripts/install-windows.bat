@echo off
REM Nova Windows Installer
REM Installs Nova agentic coding system on Windows

echo ========================================
echo Nova Windows Installer
echo ========================================
echo.

set VERSION=0.2.0-mission-002
set INSTALL_DIR=%LOCALAPPDATA%\Nova
set BIN_DIR=%USERPROFILE%\AppData\Local\Programs\nova

echo Installing Nova %VERSION%...
echo.

echo Creating installation directories...
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
if not exist "%BIN_DIR%" mkdir "%BIN_DIR%"

echo Copying files to installation directory...
xcopy /E /I /Y dist "%INSTALL_DIR%\dist"
xcopy /E /I /Y cockpit "%INSTALL_DIR%\cockpit"
xcopy /E /I /Y node_modules "%INSTALL_DIR%\node_modules"
xcopy /Y package.json "%INSTALL_DIR%\"
xcopy /Y README.md "%INSTALL_DIR%\"
xcopy /Y LICENSE "%INSTALL_DIR%\"
xcopy /Y MISSION-002.md "%INSTALL_DIR%\"
xcopy /Y observer-bundle-mission-002.zip "%INSTALL_DIR%\"
xcopy /E /I /Y docs "%INSTALL_DIR%\docs"
xcopy /E /I /Y config "%INSTALL_DIR%\config"

echo Creating executable...
copy dist\agent\cli.js "%BIN_DIR%\nova.js"
echo @echo off > "%BIN_DIR%\nova.cmd"
echo node "%BIN_DIR%\nova.js" %%* >> "%BIN_DIR%\nova.cmd"

echo Adding to PATH...
setx PATH "%PATH%;%BIN_DIR%" /M

echo ========================================
echo Nova installed successfully!
echo Installation directory: %INSTALL_DIR%
echo Executable: %BIN_DIR%\nova.cmd
echo ========================================
echo.
echo Please restart your terminal to use Nova.
echo Run 'nova --help' to get started.

exit /b 0
