@echo off

set "PYTHON_EXE="

if defined PROJECT_SYSTEM_PYTHON (
  if exist "%PROJECT_SYSTEM_PYTHON%" set "PYTHON_EXE=%PROJECT_SYSTEM_PYTHON%"
)

if not defined PYTHON_EXE (
  for %%P in (
    "C:\Python314\python.exe"
    "C:\Users\admin\AppData\Local\Programs\Python\Python314\python.exe"
    "C:\Users\admin\AppData\Local\Programs\Python\Python313\python.exe"
    "C:\Users\admin\AppData\Local\Programs\Python\Python312\python.exe"
  ) do (
    if exist "%%~fP" if not defined PYTHON_EXE set "PYTHON_EXE=%%~fP"
  )
)

if not defined PYTHON_EXE (
  for %%C in (python py) do (
    where.exe %%C >nul 2>nul
    if not errorlevel 1 (
      for /f "delims=" %%P in ('where.exe %%C 2^>nul') do (
        if not defined PYTHON_EXE set "PYTHON_EXE=%%P"
      )
    )
  )
)

if not defined PYTHON_EXE exit /b 1

"%PYTHON_EXE%" -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 10) else 1)" >nul 2>nul
if errorlevel 1 exit /b 2

exit /b 0
