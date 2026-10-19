@echo off
rem OTOCH local development: one window per part, from any folder.
rem
rem   dev.cmd          API + admin web + mobile app (Expo)
rem   dev.cmd web      API + admin web
rem   dev.cmd app      API + mobile app (Expo)
rem   dev.cmd api      API only
rem
rem Close a window (or Ctrl+C in it) to stop that part. The API window
rem stops an API it left running on port 8000 before it starts again.
setlocal
set "ROOT=%~dp0"
set "WHAT=%~1"
if "%WHAT%"=="" set "WHAT=all"

if /I not "%WHAT%"=="all" if /I not "%WHAT%"=="web" if /I not "%WHAT%"=="app" if /I not "%WHAT%"=="api" (
  echo Unknown option "%WHAT%". Use: dev.cmd [web^|app^|api]
  exit /b 1
)

if not exist "%ROOT%server\node_modules" (
  echo server\node_modules is missing. Run once: cd "%ROOT%server" ^&^& npm install
  exit /b 1
)

echo Starting the API on http://localhost:8000 ...
start "OTOCH API :8000" /D "%ROOT%server" cmd /k npm run dev:local

if /I "%WHAT%"=="all" call :web
if /I "%WHAT%"=="web" call :web
if /I "%WHAT%"=="all" call :app
if /I "%WHAT%"=="app" call :app
exit /b 0

:web
if not exist "%ROOT%wclient\node_modules" (
  echo wclient\node_modules is missing. Run once: cd "%ROOT%wclient" ^&^& npm install
  exit /b 0
)
echo Starting the admin web on http://localhost:3000 ...
start "OTOCH admin web :3000" /D "%ROOT%wclient" cmd /k npm run dev
rem open the browser once the web server had time to start
start "" /MIN cmd /c "timeout /t 12 /nobreak >nul & start http://localhost:3000"
exit /b 0

:app
if not exist "%ROOT%App\node_modules" (
  echo App\node_modules is missing. Run once: cd "%ROOT%App" ^&^& npm install
  exit /b 0
)
echo Starting Expo (scan the QR code with Expo Go) ...
start "OTOCH Expo" /D "%ROOT%App" cmd /k npx expo start -c
exit /b 0
