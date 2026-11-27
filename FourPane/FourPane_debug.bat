@echo off
rem FourPane debug launcher - keeps the console open to show errors
powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -NoExit -File "%~dp0FourPane.ps1"
