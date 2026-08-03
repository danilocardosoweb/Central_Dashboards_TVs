@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\capture-local-upload.ps1" -Visible
echo.
pause
