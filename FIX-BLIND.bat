@echo off
title CodeType - blind 3CH fixer
cd /d "%~dp0"
node "%~dp0fix-blind.cjs"
echo.
pause
