@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Aggiornamento WebApp su GitHub

echo ======================================================================
echo          AGGIORNAMENTO WEBAPP SU GITHUB PER RENDER.COM
echo ======================================================================
echo.

set "GIT_CMD=git"
where git >nul 2>&1
if errorlevel 1 (
    if exist "C:\Program Files\Git\cmd\git.exe" (
        set "GIT_CMD=C:\Program Files\Git\cmd\git.exe"
    ) else if exist "C:\Users\%USERNAME%\AppData\Local\Programs\Git\cmd\git.exe" (
        set "GIT_CMD=C:\Users\%USERNAME%\AppData\Local\Programs\Git\cmd\git.exe"
    )
)

echo.
echo [1/2] Verifica e preparazione dei file...
"%GIT_CMD%" add .
"%GIT_CMD%" commit -m "Supporto database cloud Turso per salvataggio permanente dei dati" >nul 2>&1

echo.
echo [2/2] Invio dei file a GitHub...
echo (Se ti si apre una finestrella nel browser per accedere a GitHub, autorizzala!)
"%GIT_CMD%" push origin main

echo.
echo ======================================================================
echo                      OPERAZIONE COMPLETATA!
echo ======================================================================
echo.
echo Se vedi scritto "main -> main", i file sono ora su GitHub!
echo Render.com iniziera' automaticamente ad aggiornare il tuo sito web.
echo.
echo Premi un tasto per chiudere...
pause >nul
