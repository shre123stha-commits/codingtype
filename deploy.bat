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
git commit -m "v1.8.0 - professional release: about/faq/contact/waitlist pages, custom 404, ad slots, cookie consent, analytics, SEO (sitemap/og/llms.txt/structured data), favicon, keyboard help, password show/hide"
echo.
echo  3. Pushing to the live site...
git push
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
echo  now say  v1.8.0   (it used to say v1.7.2).
echo  If it says v1.8.0 - the new site footer, the
echo  About/FAQ/Contact/Waitlist pages and the ad slots
echo  are live. If v1.7.2 or older - this folder was
echo  not the one that got pushed.
echo.
:end
pause
