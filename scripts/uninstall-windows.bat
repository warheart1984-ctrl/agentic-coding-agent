@echo off
REM Nova Windows Uninstaller
REM Uninstalls Nova agentic coding system from Windows

echo ========================================
echo Nova Windows Uninstaller
echo ========================================
echo.

set INSTALL_DIR=%LOCALAPPDATA%\Nova
set BIN_DIR=%USERPROFILE%\AppData\Local\Programs\nova

echo Uninstalling Nova...
echo.

echo Removing installation directory...
if exist "%INSTALL_DIR%" (
    rmdir /s /q "%INSTALL_DIR%"
    echo Installation directory removed.
) else (
    echo Installation directory not found.
)

echo Removing executable...
if exist "%BIN_DIR%\nova.js" del "%BIN_DIR%\nova.js"
if exist "%BIN_DIR%\nova.cmd" del "%BIN_DIR%\nova.cmd"

echo Removing from PATH...
setx PATH "%PATH:%BIN_DIR%" /M

echo ========================================
echo Nova uninstalled successfully!
echo ========================================

exit /b 0
