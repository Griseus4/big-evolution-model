@echo off
setlocal
chcp 65001 >nul
title Big Evolution
if exist "%~dp0.venv\Scripts\python.exe" (
  "%~dp0.venv\Scripts\python.exe" -X utf8 "%~dp0tools\open-game.py"
  goto finished
)
if exist "D:\Programs\anaconda3\python.exe" (
  "D:\Programs\anaconda3\python.exe" -X utf8 "%~dp0tools\open-game.py"
  goto finished
)
where py >nul 2>&1
if not errorlevel 1 (
  py -3 -X utf8 "%~dp0tools\open-game.py"
  goto finished
)
python -X utf8 "%~dp0tools\open-game.py"
:finished
if errorlevel 1 pause
