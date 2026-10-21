@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 20 or newer is needed for the local sync experiment.
  echo For the zero-install offline demo, open portable\HAIZ-Classroom.html.
  pause
  exit /b 1
)
node scripts\classroom-server.mjs
pause
