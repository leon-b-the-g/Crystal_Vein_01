# Decisions

What Leon has decided, by date, newest first. Add to the top; never rewrite an old entry: a decision that is replaced gets a note saying by which. Quotation marks are his words; a "pick" is an option he chose in a dialog. An agent adds an entry only from his own message (G-03 in [GUARDRAILS](GUARDRAILS.md)). What is still open is at the end of [VISION](VISION.md).

## 24 Nov 2026

His ask: "What we have built so far is a good proof of concept. We want to now define and write out the documentation, guardrails, instruction sets, agentic setups and workflows that let us build out specific partitions of this game. We want to make the tools that will enable us to push out the vision that I am composing"

How the work is organised (picks):
- All four lanes get the full pipeline and a first brief: levels, creep and creatures, rooms and world look, interface and feedback.
- The set-ups live in this repo, for Cowork sessions and for Claude Code on the PC alike.
- The vision is written from an interview with him.
- **Two gates per brief:** he approves the brief before the build, and he plays and judges the result before it counts as done. Between the gates agents run unattended, commit and push.

The vision (picks, and two answers in his words):
- The lead experience: **"The place is alive"**: the organism leads; its growth is the clock and the threat; creatures are its hands.
- A fight with one creature: **"Winnable, but it costs"**.
- The target: **"Section 1 at demo quality"**: one section finished in every lane first.
- Act I's sections are **hand-authored and fixed**. Replaces "hybrid maps" of 10 Nov for Act I; seeded variation is kept for contracts mode.
- The organism: **"It senses"** (not a process, not a mind that knows him).
- The creep: **"Burn it back, never beat it"**.
- Mites and crawlers: **"Both, by stage"**: small ones are buds of the mass, large ones are hosts; the older, the more crystal.
- The ship has been lost for **"Days"**.
- Its senses: **"A different sense per form"**.
- Carrying things: "I would like 4 quick slots and a 9 slot bag, where finding objects feels meaningful and there are regular opportunities to disasemble objects at work benches to make the objects that you want (I want the main character to be an electrical engineer by trade)"
- The story: his outline of the opening and three acts, whole in [VISION](VISION.md), "The story". Replaces the three acts of the story team's proposal of 10 Nov.

The loop: he said every `DevLoop.bat` window was closed, and the fixed `DevLoop.bat` went in (one loop only; a request is taken by renaming it).

## 20 Nov 2026

- "I have added new asset packs to the fab library that we should integrate, especially the doors (they should open and close dynamically, with a 0.4 second delay after interacting with them)."
- The creep's life in his words: whole in [VISION](VISION.md), line 1. The mite and the creep are to be made with Meshy.
- "We want to begin working on fleshing out the UI, lets explore options on how to do this best."
- Picks: Meshy up to 300 credits for that round. A fifth loop job that runs an editor script. The creep's look and its rules both. The risen dead walk as the Whisper; the crawler gets a generated body (replaces the default of 19 Nov, the Whisper as the crawler).
- Interface picks: menus with CommonUI on UMG. In play the ring at the player's feet (health, stamina, the creep; prompts beside the thing). The widget layouts are made by an agent through the editor's MCP server, which he connects.

## 19 Nov 2026

- His worst things after playing on the 18th, four given: the creep "is not dynamic enough", enemies "didnt feel like a real hazard", the rooms "seemed bare", and the flashlight "is only good if 90% lean into it". Whole in [VISION](VISION.md).
- Picks: the editor's `Config/DefaultEngine.ini` is committed like any other file. He plays first and agents wait for his notes. The player's and the mites' bodies are left for now (he asked for the mite himself on 20 Nov).
- The web repo: he commits there himself; branch `unreal-sim`.
- Defaults an agent took after two unanswered questions, and he did not object: bought packs stay out of git. "Commit them" would reverse it.

## 14 Nov 2026

- His Fab packs are to be used. They take the place of a hand-built kit for the ship, and of generated props.

## 13 Nov 2026

- "start fleshing out the first game level": layout and beats before art. Section 1 was grown to thirteen rooms.

## 12 Nov 2026

- The first public release is **a free demo of Act I**. Three acts, contracts mode and multiplayer are not part of it.
- Art: the crew member and the crawler, rigged and animated, set the art bar; then one room at final quality.
- A section is 10 to 15 minutes.
- Then the inventory screen, outside testers, a Steam page, in that order. No new features until then.

## 11 Nov 2026

Permissions:
- The work loop may start the game by itself on his PC.
- This repo: commit and push at each working checkpoint, through the loop.
- The web repo: nothing is committed or pushed by an agent.

## 10 Nov 2026

- Engine: Unreal 5.8.x. Unreal-side code is C++.
- The TypeScript sim stays the source of truth for the rules and is to run inside Unreal. (Since 11 Nov it runs beside it, as Node.)
- The Unreal project is called CrystalVein, so that no title is baked into module names before the trademark check.
- Art: generated meshes (Meshy), isometric camera. Generated now, replaced later by his designer, the most visible first; a record per asset.
- Colour: cold blue-grey is the ship, amber is the ship asking for attention, **red is alien and nothing else**.
- Input: gamepad from the start, and keyboard with mouse. Reference graphics card: RTX 4060 Ti.
- Platforms: Steam first. The web game stays live as the free alpha. Mobile later.
- Modes: a story mode in three acts, and a contracts mode with two reputation sides.
- Story mode: hybrid maps (replaced for Act I on 24 Nov), checkpoints.
- Lighting, all accepted: dark adaptation, creatures that react to light, lights the player controls, a UV head for the flashlight.
- No public dates.
- Texts: placeholders by agents, rewritten by the story team. No voice.
- The design source was the story team's "KESTREL VANE, Game Design Proposal". (Its three acts were replaced on 24 Nov.) Taken from it: no hunger, thirst or extensive crafting; the workbench stays as it is. (On 24 Nov he made taking things apart at workbenches the fourth line of the vision.)

## Before the Unreal build

- 1 Nov 2026: the game is renamed from X-Stranded to **Kestrel Vane**; trademark and store-name check pending.
- 31 Oct 2026: his marketing expert's advice, built into the launch roadmap: move away from generated content, with hand-made art and sound from his designer and sound expert replacing it in the order players see it; build in public honestly, showing only the current build.
