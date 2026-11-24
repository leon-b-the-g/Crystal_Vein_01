---
id: W-001
lane: world
title: The workshop, days after
status: proposed
created: 2026-11-24
approved:
accepted:
---

# W-001: The workshop, days after

## Why

"The rooms seemed bare, they need assets, flavour and the correct interior design respective to the scene at hand" (19 Nov). The ship has been lost for "Days" (24 Nov), and the target is section 1 at demo quality (24 Nov), which starts with one room that sets the bar (12 Nov). The workshop is the engineer's own kind of room, and the first workbench will stand in it.

Today a room can only be dressed by kind: every table in the workshop is the same bench, and what lies on the benches takes turns by tile. Nothing can be put at one chosen spot, so no room can tell what happened in it.

## What the player gets

A workshop that reads as an electrical workshop left in the middle of a job a few days ago. A device lies opened on the main bench with its tools set out in order beside it. Something was dropped and something knocked over on the way to the door. A meal has been standing since. The growth has started at the vent. Nothing in the room is there to fill space.

## Scope

In: a new kind of line in `Kit.txt` that puts one mesh at one spot; the workshop dressed with it from the packs on the PC; the check for such lines in `Tools/preflight.mjs`.
Out: new furniture that blocks the way (that is the plan, with the levels lane). Generated props: what the packs lack is listed in the log for a later brief with a budget. The room's lamps. The walls that hide its south row and west column (the lane's backlog, item 2): the room is dressed for the camera as it is (G-22). The other twelve rooms.

## Changes

- Unreal (`CVWorldView.cpp`, `LoadKit` and where kit props are placed): a place called `Spot`.
  `Spot @ Workshop + /Game/Pack/SM_Meter x=5 y=9 dx=20 dy=-10 z=111 yaw=30`
  `x`, `y`: the tile, as in `tour.txt`. `dx`, `dy`: cm from the tile's middle. `z`: cm above the floor (the log line `Kit.txt: Table is ..., 111 cm high` gives a bench's top). The mesh keeps its own size times `scale=`, has no collision and blocks nothing. A spot outside the named room is skipped with a `Kit.txt:` warning.
- Tools: `Tools/preflight.mjs` accepts `x= y= dx= dy=` on `Spot` lines only, and fails a spot whose tile is not in its room; a case for both in `Tools/tools.test.mjs`.
- Content: the workshop's `Spot` lines in `Kit.txt`, each with a comment giving its reason (G-21), and a line in the file's head explaining `Spot`.
- Docs: [RUNBOOK](../RUNBOOK.md), "Kit.txt and bought packs"; [ARCHITECTURE](../ARCHITECTURE.md), the debt this ends; this lane's file.
- Sim: none. Wire: none.

The room's story, which every prop answers to: the electrician on watch had a junction unit open on the forward bench, meter on it, when the bus died. He set his tools down, not dropped them. Later something came through the vent; the stool by the starboard bench went over and a parts tray with it. Nobody came back. The watch's meal is on the middle bench.

## Cost

- Paid: none. No generation in this brief.
- Leon's part: `DevLoop.bat` open.
- Needs: nothing but this repo.

## Done when

1. `node --test Tools/tools.test.mjs` is green with the `Spot` cases; `node Tools/preflight.mjs kit` passes on the real `Kit.txt`.
2. The build is at 0, and the run log has no `Kit.txt:` warning and no `missing usage flag` line.
3. Tour pictures: the workshop whole, and two close stops, under the work light. Demo-run pictures of the bot in the room, in the beam.
4. Every `Spot` line has its reason beside it, and nothing red that is not the growth is in the room (G-20).
5. `stat unit` at the workshop is within a tenth of the last numbers.
6. The section test is green and the bot's walk time is unchanged: nothing placed blocks.

## Gate B

1. Standing in the workshop: what happened here, and how long ago?
2. Is this the bar for every room? What is missing from it?
3. Is there anything in it that does not belong on this ship?

## Log

- 2026-11-24: written from the interview of that day. Not started. The room's story is an agent's proposal. Which meshes carry it is not known until the packs have been looked at in a gallery run: the story bends to what the packs hold, and what they lack is listed here.
