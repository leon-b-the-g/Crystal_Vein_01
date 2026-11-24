# Status

What is true now. Rewritten at the end of every session ([WORKFLOW](WORKFLOW.md)); the newest entry of the log at the bottom says by whom. This version: 24 Nov 2026.

## In short

The build is a proof of concept of Act I, section 1: Leon's word of 24 Nov. That day he asked for the documents, rules, agent set-ups and tools to build the game out lane by lane, and gave the vision in an interview. This folder is the result. Nothing in the game itself changed that day except `DevLoop.bat`.

## Waiting for Leon

1. **Play the build** (`Play.bat`). The rounds of 19 and 20 Nov have never been played by a person: the hazard numbers, the darkness, the furnished rooms, the growth's life, the doors. They count as two rounds waiting for his play: by G-07 nothing new starts building until he has. His five worst things decide what is built first.
2. **Gate A** on four proposed briefs: [L-001](briefs/L-001-the-way-back.md), [O-001](briefs/O-001-a-sense-per-form.md), [W-001](briefs/W-001-the-workshop.md), [U-001](briefs/U-001-the-base.md). O-001's table of senses and W-001's story of the room are an agent's proposals for him to change.
3. **The vision's open points**, the name first ([VISION](VISION.md), "Open").
4. **The web repo.** The sim work of 20 Nov is uncommitted there on `unreal-sim`: `src/sim.ts`, `infection.ts`, `story.ts`, `snapshot.ts`, `cues.ts`, `tests/story.test.mjs`, `CLAUDE/planning/PROGRESS.md`. As recorded on 20 Nov; that folder was not connected on 24 Nov.
5. **The editor's MCP server**, for U-001 ([RUNBOOK](RUNBOOK.md)).

## The repo

- `origin/main` on 24 Nov: `362e9dd`, which added `CLAUDE.md`, `Docs/` (the roles are in `Docs/agents/`), `Tools/loop.mjs` and `Tools/preflight.mjs`, on top of `658595a`, the round of 20 Nov (doors that take 0.4 s, the growth's life, generated models, the loop's editor job, the fixed `DevLoop.bat`). One small commit follows with this file.
- Bought packs in `Content/`, not in git: `Sicka_EnvPack2`, `Whisper`, `Military_Radio`, `Horror_Hospital`, `SciFiDoors`, `Tech_Lai_Walls`, `b_w_aasault_rifle` (unused).
- What the build is and what it lacks: [README](../README.md), "Known limits of this build".

## Last measured

- Demo run, 20 Nov, one game alone: clear at tick 14,910 (248 s), 65 pictures, 105 to 120 frames a second; tours 105 to 130. `stat unit` in the cargo bay: frame 8 ms, GPU 6 ms, video memory 3.0 of 7.0 GB.
- `Sim/story.test.mjs`: 7 of 7, 24 Nov. `Tools/tools.test.mjs`: 5 of 5, 24 Nov. `node Tools/preflight.mjs` on the PC, 24 Nov: nothing failed, no warning (all 114 lines of `Kit.txt` find their assets).
- A build of the tree as committed, 24 Nov, through `Tools/loop.mjs`: result 0 (nothing to rebuild, 8 s).
- Web repo, 20 Nov: 156 tests, 155 pass, 1 skipped; type check clean. Not run again since.

## Not verified by anyone

- Play: nobody has played the rounds of 19 and 20 Nov. Nobody has been bitten, misted or infected in them; the bot cannot be.
- Motion: the camera's jolt, the risen crewman's animations, growth swelling in, lamps stuttering, doors sliding. Seen in stills only.
- Sound: measured, never listened to.
- Packaging, other resolutions, the PC's second graphics chip.
- `DevLoop.bat` as fixed on 24 Nov: one window was seen beating and taking two commits, two pushes and a build, once each. That a second window stops was not tried. A run and an editor job have not gone through it or through `Tools/loop.mjs` yet.
- `Tools/preflight.mjs` and `Tools/loop.mjs` have run in a Cowork session's shell on the PC, never under Windows itself.
- The role files in `Docs/agents/` have never been loaded by Claude Code as subagents, and no brief has yet gone through the workflow.

## Budget

Meshy: 905 credits on the account on 20 Nov; it resets on 10 Dec 2026. Of the 300 Leon allowed for the round of 20 Nov, 177 are spent. A new brief states its own budget (G-04).

## Log

- 24 Nov 2026, a Cowork session: interview for the vision; `CLAUDE.md`, `Docs/`, `Tools/loop.mjs`, `Tools/preflight.mjs` written (the roles went to `Docs/agents/`: the session was refused `.claude/`); `DevLoop.bat` fixed (one loop, a request taken once) after Leon said all its windows were closed and a probe agreed; the round of 20 Nov committed and pushed as `658595a`. No brief is approved; nothing of the game was built.
