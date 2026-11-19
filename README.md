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

The same request does two other runs when a file lies in `Saved\DevLoop`, which the game reads and deletes:

- `tour.txt`, a line per stop, `x y` in tiles: the camera stands three seconds at each stop under a work light and writes
  `tour_00.png` onwards. Nobody plays. A line that ends in `hurt` shows the hurt veil at that stop. This is how a room's
  furniture is checked.
- `gallery.txt`, a line per content folder (`/Game/Horror_Hospital/Meshes`), followed by parts of names if only some meshes are
  wanted (`Rack_0 Desk Generator`): each mesh is photographed, five to a page, with its name and size under it
  (`gallery_00.png` onwards; the sizes are in `run.log` too, lines with `Gallery:`). This is how a new pack is looked at.

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

Finding your way: a shut door says where it leads when you face it ("Open: Cargo bay", "Locked: Crew quarters"). On 12 Nov
the bulkhead was not found in the minute and a half after the power came back.

Since 19 Nov (Leon's playtest of the 18th) the HUD gives no orders. After the weapon there is one goal, "Find a way off this
deck", and under it what you have found out so far ("The caged store is locked. The loadmaster keeps the key."): each fact
comes from a door tried, a machine checked or a note read; when the power is back one line takes the place of the list. The deck is black
outside your beam and the lamps; what you steer by are door strips (cold: opens, amber: wants something), the amber of the
cells in the cage, screens, and the red of the growth. Emergency power brings back two lamps in three, at half strength.

The growth starts in six places and spreads by itself (ten to fifteen tiles a minute); a tile it moves into swells in over
twelve seconds. Its glow breathes, beats once it hardens (four minutes), and beats fast and bright when it is hard and hurts (five).

Hazard, the story's own numbers (`story.ts`, BITE and TOUGH): a mite bites for 5, a crawler for 16 of your 50; a crawler has
half again its hit points and is not staggered by a wrench or an axe, so swinging without a pause no longer keeps it off you.
It rears before it bites, with a red flare: step back. Four mites at the body, not two. Dying starts from the last
checkpoint (the key found; just before the cell is taken), not from the beginning.

Rooms are furnished in the plan (tables, crates, lockers; to the sim they are obstacles) and dressed by `Kit.txt`, see below.
What has a face stands at a room's forward or starboard wall, because the camera looks north-east. Nothing you must stand at
is in a dead end: a crawler that follows you there would shut you in (the section's test checks this).

All texts are placeholders for the story team. `node --test Sim/story.test.mjs` checks the section and the bot without Unreal.

## When the sim changes

In `lb-systems/apps/x-stranded`: `npm run sim:unreal`. It rewrites `Sim/sim/` here (plain JS, types stripped) and copies the
web build's sounds (`assets/audio`) to `Audio/`. Then `node --test Sim/story.test.mjs` here, and press Play again.
The script writes to `Desktop\Game Projects\CrystalVein` and stops if that folder is not there: should this project move
again, give the script the new `Sim\sim` as its argument.
`Sim/sim/` and `Audio/` (all but `Audio/placeholder/`) are copies: never edit them here. (The section was grown in the copy
on 13 Nov 2026, the web repo being out of reach; since 14 Nov it is in `story.ts` and the copy is written from it again.)

## Sound

The sounds are the web build's recordings and music, and the web build's rules decide what plays: `src/cues.ts` there runs
`audio.ts` without a browser and sends, with each snapshot, the sounds that start and the loops to keep running, each with its
level already set for distance and walls. `CVSound` decodes the files when first used and plays them, placed left or right of
the player. Four sounds have no recording yet (the fire, a bite, the heartbeat, the noisemaker's beep): `Tools/placeholder_audio.py`
writes stand-ins to `Audio/placeholder/`; a recording with the same name there replaces one. The volume of everything is
`Master` on the CVSound actor.

The demo run records what it plays to `Saved\DevLoop\run_audio.wav`. Claude checks that file by measurement (levels per
second, clipping, left and right, where the energy sits). Nobody has listened to this build yet.

## Bought assets

Fab packs are added to the project in the editor (Window, Fab, My Library, "Add to project") and land under `Content/`.
They are **not in git**: `.gitignore` leaves out everything in `Content/` except `Content/CrystalVein/`. A clone without the
packs still runs: lines of `Kit.txt` whose asset is missing are skipped, the log says so, and the grey boxes are back.
In the project on 19 Nov 2026: Sicka's sci-fi interior kits (`Sicka_EnvPack2`), Whisper (the crawler's body), Military Radio,
Horror Hospital.

`Kit.txt` in the project folder says which mesh stands for which piece of the deck, in every room or in one room, what lies
on tables and floors, what the walls are faced with, what the growth is made of and which animated body an alien has. Its
head explains the lines. The game reads it at start: no build, and the editor may stay open.

To use a new pack: add it in the editor, look at it with a gallery run (above), write its lines into `Kit.txt`, look at the
rooms with a tour run. Or tell Claude which pack is for what.

## Layout

- `Source/CrystalVein/CVSimLink.*`: starts the sim, reads level and snapshots, sends input. The only file that knows about the sidecar.
- `Source/CrystalVein/CVWorldView.*`: draws the deck. Its table of kinds is the list of pieces; `Kit.txt` gives them their meshes.
- `Source/CrystalVein/CVGallery.*`: the gallery run, which photographs the meshes of a content folder.
- `Kit.txt`: which bought asset is which piece, room by room.
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
about three seconds after it goes out or dies (dark adaptation). `FillLux` is the cold light where no lamp reaches: 0.25 since
19 Nov, which is black; 1.6 showed the deck as a faint plan. The comments beside these values say what each number does to the picture.

## Editor bridge for Claude

The Unreal MCP plugin and four toolsets (editor, live coding, UMG, config) are enabled in the `.uproject`, marked optional.
The server does not start by itself. To start it: console command `ModelContextProtocol.StartServer` (it listens on
127.0.0.1:8000 with no login, so only while you want it). `AllToolsets` is left out on purpose: it switches on some twenty more plugins.

## Known limits of this build

- Art is bought kit pieces placed by `Kit.txt`: floors, wall panels, doors, furniture, the growth, the crawler's body. What
  `Kit.txt` does not name is an engine basic shape. Lootable containers carry an amber tag; plain ones do not.
- The crawler's body cuts from one animation to the next without a blend and has no death: a dead one is a brown shape.
  Mites are ellipsoids, the player a cylinder.
- The window of the observation gallery is on the inside of the hull wall, which this camera sees from behind.
- Sound has no reverb and no separate volumes for music, effects and ambience. The whisper has no voice, gunshots no sound.
  The mix was measured, not heard. The two-minute music track is decoded when the level starts (a short hitch).
- No line-of-sight mask: what is unlit is dark, but a lit room behind a wall shows.
- Walls hide the floor right behind them (about 1.4 m at this camera angle). No cut-away or fade yet.
- Fire is flat glowing tiles. A flare is a white light (red is alien), a noisemaker a small box that blinks in time with its beep.
- No inventory screen, no map. The HUD is text and bars.
- Packaging is untested. The greybox materials are engine assets used on instanced meshes, and the emissive one (door strips,
  loot tags, screens, fire) only glows because `CVWorldView::EnsureMeshes` flags it for instanced meshes at run time,
  which editor binaries can do (Play.bat, the demo run, the editor) and a packaged game cannot. Until 14 Nov that flag was
  missing, and outside the editor all of these were drawn in the engine's default grey. The kit's materials are flagged the
  same way, and `Kit.txt` and the packs it names would have to be packaged with the game.
- The bot walks the section in a little over four minutes. How long a person takes has not been measured: the aim is 10 to 15.
- No map; doors name the room behind them only when you face them.
- The hazard numbers and the darkness are first guesses of 19 Nov, to be judged by play.
- The growth spreads by the web game's rules (mites lay it, it hardens after five minutes and then hurts). Nobody has yet
  played the section long enough by hand to say whether that is fair here.
