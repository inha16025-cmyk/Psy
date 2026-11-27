@echo off
rem FourPane launcher (normal user rights - do NOT run as administrator)
start "" powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0FourPane.ps1"
