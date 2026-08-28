@echo off
cd /d "%~dp0"
echo.
echo  ============================================
echo    CODETYPE - ONE-CLICK DEPLOY
echo  ============================================
echo.
echo  1. Adding all changed files...
git add -A
echo.
echo  2. Committing...
git commit -m "v1.4 - glide caret fixed (rides on the words), WPM race"
echo.
echo  3. Pushing to the live site...
git push
echo.
if %errorlevel% neq 0 (
  echo  ============================================
  echo    PUSH FAILED - read the error above.
  echo  ============================================
  echo  Common fixes:
  echo   - Make sure you are connected to the internet.
  echo   - Make sure git is signed in (if it asks, open
  echo     your browser link once to allow it).
  echo  Fix it and double-click this file again.
  goto end
)
echo  ============================================
echo    DONE - DEPLOY STARTED
echo  ============================================
echo  Wait about 1 minute, then refresh the site
echo  (hold Ctrl while clicking the refresh button).
echo.
echo  CHECK: the top-right corner of the app should
echo  now say  v1.4.0   (it used to say v1.3.0).
echo  If it says v1.4.0 - the fixed cursors + WPM
echo  race are live. If it still says v1.3.0 -
echo  this folder was not the one that got pushed.
echo.
:end
pause
