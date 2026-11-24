# Runbook: how to build, run, look and commit

Procedures and the traps that have already cost time. What is true right now (last commit, credits left, what is open) is in [STATUS](STATUS.md), not here.

## Where you are running

**A Cowork session** works in a cloud workspace and reaches Leon's PC through the desktop app.

- Folders that must be connected: `Desktop\Game Projects\CrystalVein` always; `Desktop\lb-systems` for any change to the sim (the repo is `lb-systems\lb-systems` inside it); `C:\Program Files\Epic Games\UE_5.8` to read engine headers. Leon adds a folder himself if a request for it is refused.
- The shell on his PC is a Linux VM. The project is at `$HOME/mnt/CrystalVein`. It has Node, Python 3 and git without LFS. It cannot run Windows programs, which is why the loop exists, and it cannot delete files in the connected folders (G-38).
- Scratch files go to `$HOME/scratch` in that VM, never into a repo.
- A shell call there ends after two to three minutes: wait for long jobs in several calls.

**Claude Code on the PC** has the project folder as its working directory. Everything below holds; jobs still go through the loop, because the loop is the queue.

## The loop

`DevLoop.bat` in the project folder does five fixed jobs. Leon starts it with a double-click and leaves the window open; a second window stops by itself. It never reads what is in a request file. The Unreal editor must be closed for a build, a run or an editor job (G-33).

Ask for a job with `node Tools/loop.mjs <job>`. It refuses when no loop or more than one is waiting, when a request is lying, and for a commit without a message or with a git lock. It waits, then prints the result and the lines of the log that matter.

| Job | What runs | Takes | Leaves in `Saved/DevLoop` |
|---|---|---|---|
| `build` | The Unreal 5.8 build of the editor module | 25 to 40 s; 90 s for a full rebuild | `build.log`, `build.result` |
| `run` | The game by itself: a demo, or a tour or a gallery if their file lies there | Demo 5.5 min; tour about a minute; gallery 3.5 min for 130 meshes | `run.log`, `run.result`, pictures, `run_audio.wav` |
| `editor` | `Tools/editor_job.py` in the editor without a window | 15 to 30 s | `editor_job.log` (a line a step), `editor.log`, `editor.result` |
| `commit` | `git add -A`, then a commit with `commit.txt` as its message | Seconds | `git.log`, `commit.result` |
| `push` | `git push -u origin HEAD` | Seconds to minutes (LFS) | `git.log`, `push.result` |

```
node Tools/loop.mjs status          how many loops wait, what was asked for last, what lies there
node Tools/loop.mjs build           exit 0: result 0 · 1: failed or refused · 2: still running
node Tools/loop.mjs wait            go on waiting for the job asked for last
node Tools/loop.mjs run --wait 150  wait up to 150 s in this call
```

A result of 0 means the job ran, not that the change is right. After a build, nothing is known but that it compiles.

## The three runs

All three are the `run` job. Which one starts depends on a file in `Saved/DevLoop`, which the game reads and deletes.

**Demo run** (no file). The sim's bot (`Sim/bot.mjs`) plays the section and cannot be hurt. It leaves `shot_map.png` (the whole deck from above: the check that a level was built as planned), a picture every four seconds (`shot_00.png` onwards, 64 or 65 a run) with a line of numbers each in `run.log` (tick, frames a second, room, goal, light, sounds), a picture of the first time each of these happens near the player (`shot_door.png`, `shot_mist.png`, `shot_rise.png`, `shot_feeler.png`), and `run_audio.wav`. The game quits when the section is clear, or after ten minutes.

**Tour** (`tour.txt`: a line per stop, `x y` in tiles). The camera stands three seconds at each stop under a work light and writes `tour_00.png` onwards. Nobody plays. A line that ends in `hurt` shows the hurt veil there, one that ends in `sick` the red edge of the infection. The sim runs meanwhile, so a long tour (many stops at one tile first) shows what the growth has become after four and five minutes. This is how a room is checked.

Room centres of section 1: stowage 5 4, workshop 5 11, generator room 5 18, ready room 5 27, corridor 10 14, lobby 12 33, service way 30 2, cargo bay 19 9 / 33 9 / 19 16 / 33 16 / 24 10, office 46 8, cell store 45 14, gallery 20 25, parts store 35 25. Growth worth a stop: the heart in the bay 36 11, the plug in the service way 30 2.

**Gallery** (`gallery.txt`: a line per content folder, then parts of names if only some meshes are wanted, such as `/Game/Horror_Hospital/Meshes Rack_0 Desk Generator`). Every mesh is photographed, five to a page, with its name and real size (`gallery_00.png` onwards; the sizes are also in `run.log`, lines with `Gallery:`). This is how a pack is looked at. `Horror_Hospital` has 740 meshes: always filter.

**`exec.txt`**: console commands for one start of the game, a line each, such as `stat unit`. The numbers then stand in the pictures.

## Looking and listening

- From a Cowork session, stage the pictures to the cloud workspace to see them, about thirty a call. A contact sheet (4 by 4, the picture's number in a corner) makes a run readable in one look.
- In `run.log` the game's own lines carry `LogCrystalVein`. Read the `Warning` lines too (G-28).
- Sound is measured, not heard: level per second, clipping, silence, left against right, from `run_audio.wav`.
- A still shows no motion and no sound. Say which of your claims rest on stills (G-06).

**Leon's own sessions** leave the same trace. `Play.bat`, and Play in the editor, write a picture every five seconds (the last 40) to `Saved/DevLoop` and a line for each, with every story event, to `Saved/Logs/CrystalVein.log`. Read that log before asking him what happened. Never print its `Command Line:` line (G-37).

## Changing the sim

The source is the web repo, `apps/x-stranded/src`, on branch `unreal-sim` (G-35). If the folder is on another branch, `story.ts` and other files are missing: do not edit, ask Leon to switch.

1. Change the TypeScript. The story's rules must leave the deck game alone (G-13).
2. Test there, from `apps/x-stranded`: `node --test tests/*.test.mjs` (about 40 s), and the type check: `node ../../node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/lib/tsc.js --noEmit -p .`
3. Regenerate. On Windows: `npm run sim:unreal`. From a Cowork session's shell on the PC: `NODE_PATH=../../node_modules/.pnpm/typescript@5.9.3/node_modules node tools/sim-unreal.mjs "$HOME/mnt/CrystalVein/Sim/sim"`. It rewrites `Sim/sim/` and every file in `Audio/`.
4. Here: `node --test Sim/story.test.mjs` (two seconds, no Unreal). If the bot's walk changed, `Sim/bot.mjs` and that test change with it.

Rules of the sim's code: `src/dmath.ts` for all maths (G-12). The sim takes `step(s, inp)`. Code for one player reads `s.player`, `s.inv` of the bound seat; a system that touches all players loops `forSeats`; solo stays seat-free. Node only strips the types: no parameter properties in a `.ts` file that a test imports. Never put a `//` comment in the middle of a line before code: it has swallowed code three times.

A `find` over the web repo from the PC's shell times out (its `node_modules`): give paths.

## Kit.txt and bought packs

`Kit.txt` says which mesh stands for which piece. The game reads it at start: no build, and the editor may stay open. Its head documents every kind of line; `node Tools/preflight.mjs kit` reads it the way the game does and names every line the game would skip.

1. Leon adds a pack in the editor: Window, Fab, My Library, "Add to project". An agent cannot: the library is behind his sign-in. The pack lands in `Content/<Pack>` and is not in git (G-24).
2. Look at it with a gallery run.
3. Write its lines into `Kit.txt`, with the reason each thing belongs where it stands (G-21).
4. `node Tools/preflight.mjs kit`, then a tour run of the rooms it changed.

How a mesh is fitted:

- A mesh that stands in for a piece (`=`) is scaled to fill the piece's grey box in all three directions, times `scale=`. The boxes, in cm: Crate 86 cubed, Barrel 62 x 62 x 92, Console 90 x 90 x 105, Table 100 x 100 x 74, Locker 80 x 80 x 190, Door 100 x 24 x 205; Floor and Vent are fitted by their footprint. So a tall thin mesh comes out small: give it `scale=`.
- Furniture turns its back to the wall it stands at. Kit meshes of the bought packs look along +Y at `yaw=0`; generated models look along +Y too and need `yaw=-90` as bodies.
- A mesh on top of a piece (`+`) keeps its own size. Several lines take turns, tile by tile; `none` leaves a share bare. A tile that holds a story thing stays clear.
- In one room a kind is one thing: a line `Table @ Workshop =` changes every table there. Containers that hold loot are crates and lockers, and they carry the amber tag: keep those two looking like the ship.
- Flat things on a floor need `z=1` or they flicker against the plate.
- `glow=cold|amber|off` sets the colour of a mesh's own lights where its material calls that `Emissive Color` (the sci-fi kit does); elsewhere it does nothing.
- The first run with new meshes shows "Preparing Shaders" for a few seconds.

Not used on purpose: anything red that is not alien (G-20), and wooden racks.

## Generated models

Meshy is reached through its own connector in the desktop app; the key stays there (G-04). Seen so far: a concept image 9 credits, the model from it 15, so 24 a model. Say the cost before each step.

1. Concept image. The prompt names the palette (G-20), forbids what must not appear, asks for one object, three-quarter view from above, a plain mid-grey background, no cast shadow, and names no other work (G-26).
2. Model from that image: 4 to 8 thousand triangles, PBR maps.
3. Save the `.glb`, its textures and the concept under `SourceArt/Meshy/<name>/`.
4. Add its row and its prompt to `SourceArt/PROVENANCE.md` the same day (G-25).
5. Add a line to `MESHY` at the top of `Tools/editor_job.py` (and its name to `ALIVE` if it should breathe).
6. `node Tools/loop.mjs editor`. The job imports it to `/Game/CrystalVein/Meshy/<Name>/SM_<Name>`, switches Nanite off and gives it `MI_<Name>`, an instance of `M_Meshy`. Read `editor_job.log`: its last line is `done` or `failed: n`.
7. Name the mesh in `Kit.txt`. Tour run.

## Editing files

- From a Cowork session, edit on the PC, not in a copy: a Python read-modify-write with exact anchors (`assert s.count(anchor) == 1`), or a whole new file by a quoted heredoc. Never retype a file from what a tool printed.
- Compare a file's time or hash before overwriting it: Leon edits in parallel (G-41).
- `.bat` files keep their CRLF line ends, or `cmd` misreads them.
- In `CVWorldView.cpp`, code inside the anonymous namespace is indented one tab deeper than `cat -n` makes it look.
- Check an engine call in the 5.8 headers first (G-39). Grep single files; a recursive grep over `Engine/Source/Runtime` times out.
- A file sent to Leon in the chat also lands in the project folder as `Claude outputs\<name>`. That folder is git-ignored here; do the same in any other repo before sending a file.

## Git

This repo: `https://github.com/leon-b-the-g/Crystal_Vein_01.git`, private, branch `main`, LFS for assets and source art.

To commit: write the message to `Saved/DevLoop/commit.txt`, ending with the attribution lines your session gives you; `node Tools/loop.mjs commit`; `node Tools/loop.mjs push`. The loop's commit is `git add -A`: everything in the tree goes in, so read the status first.

From a Cowork session, read the status through a copy of the index (G-36):

```
cp .git/index ~/scratch/idx
GIT_INDEX_FILE=~/scratch/idx git --no-optional-locks -c filter.lfs.process= -c filter.lfs.clean= -c filter.lfs.smudge= -c filter.lfs.required=false status --short -- . ':!Audio'
```

The same prefix serves `diff -- <path>`. `git --no-optional-locks log` is safe as it is. If a lock file is left in `.git`, the shell cannot delete it: `mv .git/index.lock .git/stale-index-lock-<date>` and tell Leon.

The web repo is Leon's to commit (G-35).

## The editor's MCP server

Not connected yet. With it an agent can read mesh sizes and materials in the editor and build widget layouts. The plugin and four toolsets (editor, live coding, UMG, config) are enabled in the `.uproject`; `AllToolsets` is left out on purpose. The steps are Leon's, at his PC (G-40):

1. In the open editor's console: `ModelContextProtocol.StartServer`. It listens on `127.0.0.1:8000/mcp`, with no login.
2. `ModelContextProtocol.GenerateClientConfig ClaudeCode` writes `.mcp.json` beside the `.uproject`.
3. The server speaks HTTP; the desktop app needs a stdio entry. The engine may ship a bridge: `Engine/Plugins/Experimental/ModelContextProtocol/Extras/Proxy/Bin/Win64/unreal_mcp_proxy.exe --mcp-json <that file> install`. Not checked on this PC.
4. He adds that entry to the desktop app himself (G-04, G-37).

The editor being open blocks the loop's builds and runs: bridge work and loop work take turns.

## Traps

- **Grey instead of glow.** A material on an instanced mesh must be flagged for instanced meshes in the asset. An engine material flagged at run time works in editor binaries only; a material instance whose base is not flagged draws grey outside the editor whatever is set in memory. The log says `missing usage flag`. `M_Meshy` exists for this.
- **Unreal 5.6 is installed too.** If Windows asks which engine to use, it is 5.8. With 5.6 the build stops with `'BuildSettingsVersion' does not contain a definition for 'V7'`.
- **5.8 treats shadowing as an error** (C4458: `AActor` has members such as `bHidden`). `KINDA_SMALL_NUMBER` is `UE_KINDA_SMALL_NUMBER`.
- **The glTF import** turns Nanite on and hangs the material on an engine instance; the editor job undoes both. In the commandlet `unreal.get_editor_subsystem(...)` is `None`.
- **A frame's time is clamped at 0.4 s**: count frames for a frame rate. The `fps` in a demo run's log line is counted.
- **The exposure is set by hand** from what the flashlight does. Metering failed: one lamp on screen held the picture dark.
- **Redrawing instances every frame is dear**: taking 64 instances out and putting them back each frame cost 30 ms. Movement that can live in a material lives there.
- **Packaging** is untested. Known: the greybox glow depends on a flag set at run time, which a packaged game cannot do; `Kit.txt`, the packs it names, the sim copy, the sounds and Node would all have to ship.
- **A doubled run** shows as `run_2.log`, three to six frames a second and Unreal's "Video memory has been exhausted". `Tools/loop.mjs` says so after a run.
