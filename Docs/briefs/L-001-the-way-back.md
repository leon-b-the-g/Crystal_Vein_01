---
id: L-001
lane: levels
title: The way back is not the way you came
status: proposed
created: 2026-11-24
approved:
accepted:
---

# L-001: The way back is not the way you came

## Why

The first line of the [vision](../VISION.md): the place is alive, and its growth is the clock. "the creep is not dynamic enough, it should feel like an organic growth slowly growing around the level." (19 Nov). Today the player crosses the deck once, mostly before the growth has aged, and the section is over in under five minutes of play where ten to fifteen is the aim.

## What the player gets

The generator brings back the forward rooms only. The bulkhead and the cargo bay hang on the main bus, and its breaker is at the far end of the service way. So he crosses the deck a second time, five minutes or more in: the seeds he walked past are crust that breathes out mist, the heart in the bay is crystal, and the plug in the service way is in his way again or still burning. When the breaker closes, the whole deck lights, the bulkhead cycles, and the last crawler comes.

## Scope

In: power in two stages; a breaker at the aft end of the service way; the found-out facts and prompts for it; the lamps in two groups; a checkpoint when the generator catches; the bot and both tests.
Out: growth that grows back after fire (an [organism](../lanes/organism.md) rule: today a burned patch stays gone unless growth is left beside it). A finale at the bulkhead. New rooms. New texts beyond the lines below, which are placeholders (G-27).

## Changes

- Sim (web repo `src/story.ts`): a thing `breaker` on a console tile at the aft end of the service way, usable from a tile with two ways out (G-23). `powerUp()` splits: the generator lights group 1, slams the generator room's door, kills the flashlight and brings the first whisper, as today; the breaker lights group 2, frees the bulkhead and arms the lobby vent's crawler and "Run.". `clues()`: after the generator, "The generator feeds the forward rooms. The bulkhead hangs on the main bus." and, once the generator's panel or the maintenance log has been read, "The main breaker is at the aft end of the service way."; after the breaker, the one line that replaces the list today. `storyPrompt()`: "Close the breaker". `mark()` when the generator catches. One sentence added to the maintenance log.
- Sim tests (web repo `tests/story.test.mjs`): the bulkhead stays locked after the generator and opens after the breaker; the breaker does nothing before the generator; the facts come in order; any order of play still works; the breaker's tile is no pocket.
- Wire (G-14): a lamp's fourth value becomes its group (0 always on, 1 generator, 2 breaker) in place of the always-on flag; the snapshot's power becomes a stage, 0 to 2. `src/snapshot.ts`, `CVSimLink` (`FCVLamp`, `FCVSnap`), [ARCHITECTURE](../ARCHITECTURE.md) if the struct list changes shape.
- Unreal (`CVWorldView`): `PowerUp` per group; the cell's and the generator's lights follow stage 1 as they follow power today. `CVPlayerController`: the demo run's log line prints the stage.
- Here: `Sim/bot.mjs` walks to the breaker by the service way (burning the plug as it does now) and back by the bay; `Sim/story.test.mjs` expects the new beats and facts.
- Docs: the section's description in `README.md`; this lane's file.

## Cost

- Paid: none.
- Leon's part: `DevLoop.bat` open; afterwards he commits the web repo's changes on `unreal-sim` (G-35).
- Needs: the web repo connected and on `unreal-sim`.

## Done when

1. The web repo's suite is green with the new cases named in the log; the type check is clean.
2. `node --test Sim/story.test.mjs` is green here: the bot clears the section with the beats in the new order.
3. A demo run clears. `shot_map.png` shows the breaker where the plan has it. Pictures show the forward rooms lit and the bay dark between the two stages.
4. The bot's walk time is in the log, beside the 248 s of 20 Nov.
5. Frame rates are within a tenth of the last demo run's.
6. No `Warning` in the run log that the last run did not have.

## Gate B

1. When the generator caught and the bulkhead stayed dead, did you know what to look for, without being told where to go?
2. Was the second crossing a different deck from the first, and was it the growth that made it so?
3. How long did the section take you, and where did it drag?

## Log

- 2026-11-24: written from the lane's backlog and the interview of that day. Not started. The numbers the second crossing leans on (crust at four minutes, crystal at five, mist every twenty seconds) have never been played by a person.
