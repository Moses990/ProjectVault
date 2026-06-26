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
if "%~1"=="" (
  echo.
  echo Drag a requirement file or folder onto this BAT file.
  echo.
  echo Supported file types inside files/folders:
  echo   .txt  .md  .docx  .pdf
  echo.
  if not "%NO_PAUSE%"=="1" pause
  exit /b 1
)

if not exist "%~1" (
  echo.
  echo File not found:
  echo %~1
  echo.
  if not "%NO_PAUSE%"=="1" pause
  exit /b 1
)

if not exist "%AI_OUTPUT_DIR%" mkdir "%AI_OUTPUT_DIR%"
set "INPUT_PATH=%~1"

echo.
echo Extracting requirements. Please wait...
echo Input: %INPUT_PATH%
echo Result folder: %AI_OUTPUT_DIR%
echo.

"%PYTHON_EXE%" "%CODE_DIR%project_system.py" ai "%INPUT_PATH%" --show-model --result-dir "%AI_OUTPUT_DIR%" --write-project-json
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
  echo.
  echo Extraction failed. Please check:
  echo 1. LM Studio is running
  echo 2. A model is loaded
  echo 3. The file type is supported
  echo 4. The dragged file/folder is inside a project folder
  echo.
  if not "%NO_PAUSE%"=="1" pause
  exit /b %EXIT_CODE%
)

echo.
echo Done.
echo The requirement result has also been merged into the project.json of this project.
echo.
if not "%NO_PAUSE%"=="1" pause
