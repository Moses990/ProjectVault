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
:MENU
cls
echo ========================================
echo Project Library System
echo ========================================
echo.
echo 1. Scan projects only
echo 2. Generate project_index.xlsx only
echo 3. One-click refresh project archive
echo 4. Migrate historical project.json to Schema 2.0
echo 5. Start watcher
echo 6. Generate monitor reports
echo 7. Update project AI archive
echo 8. Show project AI timeline
echo 9. Search project AI notes
echo 10. List project meetings
echo 11. Show meeting detail
echo 12. List project AI risks
echo 13. Exit
echo.
set /p "CHOICE=Choose 1-13: "
if "%CHOICE%"=="" (
  if "%NO_PAUSE%"=="1" exit /b 0
)

if "%CHOICE%"=="1" (
  "%PYTHON_EXE%" "%CODE_DIR%project_system.py" scan
  pause
  goto MENU
)

if "%CHOICE%"=="2" (
  "%PYTHON_EXE%" "%CODE_DIR%project_system.py" index
  pause
  goto MENU
)

if "%CHOICE%"=="3" (
  "%PYTHON_EXE%" "%CODE_DIR%project_system.py" refresh
  pause
  goto MENU
)

if "%CHOICE%"=="4" (
  "%PYTHON_EXE%" "%CODE_DIR%project_system.py" migrate
  pause
  goto MENU
)

if "%CHOICE%"=="5" (
  echo.
  echo Watcher will keep running. Press Ctrl+C to stop it.
  echo.
  "%PYTHON_EXE%" "%CODE_DIR%project_system.py" watch
  pause
  goto MENU
)

if "%CHOICE%"=="6" (
  "%PYTHON_EXE%" "%CODE_DIR%project_system.py" monitor
  pause
  goto MENU
)

if "%CHOICE%"=="7" (
  set /p "PROJECT_NAME=Project folder name: "
  "%PYTHON_EXE%" "%CODE_DIR%project_system.py" ai-update "%PROJECT_NAME%" --result-dir "%AI_OUTPUT_DIR%"
  pause
  goto MENU
)

if "%CHOICE%"=="8" (
  set /p "PROJECT_NAME=Project folder name: "
  "%PYTHON_EXE%" "%CODE_DIR%project_system.py" ai-timeline "%PROJECT_NAME%"
  pause
  goto MENU
)

if "%CHOICE%"=="9" (
  set /p "PROJECT_NAME=Project folder name: "
  set /p "QUERY=Search keywords: "
  "%PYTHON_EXE%" "%CODE_DIR%project_system.py" ai-search "%PROJECT_NAME%" "%QUERY%"
  pause
  goto MENU
)

if "%CHOICE%"=="10" (
  set /p "PROJECT_NAME=Project folder name: "
  set /p "QUERY=Filter keywords, leave blank for all: "
  if "%QUERY%"=="" (
    "%PYTHON_EXE%" "%CODE_DIR%project_system.py" ai-meetings "%PROJECT_NAME%"
  ) else (
    "%PYTHON_EXE%" "%CODE_DIR%project_system.py" ai-meetings "%PROJECT_NAME%" "%QUERY%"
  )
  pause
  goto MENU
)

if "%CHOICE%"=="11" (
  set /p "PROJECT_NAME=Project folder name: "
  set /p "QUERY=Meeting date/title/keywords, leave blank for first: "
  if "%QUERY%"=="" (
    "%PYTHON_EXE%" "%CODE_DIR%project_system.py" ai-meeting "%PROJECT_NAME%"
  ) else (
    "%PYTHON_EXE%" "%CODE_DIR%project_system.py" ai-meeting "%PROJECT_NAME%" "%QUERY%"
  )
  pause
  goto MENU
)

if "%CHOICE%"=="12" (
  set /p "PROJECT_NAME=Project folder name: "
  "%PYTHON_EXE%" "%CODE_DIR%project_system.py" ai-risks "%PROJECT_NAME%"
  pause
  goto MENU
)

if "%CHOICE%"=="13" (
  exit /b 0
)

echo Invalid choice.
pause
goto MENU
