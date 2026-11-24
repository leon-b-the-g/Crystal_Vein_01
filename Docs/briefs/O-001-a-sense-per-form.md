---
id: O-001
lane: organism
title: A sense per form
status: proposed
created: 2026-11-24
approved:
accepted:
---

# O-001: A sense per form

## Why

The first line of the [vision](../VISION.md). Leon's picks of 24 Nov: the organism "senses" (it reacts to light, heat, noise, blood, and can be baited and steered), and it has "a different sense per form": learning which is which is the game. Today every creature weighs every stimulus alike, so there is nothing to learn.

## What the player gets

Three creatures that hunt in three ways, and a growth that reaches for him when he stands still. Each can be fooled with the tool that fits it, and each shows what it has caught before it acts.

**The table is the proposal. Leon changes it at Gate A.**

| Form | What it is | Hunts by | Nearly blind to | What the player does about it | Its tell |
|---|---|---|---|---|---|
| Mite | A bud of the mass | **Light**: the beam, a flare, a lit room | Sound | Light off to slip past; a flare thrown aside pulls them | Its eye-spot flares up and it turns to the light before it runs |
| Crawler | A host | **Sound**: running, doors, a fight, the generator, a noisemaker | Light | Walk or crouch; a noisemaker sends it the wrong way | It stops, rears its head toward the sound and holds a moment |
| Risen crewman | A host | **Blood**: a player who is hurt or carries spores | A healthy, clean player who keeps his distance | Bandage and stay clean to pass; hurt, he runs or fights | It lifts its head and sways toward him before it walks |
| Young growth | The organism | **Warmth**: it takes the tiles nearest a player who lingers | A player who keeps moving | Do not stand and read beside it | Its feelers reach his way (they are drawn already) |

Crust keeps what it does now (mist when he is near, drifting to the dead). Crystal senses nothing.

This keeps the maintenance log's line true for mites only: "They come to light."

## Scope

In: the senses as story-only rules; one flag on the wire for "it has caught something"; one tell per creature in Unreal; the growth's lean toward a lingering player.
Out: new creatures. New bodies or animation (the tells use what the still bodies and the bought skeleton can do today). Staging each creature's first meeting so that its sense shows: a levels brief. The hazard numbers.

## Changes

- Sim (web repo): an optional state field `senses`, by creature type and stimulus kind, multiplying `T.stim.typeWeight` where `ai.ts` weighs a stimulus and where it raises alertness on sight (`sightLit`, `sightDark`); absent, nothing changes (G-13). A stimulus kind `blood`, emitted once a second by a player below full health or with a spore load, louder with either. An optional field `creepSeek` in `infection.ts`: a floor tile beside growth is taken sooner when a player has stood within three tiles of it for five seconds. The story module sets both. The growth's cap is unchanged.
- Sim tests (web repo): for each of the three creatures, one case showing it turns to its own stimulus and one showing it does not turn to another's at the same distance; the growth's lean as a ratio over twenty seeds; the deck game's suite untouched and green.
- Wire (G-14): an alien flag `Sensing` (64) while a creature turns to a stimulus of its own sense. `src/snapshot.ts`, `ECVAlienFlag` in `CVSimLink.h`.
- Unreal (`CVWorldView.cpp`): while `Sensing`, a small red light flares at the mite, as one does when a creature rears, and it turns in place; the crawler's still body holds its rearing pose without the red flare; the risen crewman plays its idle turned to the player. `CVPlayerController`: a first-time picture for each (`shot_sense_mite.png` and so on), as it keeps one for the mist.
- Docs: the creatures' part of `README.md`; this lane's file.

## Cost

- Paid: none.
- Leon's part: `DevLoop.bat` open; afterwards he commits the web repo's changes (G-35).
- Needs: the web repo connected and on `unreal-sim`.

## Done when

1. The web repo's suite is green with the six creature cases and the growth's case named in the log.
2. `node --test Sim/story.test.mjs` is green here and a demo run clears.
3. Each tell is in a first-time picture, close enough to tell it from the creature's ordinary state.
4. The bite, toughness and spore numbers of 19 and 20 Nov are unchanged, shown by the diff.
5. No rule is in C++ (G-10): the diff of `CVWorldView.cpp` reads flags and draws.

## Gate B

1. After ten minutes, can you say what each of the three hunts by?
2. Did you use that on purpose at least once: light off, a noisemaker, a bandage first?
3. Which of them still felt unfair, or impossible to read?

## Log

- 2026-11-24: written from the interview of that day. Not started. The table is an agent's proposal, not Leon's words. The tells will be seen in stills only: whether they read in motion is his to say.
