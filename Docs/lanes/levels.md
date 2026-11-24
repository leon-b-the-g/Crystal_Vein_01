# Lane: levels

**Owns** Act I's sections: each deck's plan, what the player has to do, what he finds out on the way, the scripted company, the texts (placeholders), checkpoints, and how long it all takes.

**Serves** the first line of the [vision](../VISION.md) (the organism is every section's clock) and the second (cues, not orders). Plans are hand-authored and fixed.

## Today

- **Section 1, Cargo and Maintenance**: thirteen rooms on one deck of 51 x 38 tiles; one goal and nine found-out facts; two routes across; six mites, two crawlers and a body that rises; three notes and a viewpoint; two checkpoints. The [README](../../README.md) describes it.
- The bot walks it in about four minutes. Leon took 4:45 of play on 18 Nov, in the unfurnished section with the old numbers. The aim is 10 to 15 minutes for a first-time player.
- Sections 2 to 4 do not exist. Since 24 Nov the act ends at an escape pod, not at a second ship.
- There is no workbench in story mode yet, and the bag has twelve slots where the vision asks for nine.

## Files

| File | What is in it |
|---|---|
| Web repo `src/story.ts` | The section, whole: `PLAN` (the deck as rows of characters), `BASE` and `LOOT` (what the letters stand for), `NOTES`, `ROOMS`, `THINGS`, the story's own numbers, `clues()`, `storyPrompt()`, `stepStory()` |
| Web repo `tests/story.test.mjs` | The sim's cases for the section: its own bot walks the chain, the gates, door signs, no pockets |
| `Sim/sim/story.js` here | The generated copy (G-11) |
| `Sim/bot.mjs` here | The player of the demo run |
| `Sim/story.test.mjs` here | The section and that bot, checked without Unreal |

In `PLAN`, `#` is wall, `.` floor, `D` a door, `L` a locked door, `c` `l` `t` `b` crate, locker, table, barrel, `v` a vent, `~` growth, `*` a lamp, `@` where the player wakes. Other letters and digits mark one spot each and are explained by `BASE` (the tile underneath) and `LOOT` (a container and what is in it).

## Steps of a level brief

1. Draw the change in `PLAN` first, and say in the brief's log what the organism does in every room you touch.
2. `story.ts`: the plan, then the rules. Found-out facts are earned by doing something and are stated as facts, never as orders. Any order of play must work: gate on what the player holds and has opened, not on what he has read.
3. Texts: few, plain, all in `story.ts` (G-27). Every text must fit the note panel at 1600 x 900.
4. The web repo's tests: extend `tests/story.test.mjs` for every new gate and beat; the whole suite stays green.
5. Regenerate, then here `node --test Sim/story.test.mjs`. Teach `Sim/bot.mjs` the new walk and update the beats that test expects.
6. If the deck gained furniture: [the world lane's](world.md) lines in `Kit.txt`, or leave the grey boxes and say so.
7. A demo run. Look at `shot_map.png` (was the deck built as planned?) and the walk. Note the bot's time.
8. Evidence into the brief's log, then the verifier.

A change that needs Unreal to know something new (a lamp group, a new kind of thing) changes the wire: G-14.

## What a level brief must bring

- Both test suites green, with the new cases named.
- `shot_map.png` of the new deck.
- The bot's walk time. It is close to the floor, not the aim: Leon, who knew the deck, took 4:45 where the bot took about 4:05. How long a first-time player takes is known only from one playing.
- A list of what only a player can tell: whether the way is found, whether the pace holds, whether it frightens.

## Rules of this lane

- **No pockets** (G-23) and **faces to the camera** (G-22) for everything placed.
- **A shut door is safe from mites only in a room without a vent.** Crawlers break doors. Use this on purpose.
- **The growth runs by itself.** Left alone with the nest awake it reaches its cap of 140 tiles in about five minutes and is all hard after ten. So what wakes it wakes when the player is near.
- **Bodies get up.** A crew corpse that has been fed on, or has lain fifteen seconds in the red mist, rises. Count the bodies you place.
- **A message stays on screen** until the next one or until a door is opened. Do not hang a hint where the player may turn back.
- **Fire runs through connected growth**, and a barrel beside burning growth explodes (45 damage, 2.75 tiles).
- A new beat that reuses an old sound needs no change to `cues.ts`: a message that starts with "locked" plays the locked-door sound.

## Backlog

In the order an agent would take them; Leon's play decides.

1. Two-stage power and a way back that has changed: brief [L-001](../briefs/L-001-the-way-back.md).
2. A workbench in the workshop and a bag of nine, with the interface lane.
3. A finale at the bulkhead: hide or hold while it cycles.
4. Hold two as a place: a window onto it, then a way in.
5. Section 2, Crew Quarters and Medical Bay, in greybox.
6. The texts, once the story is settled ([vision](../VISION.md), "Open" 1 to 4).
