@echo off
rem Work loop for CrystalVein, so Claude can build and save work without a click from you each time.
rem Leave this window open while you work together; close it to stop.
rem
rem It does three fixed jobs. Each starts when an empty request file appears in Saved\DevLoop:
rem   build.request    builds the editor module with Unreal 5.8                    (build.log, build.result)
rem   commit.request   git add -A, then git commit with commit.txt as the message  (git.log, commit.result)
rem   push.request     git push to origin                                          (git.log, push.result)
rem A request file is deleted, never read. commit.txt is handed to git as text, never run.
rem Close the Unreal editor before a build: it holds the module open.
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
echo Work loop for CrystalVein. Leave this window open; close it to stop.
echo Waiting for requests in "%DIR%" ...
:wait
if exist "%DIR%\build.request" goto build
if exist "%DIR%\commit.request" goto commit
if exist "%DIR%\push.request" goto push
timeout /t 2 /nobreak >nul
goto wait

:build
del "%DIR%\build.request"
if exist "%DIR%\build.result" del "%DIR%\build.result"
echo [%time%] building
call "%UE%\Engine\Build\BatchFiles\Build.bat" CrystalVeinEditor Win64 Development -Project="%~dp0CrystalVein.uproject" -WaitMutex > "%DIR%\build.log" 2>&1
set "RC=%errorlevel%"
> "%DIR%\build.result" echo %RC%
echo [%time%] build finished with exit code %RC%
goto wait

:commit
del "%DIR%\commit.request"
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
del "%DIR%\push.request"
if exist "%DIR%\push.result" del "%DIR%\push.result"
echo [%time%] pushing
pushd "%~dp0"
git push -u origin HEAD > "%DIR%\git.log" 2>&1
set "RC=%errorlevel%"
popd
> "%DIR%\push.result" echo %RC%
echo [%time%] push finished with exit code %RC%
goto wait
