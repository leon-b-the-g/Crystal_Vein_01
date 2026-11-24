@echo off
rem Work loop for CrystalVein, so Claude can build and save work without a click from you each time.
rem Leave this window open while you work together; close it to stop.
rem
rem It does five fixed jobs. Each starts when an empty request file appears in Saved\DevLoop:
rem   build.request    builds the editor module with Unreal 5.8                    (build.log, build.result)
rem   run.request      starts the game in a window; a bot plays the section, screenshots are saved,
rem                    and the game closes itself after a minute or two            (run.log, run.result, shot_NN.png)
rem   commit.request   git add -A, then git commit with commit.txt as the message  (git.log, commit.result)
rem   push.request     git push to origin, never asking for a sign-in              (git.log, push.result)
rem   editor.request   runs Tools\editor_job.py in the editor without a window: imports the art in
rem                    SourceArt\Meshy, makes the materials the code asks for   (editor.log, editor_job.log, editor.result)
rem A request file is deleted, never read. commit.txt is handed to git as text, never run.
rem One loop only: a second window starts the game twice at the same time (seen on 20 Nov 2026). Three things keep it to one:
rem   a waiting loop rewrites its own loop.NNN.alive every two seconds, and a loop that finds another one on starting stops;
rem   a request is taken by renaming it, which only one loop can do;
rem   whoever makes a request can count the fresh loop.*.alive files first (Tools\preflight.mjs does): one is right.
rem Close the Unreal editor before a build or an editor job: it holds the module and the assets open.
setlocal
set "UE=C:\Program Files\Epic Games\UE_5.8"
set "DIR=%~dp0Saved\DevLoop"
if not exist "%UE%\Engine\Build\BatchFiles\Build.bat" (
  echo Unreal 5.8 was not found at "%UE%". Correct the path at the top of this file.
  pause
  exit /b 1
)
if not exist "%DIR%" mkdir "%DIR%"
title CrystalVein work loop
set "ME=%RANDOM%%RANDOM%"
del "%DIR%\loop.*.alive" 2>nul
> "%DIR%\loop.%ME%.alive" echo %date% %time%
echo Checking that no other work loop is open ...
timeout /t 6 /nobreak >nul
for %%F in ("%DIR%\loop.*.alive") do if /i not "%%~nxF"=="loop.%ME%.alive" goto second
echo Work loop for CrystalVein. Leave this window open; close it to stop.
echo Waiting for requests in "%DIR%" ...
:wait
> "%DIR%\loop.%ME%.alive" echo %date% %time%
if exist "%DIR%\build.request" goto build
if exist "%DIR%\run.request" goto run
if exist "%DIR%\commit.request" goto commit
if exist "%DIR%\push.request" goto push
if exist "%DIR%\editor.request" goto editor
:idle
timeout /t 2 /nobreak >nul
goto wait

:second
echo.
echo Another work loop is already open, so this one stops: two loops start the game twice at the same time.
echo Close this window. If no other work loop window is open, start DevLoop.bat again.
del "%DIR%\loop.%ME%.alive" 2>nul
pause
exit /b 1

:build
del "%DIR%\build.taking" 2>nul
ren "%DIR%\build.request" build.taking 2>nul || goto idle
del "%DIR%\build.taking" 2>nul
if exist "%DIR%\build.result" del "%DIR%\build.result"
echo [%time%] building
call "%UE%\Engine\Build\BatchFiles\Build.bat" CrystalVeinEditor Win64 Development -Project="%~dp0CrystalVein.uproject" -WaitMutex > "%DIR%\build.log" 2>&1
set "RC=%errorlevel%"
> "%DIR%\build.result" echo %RC%
echo [%time%] build finished with exit code %RC%
goto wait

:run
del "%DIR%\run.taking" 2>nul
ren "%DIR%\run.request" run.taking 2>nul || goto idle
del "%DIR%\run.taking" 2>nul
if exist "%DIR%\run.result" del "%DIR%\run.result"
echo [%time%] running the game by itself
start "" /wait "%UE%\Engine\Binaries\Win64\UnrealEditor.exe" "%~dp0CrystalVein.uproject" -game -windowed -ResX=1600 -ResY=900 -CVDemo -unattended -nosplash -abslog="%DIR%\run.log"
set "RC=%errorlevel%"
> "%DIR%\run.result" echo %RC%
echo [%time%] run finished with exit code %RC%
goto wait

:commit
del "%DIR%\commit.taking" 2>nul
ren "%DIR%\commit.request" commit.taking 2>nul || goto idle
del "%DIR%\commit.taking" 2>nul
if exist "%DIR%\commit.result" del "%DIR%\commit.result"
echo [%time%] committing
pushd "%~dp0"
type nul > "%DIR%\git.log"
if not exist ".git" (
  git init -b main >> "%DIR%\git.log" 2>&1
  git lfs install --local >> "%DIR%\git.log" 2>&1
  git remote add origin https://github.com/leon-b-the-g/Crystal_Vein_01.git >> "%DIR%\git.log" 2>&1
)
git add -A >> "%DIR%\git.log" 2>&1
git commit -F "%DIR%\commit.txt" >> "%DIR%\git.log" 2>&1
set "RC=%errorlevel%"
popd
> "%DIR%\commit.result" echo %RC%
echo [%time%] commit finished with exit code %RC%
goto wait

:push
del "%DIR%\push.taking" 2>nul
ren "%DIR%\push.request" push.taking 2>nul || goto idle
del "%DIR%\push.taking" 2>nul
if exist "%DIR%\push.result" del "%DIR%\push.result"
echo [%time%] pushing
pushd "%~dp0"
set "GIT_TERMINAL_PROMPT=0"
set "GCM_INTERACTIVE=Never"
git push -u origin HEAD > "%DIR%\git.log" 2>&1
set "RC=%errorlevel%"
popd
> "%DIR%\push.result" echo %RC%
echo [%time%] push finished with exit code %RC%
goto wait

:editor
del "%DIR%\editor.taking" 2>nul
ren "%DIR%\editor.request" editor.taking 2>nul || goto idle
del "%DIR%\editor.taking" 2>nul
if exist "%DIR%\editor.result" del "%DIR%\editor.result"
echo [%time%] running the editor job
"%UE%\Engine\Binaries\Win64\UnrealEditor-Cmd.exe" "%~dp0CrystalVein.uproject" -run=pythonscript -script="%~dp0Tools\editor_job.py" -unattended -nosplash -nullrhi -stdout -FullStdOutLogOutput > "%DIR%\editor.log" 2>&1
set "RC=%errorlevel%"
> "%DIR%\editor.result" echo %RC%
echo [%time%] editor job finished with exit code %RC%
goto wait
