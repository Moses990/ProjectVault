@echo off
chcp 65001 >nul
setlocal

set "SCRIPT_DIR=%~dp0"
set "SYSTEM_DIR=%SCRIPT_DIR%..\"
set "CODE_DIR=%SYSTEM_DIR%code\"
set "PYTHONUTF8=1"
set "PYTHONIOENCODING=utf-8"

cd /d "%SYSTEM_DIR%"

call "%SCRIPT_DIR%_resolve_python.bat"
if errorlevel 1 (
  echo Python 3.10+ not found. Please install Python or set PROJECT_SYSTEM_PYTHON.
  pause
  exit /b 1
)

echo Starting Project Library Dashboard...
echo Visit: http://127.0.0.1:8765/
echo Press Ctrl+C to stop.
echo.

start /b cmd /c "timeout /t 2 /nobreak >nul && start http://127.0.0.1:8765/"
"%PYTHON_EXE%" "%CODE_DIR%web_dashboard.py"

echo.
echo Dashboard stopped.
pause
