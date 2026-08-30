@echo off
cd /d "%~dp0"
echo.
echo  ============================================
echo    CODETYPE - START / UPDATE  (v1.8.0)
echo  ============================================
echo.
echo  [1/4] Closing any old CodeType server...
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -like '*codetype*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force; Write-Host ('  stopped old server pid ' + $_.ProcessId) }"
timeout /t 2 /nobreak >nul
echo.
echo  [2/4] Checking dependencies (first time only, takes 1-2 min)...
if not exist "backend\node_modules" (
  pushd backend
  call npm install --no-audit --no-fund
  popd
)
if not exist "frontend\node_modules" (
  pushd frontend
  call npm install --no-audit --no-fund
  popd
)
echo.
echo  [3/4] Starting API server...
pushd backend
start "CodeType API" cmd /k "node server.js"
popd
echo.
echo  [4/4] Starting website...
pushd frontend
start "CodeType Web" cmd /k "npm run dev"
popd
cd /d "%~dp0"
echo.
echo  ============================================
echo    WAIT 10-15 SECONDS, then open in browser:
echo
echo        http://localhost:5173
echo
echo    (hold Ctrl while clicking the refresh button)
echo  ============================================
echo    CHECK: the top-right corner of the page
echo    must now say  v1.8.0
echo    If it says v1.4.0 (or anything older) -
echo    this folder was not used, the old one is
echo    still running.
echo  ============================================
echo.
pause
