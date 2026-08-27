@echo off
setlocal
cd /d "%~dp0"
start "Monitor das TVs Roku" powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0scripts\roku-tv-monitor.ps1"
endlocal
