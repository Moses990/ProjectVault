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
  if not "%NO_PAUSE%"=="1" pause
  exit /b 1
)

echo.
echo One-click project archive refresh
echo.
echo This will:
echo - scan project folders
echo - update meeting AI notes using cache and rule extraction
echo - generate project_index.xlsx
echo - generate monitor reports
echo.
echo Local model is not required. If meeting notes are very long, this avoids waiting on LM Studio.
echo.

"%PYTHON_EXE%" "%CODE_DIR%project_system.py" refresh
set "EXIT_CODE=%ERRORLEVEL%"

echo.
if "%EXIT_CODE%"=="0" (
  echo Done. Project archive is updated.
) else (
  echo Failed with code %EXIT_CODE%.
)
echo.

if not "%NO_PAUSE%"=="1" pause
exit /b %EXIT_CODE%
