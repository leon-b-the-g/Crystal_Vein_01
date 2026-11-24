# Kestrel Vane, the Unreal build (project name: CrystalVein)

Unreal Engine 5.8, C++. Greybox of Act I, section 1 (Cargo and Maintenance).

The game rules do not live here. They run in the TypeScript sim (`lb-systems/apps/x-stranded/src`), the same code as the web
alpha. Unreal draws what the sim reports and sends the player's input back. For now the sim runs beside Unreal as a small
Node process (`Sim/sidecar.mjs`) that Unreal starts on Play and that quits when Play ends.

## How work on this project is organised

`CLAUDE.md` is where an agent starts. `Docs/` holds the vision, the rules, the workflow (a brief, Leon's approval, the build,
a check, Leon's play), a file for each lane, the briefs and the roles (`Docs/agents/`). This README describes the
build itself: how to run it, what is in it, what it lacks.

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
window open. It does five fixed jobs, each when an empty request file appears in `Saved\DevLoop`:

| Request file | What runs | What it leaves |
|---|---|---|
| `build.request` | the Unreal 5.8 build of this project | `build.log`, `build.result` |
| `run.request` | the demo run (below), in a 1600 x 900 window | `run.log`, `run.result`, `shot_*.png` |
| `commit.request` | `git add -A`, then a commit with `commit.txt` as its message | `git.log`, `commit.result` |
| `push.request` | `git push` to `origin` | `git.log`, `push.result` |
| `editor.request` | `Tools\editor_job.py`, run by the Unreal editor without a window: imports the art in `SourceArt\Meshy` and makes the game's own materials | `editor.log`, `editor_job.log` (a line a step), `editor.result` |

It never reads or runs what is in a request file. Close the window to stop it. Close the Unreal editor before a build, a demo
run or an editor job. **One window only.** Since 24 Nov the script guards against a second one: a waiting loop rewrites a
heartbeat file every two seconds, a window that finds another loop's heartbeat on starting stops, and a request is taken by
renaming it, which only one loop can do. Before that, two windows both took a request and the game started twice at the same
time (20 Nov: 3 frames a second in place of 110, and Unreal's own warning "Video memory has been exhausted").

Agents ask for a job with `node Tools/loop.mjs build` (or `run`, `editor`, `commit`, `push`): it checks that exactly one loop
is waiting, waits for the job and prints what matters from its log. `node Tools/preflight.mjs` checks the project against its
own rules (`Kit.txt` read the way the game reads it, the briefs, the documents' links, the art's record, the section's test,
the loop).

## Demo run

`UnrealEditor.exe CrystalVein.uproject -game -CVDemo` plays the section by itself: the sim's bot (`Sim/bot.mjs`) walks it and
cannot be hurt, notes close themselves, and the game quits when the section is clear (or after ten minutes).
It opens on the whole deck from straight above for a moment (`Saved\DevLoop\shot_map.png`: the check that a level was built
as planned), then writes a screenshot every four seconds (`shot_00.png` onwards, the last 80 are kept) and a line of numbers
for each in `run.log`. This is how Claude sees the game. A run takes about five and a half minutes: the bot's walk is a little
over four, and it stands four seconds at four shut doors so that a screenshot shows what their prompts say.
It also keeps a picture of the first time each of these happens near the player: a door halfway along (`shot_door.png`), the
red mist (`shot_mist.png`), a dead body getting up (`shot_rise.png`), growth trying a tile (`shot_feeler.png`).
The frame rate in a log line is counted: frames over the seconds since the picture before.

The same request does two other runs when a file lies in `Saved\DevLoop`, which the game reads and deletes:

- `tour.txt`, a line per stop, `x y` in tiles: the camera stands three seconds at each stop under a work light and writes
  `tour_00.png` onwards. Nobody plays. A line that ends in `hurt` shows the hurt veil at that stop, one that ends in `sick`
  the red edge of the infection. This is how a room's furniture is checked. The sim runs meanwhile, so a long tour also shows
  what the growth has become after four and five minutes.
- `gallery.txt`, a line per content folder (`/Game/Horror_Hospital/Meshes`), followed by parts of names if only some meshes are
  wanted (`Rack_0 Desk Generator`): each mesh is photographed, five to a page, with its name and size under it
  (`gallery_00.png` onwards; the sizes are in `run.log` too, lines with `Gallery:`). This is how a new pack is looked at.

And any start of the game runs the console commands in `Saved\DevLoop\exec.txt`, a line each, and deletes the file: `stat unit`
puts the frame, GPU and video memory numbers into the pictures. This is how a slow run is looked into without a build.

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
bulkhead vent once the power is back. Since 20 Nov the body in the bay gets up: see the growth, below.

Doors (20 Nov): a door slides open or shut 0.4 seconds after you press. The doorway stays blocked until the leaf is home, and
pressing again while it moves does nothing. A double door parts in the middle. The cage opens the same way when the key turns.

Finding your way: a shut door says where it leads when you face it ("Open: Cargo bay", "Locked: Crew quarters"). On 12 Nov
the bulkhead was not found in the minute and a half after the power came back.

Since 19 Nov (Leon's playtest of the 18th) the HUD gives no orders. After the weapon there is one goal, "Find a way off this
deck", and under it what you have found out so far ("The caged store is locked. The loadmaster keeps the key."): each fact
comes from a door tried, a machine checked or a note read; when the power is back one line takes the place of the list. The deck is black
outside your beam and the lamps; what you steer by are door strips (cold: opens, amber: wants something), the amber of the
cells in the cage, screens, and the red of the growth. Emergency power brings back two lamps in three, at half strength.

The growth starts in six places and spreads by itself (ten to fifteen tiles a minute). Since 20 Nov it has a life, all of it
rules of the sim (`story.ts`, `infection.ts`) drawn by `CVWorldView`:

- **It tests.** Feelers reach into a tile and draw back; then the living mass swells in after them, over twelve seconds.
- **It breathes.** Young growth is a mass of mounds that swell and settle, a slow wave across the patch.
- **It hardens** where it has been for four minutes: a black crust with spore pods, and the walls beside it are overgrown.
- **Sporulation.** Crust near you breathes out a cloud of red mist every twenty seconds. The mist drifts to the nearest dead
  crewman within fourteen tiles and stops at walls and shut doors. Standing in it loads you with spores as a bite does.
- **Infestation.** A body that has lain fifteen seconds in the mist gets up ("the dead crewman is moving"): the one in the
  bay does, about half a minute after you first come near.
- **Contagion.** What the infected bite with is the growth: a mite's bite carries 8 spores, a crawler's 12, a risen
  crewman's 25. The edge of the screen goes red and beats, faster as the load rises. From 50 of 100 it costs health.
- **Crystal.** After five minutes it is crystal: red shards on the floor and on the walls beside it. It cuts (4 health a
  second) and it still burns. The patch around the body in the bay is that old when the section starts.

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
In the project on 20 Nov 2026: Sicka's sci-fi interior kits (`Sicka_EnvPack2`), Whisper (the body of a crewman who has got
up), Military Radio, Horror Hospital, and from 20 Nov `SciFiDoors` (every door: leaf and frame; there a "Door_N" is a frame
and a "Door_N_frame" a leaf), `Tech_Lai_Walls` (the walls beside hardened growth) and `b_w_aasault_rifle` (not used: the
section has no gun).

The game's own art is in `Content/CrystalVein`, which **is** in git (LFS): the mite, the crawler and the five pieces of the
growth, generated with Meshy (`SourceArt/PROVENANCE.md` has every prompt and cost) and imported by the editor job, and three
materials it makes: `M_Meshy` (flagged for instanced meshes in the asset), `M_MeshyAlive` (the same, and it breathes) and
`M_Mist`. To add a model: put the `.glb` under `SourceArt/Meshy`, add a line to the list at the top of `Tools/editor_job.py`,
ask the loop for an editor job, then name the mesh in `Kit.txt`.

`Kit.txt` in the project folder says which mesh stands for which piece of the deck, in every room or in one room, what lies
on tables and floors, what the walls are faced with, what the growth is made of at each age, what a door's leaf and frame
are, and which body an alien has: an animated one, or a still one that the game moves itself. Its head explains the lines.
The game reads it at start: no build, and the editor may stay open.

To use a new pack: add it in the editor, look at it with a gallery run (above), write its lines into `Kit.txt`, look at the
rooms with a tour run. Or tell Claude which pack is for what.

## Layout

- `Source/CrystalVein/CVSimLink.*`: starts the sim, reads level and snapshots, sends input. The only file that knows about the sidecar.
- `Source/CrystalVein/CVWorldView.*`: draws the deck. Its table of kinds is the list of pieces; `Kit.txt` gives them their meshes.
- `Source/CrystalVein/CVGallery.*`: the gallery run, which photographs the meshes of a content folder.
- `Kit.txt`: which bought asset is which piece, room by room.
- `Tools/editor_job.py`: what only the editor can make (imports, materials), run by the work loop.
- `Tools/loop.mjs`, `Tools/preflight.mjs`: for agents: ask the work loop for a job; check the project against its rules.
  `Tools/tools.test.mjs` checks both.
- `CLAUDE.md`, `Docs/`: how work on the project is organised.
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

The Unreal MCP plugin and four toolsets (editor, live coding, UMG, config) are enabled in the `.uproject`, marked optional,
and since 20 Nov the Python plugins the editor job needs.
The server does not start by itself. To start it: console command `ModelContextProtocol.StartServer` (it listens on
127.0.0.1:8000 with no login, so only while you want it). `AllToolsets` is left out on purpose: it switches on some twenty more plugins.

## Known limits of this build

- Art is bought kit pieces and generated models placed by `Kit.txt`: floors, wall panels, doors, furniture, the growth, the
  aliens. What `Kit.txt` does not name is an engine basic shape. Lootable containers carry an amber tag; plain ones do not.
- The mite and the crawler are still models that the game moves as a whole: they bob, rear, lunge and lie on their backs
  dead, but no leg moves. The risen crewman (Whisper) cuts from one animation to the next without a blend; getting up is its
  death played backwards. A dead crewman is a pale shape, the player a cylinder.
- The red mist is three soft spheres a cloud. Crust, crystal and overgrown walls are there all at once when a tile comes of age.
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
  same way, and `Kit.txt` and the packs it names would have to be packaged with the game. For a material *instance* whose
  base is not flagged that does not work in 5.8 (seen on 20 Nov with what the glTF import makes): hence `M_Meshy`.
- The bot walks the section in a little over four minutes. How long a person takes has not been measured: the aim is 10 to 15.
- No map; doors name the room behind them only when you face them.
- The hazard numbers and the darkness are first guesses of 19 Nov, to be judged by play.
- The growth spreads by the web game's rules (mites lay it, it hardens after five minutes and then hurts), and its mist,
  the body that gets up and the spores in a bite are first numbers of 20 Nov. Nobody has yet played the section by hand
  with them: the bot cannot be hurt or infected.
