# Kestrel Vane (project CrystalVein)

A sci-fi horror game in Unreal Engine 5.8. An electrical engineer wakes on a mining ship that a living thing is taking, and works his way off it in the dark. **Leon Breitenborn directs; agents build.** Every agent and every session starts here.

Unreal draws. The rules run in a TypeScript sim that lives in another repo (the web repo, `lb-systems/apps/x-stranded`) and is copied into `Sim/sim/`.

## Read in this order

1. [Docs/STATUS.md](Docs/STATUS.md): what is built, what is open, what waits for Leon.
2. [Docs/VISION.md](Docs/VISION.md): what the game is.
3. [Docs/GUARDRAILS.md](Docs/GUARDRAILS.md): the rules. They bind.
4. [Docs/WORKFLOW.md](Docs/WORKFLOW.md): how a wish becomes a brief, is approved, built, checked and played.
5. Your lane in [Docs/lanes/](Docs/lanes/) and your brief in [Docs/briefs/](Docs/briefs/).
6. [Docs/ARCHITECTURE.md](Docs/ARCHITECTURE.md) and [Docs/RUNBOOK.md](Docs/RUNBOOK.md) before you touch code or the pipeline.

Who wins a disagreement: Leon's words, then the vision, then the guardrails, then a brief, then your own idea.

## The rules a newcomer breaks first

- Build nothing without a brief Leon has approved (G-01). Nothing is done until he has played it (G-02).
- Rules go into the sim, never into C++ (G-10). `Sim/sim/` and `Audio/` are generated: never edit them (G-11).
- Red is alien and nothing else (G-20).
- One builder at a time (G-30). One work loop (G-31). Every job through `Tools/loop.mjs` (G-32).
- Never commit or push in the web repo (G-35).
- Say how you know: tested, measured, seen in a still, or not verified (G-06).
- Spend nothing the brief does not list (G-04). Publish nothing (G-05).
- When a rule stops you, stop and ask (G-50). Do not route around it.

## Two commands

```
node Tools/preflight.mjs      checks the project against its own rules: run it first, and before every commit
node Tools/loop.mjs status    the work loop on Leon's PC: build, run, editor, commit and push go through it
```

## Lanes

| Lane | Owns | Briefs |
|---|---|---|
| [levels](Docs/lanes/levels.md) | Each section's plan, goals, found-out facts, scripted company, texts | `L-` |
| [organism](Docs/lanes/organism.md) | The growth and its life, creatures and their senses, every body | `O-` |
| [world](Docs/lanes/world.md) | What rooms are made of and furnished with, light and dark, the camera | `W-` |
| [interface](Docs/lanes/ui.md) | Menus, the bag and the workbench, the HUD, input | `U-` |
| core | What no lane owns: the wire, the pipeline, tools, sound, these documents | `C-` |

## Roles

[Docs/agents/](Docs/agents/) holds one file per role: `brief-writer`, a builder for each lane (`level-builder`, `organism-builder`, `world-builder`, `ui-builder`) and `verifier`. They are the instructions for the role in hand: read the file for your role; when a subagent is used, give it that file's text and the brief.

Each file carries the front matter of a Claude Code subagent. Copied to `.claude/agents/` on the PC, Claude Code lists them by name. That copy is Leon's to make and to refresh: a session that reaches the PC through the desktop app is not allowed to write into `.claude`.

## When you leave

The brief's log says what was done and how each thing is known. [Docs/STATUS.md](Docs/STATUS.md) is current. This repo is committed and pushed. No request is lying in `Saved/DevLoop`. Leon knows what he has to do next and what nobody has verified. The whole list: [Docs/WORKFLOW.md](Docs/WORKFLOW.md), "A session's start and end".
