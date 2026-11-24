# Lane: interface

**Owns** what is on the screen and under the fingers: menus, the bag and the workbench, what the player is told in play, input, and how a hit given or taken is shown on the screen.

**Serves** the fourth line of the [vision](../VISION.md) (an engineer's hands: four quick slots, a bag of nine, taking things apart and making things at workbenches), the second (cues, not orders; the interface never lies) and the third (every hit is felt).

## Today

- **The HUD is a greybox**: `SCVHud`, plain Slate, no assets. It shows the room's name, the one goal with the found-out facts under it, bars for health and stamina, a prompt, a message, the note panel, a red veil when hurt and a red edge for the spore load. Text is 20 pt at the smallest.
- **Input is fixed bindings** read key by key in `CVPlayerController`: keyboard with mouse, and gamepad. The [README](../../README.md) has the table.
- **No bag screen, no workbench, no map, no menu, no options.** Quick slots are four names in a row.
- **The sim already has the rules**: an inventory of two weapons, four quick slots and a bag (twelve slots where the vision asks for nine), and a workbench that dismantles an object into parts, crafts from recipes, repairs and upgrades (`workbench.ts`). Story mode has no workbench placed yet. The wire carries only the quick slots' names and the weapon's name: no bag, no parts.
- **Leon's picks of 20 Nov**: menus with CommonUI on UMG. In play "look B": a ring at the player's feet (health, stamina, the creep) with prompts beside the thing they belong to. The widget layouts are made by an agent through the editor's MCP server, which he connects. The options he chose from: https://claude.ai/artifact/HCtUPi8ea5bNnnXUNYrVLG
- **The editor's MCP server is not connected.** Until it is, this lane can build C++ and input, not widget layouts.

## Files

| File | What is in it |
|---|---|
| `Source/CrystalVein/SCVHud.*` | Today's HUD. It is replaced piece by piece, not all at once |
| `Source/CrystalVein/CVPlayerController.*` | Reads keys and pad into the sim's input: move, aim, the button bits, a quick slot, pause and restart. Shared with core |
| `Config/DefaultInput.ini` | The engine's input settings |
| `Content/CrystalVein/UI/` | Does not exist yet: the lane's widgets, in git |
| Web repo `src/snapshot.ts` | What the screen can know. Anything new it must show crosses here (G-14) |
| Web repo `src/items.ts`, `src/workbench.ts` | The inventory's and the workbench's rules. The screen owns none of them (G-10) |

## Steps of an interface brief

1. Say what the screen must show and what the player can do there. Every value shown comes from the snapshot; every action goes back as input. If the wire lacks either, the brief changes the wire (G-14).
2. A screen is first a picture: a mock at 1600 x 900 over a real screenshot, for Gate A. A layout is cheaper to get wrong in a mock than in a widget.
3. C++ base class, layout in a UMG asset under `Content/CrystalVein/UI/`. The layout is built through the editor's MCP server; the loop's builds and runs need the editor closed, so the two take turns ([RUNBOOK](../RUNBOOK.md), "The editor's MCP server"). Commit before a bridge session (G-40).
4. Keyboard with mouse and gamepad are both complete, in the same brief. Every screen has a first focus and a way back.
5. A demo run for the HUD; for a menu or the bag, a picture of it open, which needs a tour stop or a console command that opens it.

## What an interface brief must bring

- A picture of every state of the screen: empty, full, selected, disabled.
- The same screen driven by pad and by keys, each from start to finish, said in the log step by step.
- Text sizes measured: nothing under the lane's smallest size.
- What only a player can tell: whether it is found, whether it is fast enough in a fight, whether it reads in the dark.

## Rules of this lane

- **The interface never lies and never gives orders** (vision, line 2). Voices in the story may mislead; the screen may not.
- **Widgets own no game data** (G-10). They show the snapshot.
- **Text is never small.** 20 pt is today's floor at 1600 x 900. A text-size option up to twice that must not clip anything.
- **Colour** (G-20) holds on the screen too: amber asks for attention, red is the organism's, and health is not red.
- **In play, little on the screen.** His pick is the ring at the feet and prompts beside things, not bars in a corner.
- **Pad first.** A screen that needs a mouse is not done.
- **Texts are the story team's** (G-27): labels and prompts come from the sim, not from a widget.

## Backlog

In the order proposed on 20 Nov, which Leon has not yet confirmed.

1. The base: input by actions, a CommonUI stack, the pause menu as the pattern: brief [U-001](../briefs/U-001-the-base.md).
2. The bag: nine slots, four quick slots, two weapons; the wire for it.
3. The workbench: take apart, see the parts, make. With the levels lane, which places the bench.
4. The ring at the player's feet, and prompts beside things, in place of the bars.
5. Options: text size, bindings, volumes.
6. The note reader and the viewpoint; a map.
