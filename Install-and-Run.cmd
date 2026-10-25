@echo off
setlocal
cd /d "%~dp0"
echo Checking Node.js...
node scripts/check-node.mjs
if errorlevel 1 goto :failed
echo Installing packages from the public npm registry...
call npm.cmd ci --registry=https://registry.npmjs.org/ --include=dev --no-audit --no-fund --fetch-retries=0 --fetch-timeout=30000
if errorlevel 1 goto :failed
echo Starting Memtime at http://localhost:5173 ...
call npm.cmd run dev
exit /b %errorlevel%
:failed
echo.
echo Setup did not finish. Do not run the application until installation succeeds.
echo Check the error above. This script does not modify global npm settings.
pause
exit /b 1
