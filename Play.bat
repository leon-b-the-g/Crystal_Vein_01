@echo off
rem Plays the game in its own window, without the editor. Needs a finished build (BuildAndOpen.bat or the work loop).
rem Not while the work loop is building or doing a demo run.
start "" "C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor.exe" "%~dp0CrystalVein.uproject" -game -windowed -ResX=1600 -ResY=900 -nosplash
