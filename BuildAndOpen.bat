@echo off
rem Builds the CrystalVein editor module with Unreal 5.8, then opens the project in the 5.8 editor.
rem The engine is named here on purpose: on 11 Nov 2026 the .uproject was switched to 5.6, whose build tool
rem cannot read this project (it has no BuildSettingsVersion.V7 and no Unreal5_8 include order).
set "UE=C:\Program Files\Epic Games\UE_5.8"
if not exist "%UE%\Engine\Build\BatchFiles\Build.bat" (
  echo Unreal 5.8 was not found at "%UE%". Correct the path at the top of this file.
  pause
  exit /b 1
)
call "%UE%\Engine\Build\BatchFiles\Build.bat" CrystalVeinEditor Win64 Development -Project="%~dp0CrystalVein.uproject" -WaitMutex
if errorlevel 1 (
  echo.
  echo The build failed. The full log is in %LOCALAPPDATA%\UnrealBuildTool\Log.txt
  pause
  exit /b 1
)
start "" "%UE%\Engine\Binaries\Win64\UnrealEditor.exe" "%~dp0CrystalVein.uproject"
