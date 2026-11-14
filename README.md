# Kestrel Vane, the Unreal build (project name: CrystalVein)

Unreal Engine 5.8, C++. Greybox of Act I, section 1 (Cargo and Maintenance).

The game rules do not live here. They run in the TypeScript sim (`lb-systems/apps/x-stranded/src`), the same code as the web
alpha. Unreal draws what the sim reports and sends the player's input back. For now the sim runs beside Unreal as a small
Node process (`Sim/sidecar.mjs`) that Unreal starts on Play and that quits when Play ends.

## First run

Needs: Unreal 5.8, Visual Studio with the "Game development with C++" workload, Node.js 18 or newer on the PATH.

1. Double-click `BuildAndOpen.bat`. It builds the module with Unreal 5.8 and then opens the project in the 5.8 editor.
2. In the editor press **Play**, then click once in the viewport so it has the keyboard.

To play without the editor: double-click `Play.bat` (a 1600 x 900 window; Alt+F4 closes it). It needs a finished build, and
the work loop must not be building or doing a demo run at that moment.

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
cannot be hurt, notes close themselves, and the game quits when the section is clear (or after ten minutes).
It opens on the whole deck from straight above for a moment (`Saved\DevLoop\shot_map.png`: the check that a level was built
as planned), then writes a screenshot every four seconds (`shot_00.png` onwards, the last 80 are kept) and a line of numbers
for each in `run.log`. This is how Claude sees the game. A run takes about five and a half minutes: the bot's walk is a little
over four, and it stands four seconds at four shut doors so that a screenshot shows what their prompts say.

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

## The section

Act I, section 1, Cargo and Maintenance: thirteen rooms on one deck, 51 x 38 tiles (grown from eight rooms on 13 Nov 2026).
The plan, the texts and the rules of the section are `story.ts` in the sim (`Sim/sim/story.js` here).

What the player has to do, in order: find a weapon (stowage); find the bulkhead dead and the generator's cell flat; read the
maintenance log (workshop); find the caged store locked (far end of the cargo bay); read the loadmaster's log (his office, next
to the cage); fetch his key from locker three (ready room); unlock the cage and take a cell; fit it to the generator; leave
through the bulkhead. Whoever finds the key first can skip the steps before it.

Two ways across the deck: the cargo bay floor (growth that takes fire as you come in, three sealed containers to hide behind,
a nest between the office and the cage) or the service way along the hull (plugged with growth half way: a flare burns it out).
Off the path: the parts store (a fire axe, and something in a crate), the observation gallery (the viewpoint), the duty board.

Company, all scripted in `story.ts`: a mite out of the vent by the bulkhead on the first visit; two mites at the body in the bay,
which appear when you come within eleven tiles of it; a crawler out of the bay vent when you take the cell; a crawler out of the
bulkhead vent once the power is back. The body is a meal that outlasts the section, so it does not get up.

Finding your way: a shut door says where it leads when you face it ("Open: Cargo bay", "Locked: Crew quarters"), and the last
objective names its landmark. On 12 Nov the bulkhead was not found in the minute and a half after the power came back.

All texts are placeholders for the story team. `node --test Sim/story.test.mjs` checks the section and the bot without Unreal.

## When the sim changes

**13 Nov 2026: `Sim/sim/story.js` is ahead of `story.ts`.** The grown section was written into the copy here, because the web
repo was not connected that day. Until it has been ported to `story.ts`, do not run `npm run sim:unreal`: it would put the old
section back, and the demo bot would stop. (This project also moved to `Desktop\Game Projects\CrystalVein` since that script
was last run: check where it writes.)

In `lb-systems/apps/x-stranded`: `npm run sim:unreal`. It rewrites `Sim/sim/` here (plain JS, types stripped) and copies the
web build's sounds (`assets/audio`) to `Audio/`. Then press Play again.
`Sim/sim/` and `Audio/` (all but `Audio/placeholder/`) are copies: never edit them here.

## Sound

The sounds are the web build's recordings and music, and the web build's rules decide what plays: `src/cues.ts` there runs
`audio.ts` without a browser and sends, with each snapshot, the sounds that start and the loops to keep running, each with its
level already set for distance and walls. `CVSound` decodes the files when first used and plays them, placed left or right of
the player. Four sounds have no recording yet (the fire, a bite, the heartbeat, the noisemaker's beep): `Tools/placeholder_audio.py`
writes stand-ins to `Audio/placeholder/`; a recording with the same name there replaces one. The volume of everything is
`Master` on the CVSound actor.

The demo run records what it plays to `Saved\DevLoop\run_audio.wav`. Claude checks that file by measurement (levels per
second, clipping, left and right, where the energy sits). Nobody has listened to this build yet.

## Layout

- `Source/CrystalVein/CVSimLink.*`: starts the sim, reads level and snapshots, sends input. The only file that knows about the sidecar.
- `Source/CrystalVein/CVWorldView.*`: draws the deck. Its table of kinds is the list of meshes to replace with art.
- `Source/CrystalVein/CVPawn.*`: body, flashlight, isometric camera, exposure (dark adaptation).
- `Source/CrystalVein/CVPlayerController.*`: once per frame: read the sim, show it, send input. Key bindings are here.
- `Source/CrystalVein/SCVHud.*`: the HUD (Slate, no assets).
- `Source/CrystalVein/CVSound.*`, `CVSoundWave.*`: plays the sounds the sim asks for, from the files in `Audio/`.
- `Audio/`: the sounds (copied from the web build) and `Audio/placeholder/` (generated by `Tools/placeholder_audio.py`).
- `Sim/sidecar.mjs`: the sim process. `Sim/bot.mjs`: the player of the demo run. `Sim/sim/`: the sim itself, generated.
- `Sim/story.test.mjs`: the section and the bot, checked without Unreal.
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
- Sound has no reverb and no separate volumes for music, effects and ambience. The whisper has no voice, gunshots no sound.
  The mix was measured, not heard. The two-minute music track is decoded when the level starts (a short hitch).
- No line-of-sight mask: what is unlit is dark, but a lit room behind a wall shows.
- Walls hide the floor right behind them (about 1.4 m at this camera angle). No cut-away or fade yet.
- Fire is flat glowing tiles, the player a cylinder, aliens ellipsoids. A flare is a white light (red is alien), a noisemaker
  a small box that blinks in time with its beep.
- No inventory screen, no map. The HUD is text and bars.
- Packaging is untested. The greybox materials are engine assets used on instanced meshes, and the emissive one (door strips,
  loot tags, screens, growth, fire) only glows because `CVWorldView::EnsureMeshes` flags it for instanced meshes at run time,
  which editor binaries can do (Play.bat, the demo run, the editor) and a packaged game cannot. Until 14 Nov that flag was
  missing, and outside the editor all of these were drawn in the engine's default grey.
- The bot walks the section in a little over four minutes. How long a person takes has not been measured: the aim is 10 to 15.
- No checkpoint: dying starts the section again. No map; doors name the room behind them only when you face them.
- The growth spreads by the web game's rules (mites lay it, it hardens after five minutes and then hurts). Nobody has yet
  played the section long enough by hand to say whether that is fair here.
