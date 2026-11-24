---
id: U-001
lane: ui
title: The base, and the pause menu as its pattern
status: proposed
created: 2026-11-24
approved:
accepted:
---

# U-001: The base, and the pause menu as its pattern

## Why

Leon's picks of 20 Nov: menus with CommonUI on UMG, layouts made through the editor's MCP server. The fourth line of the [vision](../VISION.md) needs a bag and a workbench screen, and neither can be built before screens can be opened, stacked, focused and closed by pad and by keys. Today there is no menu at all, and keys are read one by one in code.

## What the player gets

Escape, or Start on the pad, freezes the game and opens a pause menu: Resume, Restart from the last checkpoint, Quit. It works by pad alone and by keys alone. Everything else plays as before, with the same controls.

It is small on purpose: it is the pattern the bag and the workbench are built on.

## Scope

In: input by actions in place of key polling, with the same bindings; a root layout with layers (game, menu, modal); a C++ base for a screen; the pause menu; a way to photograph an open menu.
Out: the bag, the workbench, the ring at the player's feet, options, rebinding. The HUD stays `SCVHud` until its own brief.

## Changes

- Unreal, C++: the plugin CommonUI in the `.uproject`; the modules for Enhanced Input, CommonUI, CommonInput and UMG in `CrystalVein.Build.cs` (names checked against the 5.8 headers, G-39). `CVPlayerController`: the key polls become input actions and one mapping context, with the bindings of the [README's](../../README.md) table unchanged; aiming stays as it is. A root layout widget with three layer stacks. `UCVScreen`, the base of every screen: first focus, back, and whether the sim is paused while it is open. The pause menu's class.
- Unreal, assets under `Content/CrystalVein/UI/`: the input actions and the mapping context; `WBP_Root`; `WBP_Pause`. Layouts through the editor's MCP server.
- Wire: none. Pause and restart are in the input already.
- Sim: none.
- Tools: a tour stop that ends in `menu` opens the pause menu before its picture is taken (`CVPlayerController`, beside `hurt` and `sick`); a line for it in [RUNBOOK](../RUNBOOK.md).
- Docs: this lane's file; `README.md`, controls.

## Cost

- Paid: none.
- Leon's part: connect the editor's MCP server once ([RUNBOOK](../RUNBOOK.md), "The editor's MCP server"), and have the editor open for the layout sessions and closed for the builds. If he would rather not connect it yet, he says so, and the two layouts are built in C++ instead: his pick of 20 Nov then waits for the bag.
- Needs: nothing but this repo. The tree is committed before a bridge session (G-40).

## Done when

1. The build is at 0 with the new modules, and a demo run still clears with frame rates within a tenth of the last.
2. A tour picture shows the pause menu open over the frozen game. No text in it is under 20 pt at 1600 x 900.
3. The log lists every binding of the README's table with the action that now carries it: none lost, none changed.
4. The log gives the menu's focus order and what Back does on each item, for pad and for keys.
5. The assets under `Content/CrystalVein/UI/` are committed (LFS), and the run log has no new `Warning`.

## Gate B

No bot presses a key: only Leon can tell whether the controls survived.

1. Do all controls still do what the README's table says, on the pad and on the keys?
2. Is the pause menu right as the pattern for the bag and the workbench: its size, its type, how it opens and closes?
3. Is there a word in it you would change?

## Log

- 2026-11-24: written from his picks of 20 Nov and the interview of that day. Not started. The editor's MCP server has never been connected on this PC; whether the engine ships the bridge program is not checked.
