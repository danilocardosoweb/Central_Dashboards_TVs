@echo off
cd /d "%~dp0"
start "" powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "scripts\capture-local-gui.ps1"
exit /b
