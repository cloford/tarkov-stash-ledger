@echo off
cd /d "%~dp0"
start "" powershell.exe -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 3; Start-Process 'http://localhost:3000'"
echo Tarkov Task Extract Navi is running. Close this window to stop it.
npx.cmd vinext dev
