# Architecture: where things live and where a change goes

## Two repos, one game

```
web repo  lb-systems/apps/x-stranded                    this repo  CrystalVein
┌──────────────────────────────────────┐                ┌──────────────────────────────────────────────┐
│ src/*.ts     the sim: every rule,    │  npm run       │ Sim/sim/*.js     generated, never edited (G-11)│
│              and src/story.ts, the   │  sim:unreal    │ Audio/           generated, never edited (G-11)│
│              section                 │ ─────────────► │ Sim/sidecar.mjs  runs the sim, 60 times a second│
│ assets/audio the sounds              │                │ Sim/bot.mjs      plays the section by itself   │
│ tests/       the sim's tests         │                │ Sim/story.test.mjs  the section, checked here  │
└──────────────────────────────────────┘                └───────────────┬──────────────────────────────┘
                                                             JSON lines │ 127.0.0.1:47800
                                                                        ▼
                                                  CVSimLink   level, snapshot, events, sounds; input back
                                                                        │
                                                  CVPlayerController   once a frame: read the sim, show it, send input
                                                     │            │           │           │
                                                CVWorldView     CVPawn      SCVHud      CVSound
                                                the deck        camera,     the HUD     plays what
                                                     ▲          flashlight              the sim asks for
                                                  Kit.txt   which mesh is which piece; read at start, no build
```

**The sim is the game.** It is TypeScript, deterministic, the same code as the web alpha, and it is the source of truth for every rule (G-10, G-12). Unreal draws what the sim reports and sends the player's input back. For now the sim runs beside Unreal as a Node process that Unreal starts on Play; embedding it is open.

**The wire** is what crosses between them. The sim sends the level once (and again after a restart), then one snapshot per tick. Unreal sends one input per frame. The structs in `Source/CrystalVein/CVSimLink.h` are the list of what crosses: `FCVLevel`, `FCVSnap` and their parts. On the sim side it is written by `src/snapshot.ts` (level, snapshot, input) and `src/cues.ts` (sounds). A field is added on both sides at once (G-14).

**Units.** One tile is 100 cm. The sim counts in px, 16 to a tile. Sim x, y are world X, Y. The camera looks north-east: up on the screen is north-east on the plan.

## Where a change goes

| You want to change | It goes in | Then |
|---|---|---|
| A number that changes play: damage, speed, a timer, what a creature does | The sim: `tuning.ts`, or the story's own numbers at the top of `story.ts` | Web repo tests, regenerate, section test here |
| A section's plan, what stands where, the goal, the found-out facts, texts, scripted company | `story.ts` | The same |
| What a piece looks like; what lies on tables and floors; a room's walls | `Kit.txt` | No build. A tour run |
| How something is drawn or lit; the camera | C++: `CVWorldView`, `CVPawn` | Build, run |
| A fact Unreal needs from the sim | The wire, both sides (G-14) | Web repo tests, regenerate, build, run |
| HUD, menus, input | `SCVHud` and `CVPlayerController` today; UMG assets under `Content/CrystalVein/UI` once the interface lane has built its base | Build, run |
| A generated model | `SourceArt/Meshy/`, a line in `Tools/editor_job.py`, a row in `SourceArt/PROVENANCE.md`, a line in `Kit.txt` | Editor job, tour run |
| A sound | Web repo: `audio.ts`, `cues.ts`, `assets/audio` | Regenerate |

If you find yourself writing a number that changes play into C++, you are in the wrong layer.

## Who owns what

Owning a file means: briefs of that lane change it. A shared file is changed by whichever lane's brief is building, which is safe because one builder works at a time (G-30).

| Path | Lane | Holds |
|---|---|---|
| Web repo `src/story.ts`, `tests/story.test.mjs`; here `Sim/bot.mjs`, `Sim/story.test.mjs` | levels | The plan, things, goal and found-out facts, texts, scripted company, checkpoints |
| Web repo `src/infection.ts`, `ai.ts`, `combat.ts`, `tuning.ts`; the organism's numbers at the top of `story.ts` | organism | The growth's life, creatures, what a bite does |
| `Kit.txt`: the lines for `Creep`, `Crust`, `Crystal`, `CrystalWall`, `GrownWall`, `Feeler` and the aliens' bodies | organism | What the organism is made of |
| `Kit.txt`: every other line | world | Floors, walls, doors, furniture, what lies on it |
| `SourceArt/`, `Content/CrystalVein/Meshy`, the list in `Tools/editor_job.py` | organism for the living; world for props | Generated models and their record |
| `Source/CrystalVein/CVWorldView.*` | shared: organism (growth, creatures, mist) and world (tiles, kit, lamps, doors) | Everything on the deck |
| `Source/CrystalVein/CVPawn.*`, `CVGallery.*` | world | Camera, flashlight, exposure; the gallery run |
| `Source/CrystalVein/SCVHud.*`, `Content/CrystalVein/UI`, `Config/DefaultInput.ini` | ui | What is on the screen, and the bindings |
| `Source/CrystalVein/CVPlayerController.*` | core; ui for the bindings in it | The frame loop, the demo, tour and gallery runs |
| `Source/CrystalVein/CVSimLink.*`, `Sim/sidecar.mjs`, web repo `src/snapshot.ts`, `src/cues.ts` | core | The wire |
| `Source/CrystalVein/CVSound*`, `Audio/placeholder/`, `Tools/placeholder_audio.py` | core | Sound (no lane yet) |
| `Tools/`, `*.bat`, `.gitignore`, `.gitattributes`, `Config/`, `CrystalVein.uproject`, the `.Build.cs` and `.Target.cs` files | core | The pipeline and the build |
| `CLAUDE.md`, `Docs/` but the two below | core | How work is done, and the roles (`Docs/agents/`) |
| `Docs/VISION.md`, `Docs/DECISIONS.md` | Leon | Changed only from his words (G-03) |

**Core** is what no lane owns. A change there is a `C` brief, or part of a lane's brief when that brief cannot be built without it and says so under "Changes".

## What is in this repo

- `Source/CrystalVein/`: the C++ module. `CVSimLink` is the only file that knows the sim is a separate process.
- `Sim/`: the sim copy, the process that runs it, the bot of the demo run, the section's test.
- `Kit.txt`: which mesh stands for which piece, in every room or in one. Its head documents every kind of line.
- `Content/CrystalVein/`: the game's own assets, in git (LFS). Everything else under `Content/` is a bought pack and is not in git (G-24).
- `SourceArt/`: source files for art, outside `Content/` so that Unreal does not load them, and `PROVENANCE.md`.
- `Audio/`: the sounds, copied from the web repo, decoded at run time.
- `Tools/`: `loop.mjs` and `preflight.mjs` (for agents), `editor_job.py` (what only the editor can make: imports, materials), `placeholder_audio.py`.
- `DevLoop.bat`, `Play.bat`, `BuildAndOpen.bat`: [RUNBOOK](RUNBOOK.md).
- `Saved/DevLoop/`: where the loop takes requests and leaves logs and pictures. Not in git.
- `README.md`: the build described for a person: controls, the section, known limits.

## Debts that shape the lanes

- **`CVWorldView.cpp` draws everything** (about 1,500 lines: tiles, kit, lamps, doors, growth, creatures, mist). Two lanes meet in it. Split it by concern when a brief next has to rework one of those concerns, not before.
- **Nothing is placed by hand.** The deck is built at run time from the sim's plan, and `Kit.txt` dresses it by kind of piece: a table is a workbench in every tile of the workshop. A prop at one chosen spot needs a new kind of line (brief [W-001](briefs/W-001-the-workshop.md)).
- **Walls hide the floor behind them** (about 1.4 m at this camera angle), which is why G-22 exists and half of every room cannot be furnished.
- **No line-of-sight mask.** A lit room behind a wall shows.
- **The HUD is Slate text** (`SCVHud`). Leon's picks of 20 Nov replace it: CommonUI on UMG.
- **Bodies.** The player is an engine cylinder. The mite and the crawler are still models that the code moves whole. The risen crewman is a bought skeleton that cuts between animations.
- **The sim runs beside Unreal**, as Node. A player's machine would need Node; embedding the sim is open.
- **Packaging is untested**, and known not to look right yet: [RUNBOOK](RUNBOOK.md), "Traps".
- **The web repo is Leon's to commit** (G-35), so sim work waits there uncommitted until he does.
