# Kestrel Vane, the Unreal build (project name: CrystalVein)

Unreal Engine 5.8, C++. Greybox of Act I, section 1 (Cargo and Maintenance).

The game rules do not live here. They run in the TypeScript sim (`lb-systems/apps/x-stranded/src`), the same code as the web
alpha. Unreal draws what the sim reports and sends the player's input back. For now the sim runs beside Unreal as a small
Node process (`Sim/sidecar.mjs`) that Unreal starts on Play and that quits when Play ends.

## First run

Needs: Unreal 5.8, Visual Studio with the "Game development with C++" workload, Node.js 18 or newer on the PATH.

1. Double-click `BuildAndOpen.bat`. It builds the module with Unreal 5.8 and then opens the project in the 5.8 editor.
2. In the editor press **Play**, then click once in the viewport so it has the keyboard.

If the build fails, the compiler output is in `%LOCALAPPDATA%\UnrealBuildTool\Log.txt`.

Why the script: this project only builds with 5.8. If Windows asks which engine version to use, or you use
"Switch Unreal Engine version", pick 5.8. With 5.6 the build stops at once with
`'BuildSettingsVersion' does not contain a definition for 'V7'`. Once it has built, double-clicking the `.uproject` works too.

## Build loop for Claude

`DevLoop.bat` lets Claude compile without a click from you each time. Double-click it and leave the window open.
It runs one fixed command, the Unreal 5.8 build of this project, whenever the file `Saved\DevLoop\build.request` appears,
and writes `build.log` and `build.result` beside it. It never reads or runs what is in the request file. Close the window to stop it.
Close the Unreal editor before a build.

## Controls

| | Keyboard and mouse | Gamepad |
|---|---|---|
| Move | WASD or arrows | Left stick |
| Aim | Mouse | Right stick |
| Strike | Left click | RT |
| Sprint / crouch | Shift / Ctrl or C | LT / click right stick |
| Use, search, open, pick up | E | A |
| Flashlight (mash it when it dies) | F | Y |
| Vault | Space | B |
| Quick slots | 1 to 4 | D-pad |
| Swap / drop weapon | Q / X | RB / none |
| Close a note | E, Enter, Space | A, B |
| Start again (dead, or section clear) | R, Enter | A |

## When the sim changes

In `lb-systems/apps/x-stranded`: `npm run sim:unreal`. It rewrites `Sim/sim/` here (plain JS, types stripped). Then press Play again.
`Sim/sim/` is build output: never edit it by hand.

## Layout

- `Source/CrystalVein/CVSimLink.*`: starts the sim, reads level and snapshots, sends input. The only file that knows about the sidecar.
- `Source/CrystalVein/CVWorldView.*`: draws the deck. Its table of kinds is the list of meshes to replace with art.
- `Source/CrystalVein/CVPawn.*`: body, flashlight, isometric camera, exposure (dark adaptation).
- `Source/CrystalVein/CVPlayerController.*`: once per frame: read the sim, show it, send input. Key bindings are here.
- `Source/CrystalVein/SCVHud.*`: the HUD (Slate, no assets).
- `Sim/sidecar.mjs`: the sim process. `Sim/sim/`: the sim itself, generated.
- `SourceArt/`: source files for art, outside `Content/` so Unreal does not load them. `SourceArt/PROVENANCE.md` says where each came from.

## Things to tune without recompiling

Press Play, eject (F8), select the pawn or the CVWorldView actor, and change:
`FlashlightCandelas`, `SpillCandelas`, `CameraPitch`, `CameraYaw`, `CameraDistance` (pawn); `LampCandelas`, `FireCandelas`, `CreepCandelas`,
`bLampShadows` (world view). Exposure range and speeds are on the pawn's camera (Post Process, Exposure).

## Editor bridge for Claude

The Unreal MCP plugin and four toolsets (editor, live coding, UMG, config) are enabled in the `.uproject`, marked optional.
The server does not start by itself. To start it: console command `ModelContextProtocol.StartServer` (it listens on
127.0.0.1:8000 with no login, so only while you want it). `AllToolsets` is left out on purpose: it switches on some twenty more plugins.

## Known limits of this build

- Greybox: engine basic shapes and engine materials. Lootable containers carry an amber tag; plain ones do not.
- No sound yet.
- No line-of-sight mask: what is unlit is dark, but a lit room behind a wall shows.
- No inventory screen, no map. The HUD is text and bars.
- Packaging is untested (the greybox materials are engine assets used on instanced meshes; fine in the editor).
- The straight path through the section is about a minute. The 10 to 15 minute slice needs more rooms and beats.
