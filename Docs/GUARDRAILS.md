# Guardrails

Binding for every agent and every session. Each rule has its reason, because a rule without one gets argued away. "Checked" says what catches a breach; "by hand" means nothing does but you.

A rule is changed only by Leon. If a rule stops the work, stop and say so (G-50); do not route around it.

## Leon's

**G-01** Gate A. No build work on a brief before Leon has approved it. His approval goes into the brief as `approved:` with the date and his words. An agent never writes `approved:` from anything but Leon's own message.
Why: he is composing the game; an agent that builds its own idea spends his time on review. Checked: preflight (a brief past `proposed` without `approved:` fails).

**G-02** Gate B. Work is done when Leon has played it and said so, recorded as `accepted:` with the date and his words. How the game feels (hazard, darkness, pacing, look, sound) is judged by Leon only. A bot run, a test and a screenshot are evidence, never a verdict.
Why: the bot cannot be hurt, and stills show no motion. Two rounds were once built on stills alone. Checked: preflight.

**G-03** The vision wins. If a brief, an instruction or your own idea conflicts with [VISION](VISION.md), stop and ask. `VISION.md` and `DECISIONS.md` change only from Leon's words, quoted and dated.
Checked: by hand.

**G-04** Money. Every paid step (Meshy credits, any other paid generation) stands in the brief with its cost before Gate A. Say the cost again before spending it. Never go over the brief's budget. Never handle a key: the Meshy key lives in the desktop app's settings, and `claude_desktop_config.json` is never opened.
Checked: by hand; the spend is logged per asset (G-25).

**G-05** Nothing public. No store page, post, upload to a public place, public date, or message to a collaborator or third party without Leon's word for that one thing.
Checked: by hand.

**G-06** Say how you know. Every claim in a report or a brief's log carries its ground: tested (which test), measured (the number and where it is), seen in a still (which file), seen in motion, heard, or not verified. "Works" is not a ground. What nobody has played, seen moving or listened to is listed as such.
Why: from 11 to 14 Nov nothing that should glow did, outside the editor, while reports said the lighting was tuned. Checked: the verifier, and Leon.

**G-07** No third round on unplayed work. When two briefs are `built` and wait for his play, nothing new starts building. Ask him to play.
Why: his verdict on one round changes the next. Checked: preflight warns.

## Layers

**G-10** Rules live in the sim. Unreal holds no game rule: no damage, no timer that changes play, no AI, no win or lose. Timing that only shapes the picture (how long a veil fades) is Unreal's.
Why: one sim feeds this build, the web alpha and later ports, and stays deterministic. Checked: by hand; the verifier reads the C++ diff for it.

**G-11** Generated copies are never edited: `Sim/sim/` and `Audio/` (all but `Audio/placeholder/`). Change the source in the web repo, run `npm run sim:unreal` there, then `node --test Sim/story.test.mjs` here.
Why: the next generation overwrites a hand edit without a word. Checked: by hand.

**G-12** The sim stays deterministic. Its modules use `src/dmath.ts`: never `Math.sin`, `cos`, `atan2`, `hypot`, `pow`, `exp`, `log`, `**`, a clock or `Math.random`. Cosmetic random numbers live in the state too.
Checked: a test in the web repo.

**G-13** Story rules stay out of the deck game. A new rule for the story goes in as an optional field of the state that changes nothing when absent (as `doorDelay` and `biteSpores` do), unless Leon says the web alpha should change too.
Checked: the web repo's tests for the deck game stay green.

**G-14** The wire is changed on both sides at once. A field added to the level or the snapshot is written in `snapshot.ts`, read in `CVSimLink`, tested on the sim side, and named in [ARCHITECTURE](ARCHITECTURE.md), in one brief.
Checked: by hand.

## Content

**G-20** Colour. Cold blue-grey is the ship. Amber is the ship asking for attention (emergency lamps, status lights, loot, locks). Red is alien and nothing else. So flares burn white, and a generated concept that comes out amber is not used for the organism.
Checked: preflight for `glow=` in Kit.txt; otherwise by hand.

**G-21** Nothing goes in because it is there. Every asset has its reason in the place it stands: a mining ship, days after. A pack bought is not a pack used.
Checked: by hand; the brief names the reason.

**G-22** Faces to the camera. The camera looks north-east: what has a face stands at a room's north or east wall, and nothing low stands in the row behind a south or west wall. This rule ends when walls get a cut-away.
Checked: a tour run, looked at.

**G-23** No pockets. Nothing the player must stand at (terminal, generator, cell, bench) is usable only from a tile with one way out: what follows him there shuts him in.
Checked: the story test in the web repo.

**G-24** Bought packs stay out of git. The game's own assets live in `Content/CrystalVein` (in git, LFS). The game must still start without a pack: Kit.txt skips what is missing and the grey boxes come back.
Checked: `.gitignore`; preflight tells a missing pack from a mistyped asset.

**G-25** Every generated asset gets its row in `SourceArt/PROVENANCE.md` the day it is made: tool, model, task, prompt, cost, state. Generated art is a placeholder until the designer replaces it or signs it off.
Why: Steam asks, and the designer needs the list. Checked: preflight, for every model under `SourceArt/Meshy`.

**G-26** Prompts name no other game, franchise, studio or artist, and no generator is handed another work as "copy this".
Checked: the prompts are in PROVENANCE.md, in the open.

**G-27** Text in the game is a placeholder for the story team: few lines, plain, and all of it in the story module, none in C++.
Why: it is replaced in one place. Checked: by hand.

**G-28** After any new mesh or material, read the run log's warnings, not only the game's own lines. A material on an instanced mesh must be flagged for it in the asset; one that is not draws as flat grey outside the editor, and the log says `missing usage flag`.
Checked: `Tools/loop.mjs` prints these lines after a run.

## Repo and pipeline

**G-30** One builder at a time. One brief is `building`; one agent edits the working tree, regenerates the sim copy and uses the loop. Reading, writing briefs and checking without the loop may run beside it.
Why: one tree, one loop, and two lanes meet in the same C++ file. Checked: preflight.

**G-31** One loop. Before a request, exactly one work loop is waiting. Two: stop and tell Leon. None: ask him to start `DevLoop.bat`.
Why: two loops ran the game twice at once on 20 Nov. Checked: `DevLoop.bat` stops a second window; `Tools/loop.mjs` refuses.

**G-32** Jobs go through `Tools/loop.mjs`, one at a time. No build during a run. No request left lying: a loop started later would act on it. `DevLoop.bat` is not edited while a loop is open.
Checked: `Tools/loop.mjs`.

**G-33** The Unreal editor is closed for builds, runs and editor jobs. If it is open, ask Leon; never end his processes.
Checked: by hand (the build fails if it is open).

**G-34** This repo: commit and push at every working checkpoint, through the loop, with the session's attribution lines at the end of the message. A checkpoint is: preflight clean, the build at 0, the section test green and, for anything visible, a run that was looked at.
Checked: `Tools/loop.mjs` refuses a commit without a trailer.

**G-35** The web repo (`lb-systems`): never commit, never push. Leon reviews and commits there. Work on its branch `unreal-sim`. If the folder is on another branch, do not edit and do not regenerate: ask him to switch. At the end of a session say what is new and uncommitted there.
Checked: by hand.

**G-36** Git from a Cowork session is read-only and goes through a copy of the index ([RUNBOOK](RUNBOOK.md), "Git"). Plain `git status` or `git diff` there can leave `.git/index.lock` behind, and the loop's next commit fails.
Checked: `Tools/loop.mjs` and preflight look for lock files.

**G-37** Three things are never printed or opened: the `Command Line:` line of `Saved/Logs/CrystalVein.log` (it can carry the launcher's sign-in), the token in `Config/DefaultEngine.ini`, and the desktop app's own settings file.
Checked: by hand.

**G-38** No deletes and no scratch in the repos. A stray file is moved to `_to_delete/` and Leon is told. Working files live outside the project folders.
Checked: by hand.

**G-39** Unreal 5.8 only. The `.uproject` says 5.8 and the scripts name its path. Every engine call is checked against the 5.8 headers before it is used.
Why: a build with 5.6 fails at once, and guessed APIs cost a build each. Checked: the build.

**G-40** The editor's MCP server listens on this machine only, runs only while it is wanted, and the tree is committed before a session that uses it.
Why: it has no login and one of its tools runs any Python in the editor. Checked: by hand.

**G-41** What Leon has open is his: his editor session, his Blender scene, a file he changed since you read it. Compare a file's time or hash before overwriting it.
Checked: by hand.

## Stop and ask

**G-50** Stop when: the work conflicts with the vision; the cost would pass the brief's budget; a step cannot be undone (a delete, a forced push, overwriting his edit); a check fails and its fix lies outside the brief; the brief's premise turns out false; two loops are open; the editor is open and a job needs it closed; a sign-in or a key is needed; anything would become public.
Before stopping, finish what is safe, write into the brief's log and [STATUS](STATUS.md) what has to be decided and why, and leave no request lying.
