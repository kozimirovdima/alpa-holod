@echo off
chcp 65001 >nul
title Альфа-Холод - локальный сервер
echo Запускаю сайт на http://localhost:8123
start "" http://localhost:8123
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\serve.ps1" -Port 8123
pause
