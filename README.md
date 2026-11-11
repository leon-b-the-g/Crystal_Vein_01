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

## Work loop for Claude

`DevLoop.bat` lets Claude build, run and save the project without a click from you each time. Double-click it and leave the
window open. It does four fixed jobs, each when an empty request file appears in `Saved\DevLoop`:

| Request file | What runs | What it leaves |
|---|---|---|
| `build.request` | the Unreal 5.8 build of this project | `build.log`, `build.result` |
| `run.request` | the demo run (below), in a 1600 x 900 window | `run.log`, `run.result`, `shot_*.png` |
| `commit.request` | `git add -A`, then a commit with `commit.txt` as its message | `git.log`, `commit.result` |
| `push.request` | `git push` to `origin` | `git.log`, `push.result` |

It never reads or runs what is in a request file. Close the window to stop it. Close the Unreal editor before a build or a demo run.

## Demo run

`UnrealEditor.exe CrystalVein.uproject -game -CVDemo` plays the section by itself: the sim's bot (`Sim/bot.mjs`) walks it and
cannot be hurt, notes close themselves, and the game quits when the section is clear (or after four minutes).
It opens on the whole deck from straight above for a moment (`Saved\DevLoop\shot_map.png`: the check that a level was built
as planned), then writes a screenshot every three seconds (`shot_00.png` onwards) and a line of numbers for each in `run.log`.
This is how Claude sees the game. A run takes about two and a half minutes, most of it the engine starting.

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
- `Sim/sidecar.mjs`: the sim process. `Sim/bot.mjs`: the player of the demo run. `Sim/sim/`: the sim itself, generated.
- `SourceArt/`: source files for art, outside `Content/` so Unreal does not load them. `SourceArt/PROVENANCE.md` says where each came from.

## Things to tune without recompiling

Press Play, eject (F8), select the pawn or the CVWorldView actor, and change:
`FlashlightCandelas`, `SpillCandelas`, `ExposureLit`, `ExposureDark`, `CameraPitch`, `CameraYaw`, `CameraDistance` (pawn);
`LampCandelas`, `FireCandelas`, `CreepCandelas`, `FillLux`, `bLampShadows` (world view).

The exposure is not metered. The pawn sets it from what the flashlight does: `ExposureLit` while the beam is on, `ExposureDark`
about three seconds after it goes out or dies (dark adaptation). `FillLux` is the cold light that shows the deck as a faint plan
where no lamp reaches. The comments beside these values say what each number does to the picture.

## Editor bridge for Claude

The Unreal MCP plugin and four toolsets (editor, live coding, UMG, config) are enabled in the `.uproject`, marked optional.
The server does not start by itself. To start it: console command `ModelContextProtocol.StartServer` (it listens on
127.0.0.1:8000 with no login, so only while you want it). `AllToolsets` is left out on purpose: it switches on some twenty more plugins.

## Known limits of this build

- Greybox: engine basic shapes and engine materials. Lootable containers carry an amber tag; plain ones do not.
- No sound yet.
- No line-of-sight mask: what is unlit is dark, but a lit room behind a wall shows.
- Walls hide the floor right behind them (about 1.4 m at this camera angle). No cut-away or fade yet.
- Fire is flat glowing tiles, the player a cylinder, aliens ellipsoids.
- No inventory screen, no map. The HUD is text and bars.
- Packaging is untested (the greybox materials are engine assets used on instanced meshes; fine in the editor).
- The straight path through the section is about a minute. The 10 to 15 minute slice needs more rooms and beats.
