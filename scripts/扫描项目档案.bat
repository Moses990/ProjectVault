@echo off
chcp 65001 >nul
setlocal

set "SCRIPT_DIR=%~dp0"
set "SYSTEM_DIR=%SCRIPT_DIR%..\"
set "CODE_DIR=%SYSTEM_DIR%code\"
set "OUTPUT_DIR=%SYSTEM_DIR%output\"
set "AI_OUTPUT_DIR=%OUTPUT_DIR%ai_results\"
set "PYTHONUTF8=1"
set "PYTHONIOENCODING=utf-8"

cd /d "%SYSTEM_DIR%"

call "%SCRIPT_DIR%_resolve_python.bat"
if errorlevel 1 (
  echo Python 3.10+ not found. Please install Python or set PROJECT_SYSTEM_PYTHON.
  if not "%NO_PAUSE%"=="1" pause
  exit /b 1
)
echo.
echo Scanning projects and updating project.json
echo.

"%PYTHON_EXE%" "%CODE_DIR%project_system.py" scan
set "EXIT_CODE=%ERRORLEVEL%"

echo.
if "%EXIT_CODE%"=="0" (
  echo Done. project.json files are updated.
) else (
  echo Failed with code %EXIT_CODE%.
)
echo.

if not "%NO_PAUSE%"=="1" pause
exit /b %EXIT_CODE%
