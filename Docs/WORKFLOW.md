# Workflow: from a wish to done

Every change to the game travels as a **brief** through two gates that are Leon's. Between the gates agents work unattended.

```
Leon's wish, his notes after playing, or a lane's backlog
      │
      ▼
  brief-writer ──► brief, status proposed
      │
  GATE A  Leon reads the brief and says yes, no or change this      (G-01)
      │
      ▼
  builder ──► changes, tests, build, runs, evidence in the brief's log, commits
      │
      ▼
  verifier ──► checks the result against "Done when", changes nothing
      │                                 status built
  GATE B  Leon plays it and says what he thinks                      (G-02)
      │
      ├─► accepted
      └─► returned: his worst things become the next brief
```

## Who does what

| Role | Does | Never does |
|---|---|---|
| **Leon** | Composes the vision. Approves briefs. Plays and judges. Starts `DevLoop.bat`, installs, adds packs in the editor, commits in the web repo. | |
| **Lead** (the session he talks to) | Reads [STATUS](STATUS.md), picks the next brief with him, hands work to the roles below, keeps STATUS and [DECISIONS](DECISIONS.md) current, brings him the two gates. | Approves or accepts in his place. |
| **Brief-writer** | Turns a wish into a brief from [the template](briefs/TEMPLATE.md), with facts read from the code. | Builds. |
| **Builder**, one per lane | Builds one approved brief in its [lane](lanes/), with evidence. | Works outside the brief's scope; judges feel. |
| **Verifier** | Checks a built brief with fresh eyes and reports what holds, what fails and what nobody has seen. | Fixes what it finds. |

A role is a hat, not a head count. Where subagents exist, each role is its own agent ([agents](agents/)); in a small session one agent wears the hats in turn. The verifier's pass is always a fresh read: start from the brief's "Done when" and the files, not from the builder's memory of what was done.

## A brief's life

A brief is one file in `Docs/briefs/`, named `<id>-<a-few-words>.md`. The id is the lane's letter and a number: `L` levels, `O` organism, `W` world, `U` interface, `C` core. Its status is in its front matter.

| Status | Means | Who moves it on |
|---|---|---|
| `proposed` | Written, waiting for Gate A. | Leon, by approving. The lead records `approved:` with the date and his words. |
| `approved` | Leon said yes. | The builder, when it starts. |
| `building` | Being built. One brief only (G-30). | The lead, on the verifier's verdict. |
| `built` | Verified against "Done when", committed, waiting for his play. Two at most (G-07). | Leon, by playing. |
| `accepted` | He played it and said so: `accepted:` with the date and his words. | |
| `returned` | He played it and it is not right. His notes go into the log, and the next brief answers them. | |
| `dropped` | Not going to be built. One line in the log says why. | |

A brief is small enough for one round: what can be built, verified and played in one go. If "Done when" has more than about six lines, it is two briefs.

## Gate A: the brief

What Leon gets: the brief's link, and in the chat no more than its "What the player gets", its cost and what he has to do at his PC. He approves by saying so. "Yes, but without the breaker" is an approval of the changed brief: change it first, then record his words.

A brief may be written at any time, by any role, for any lane. Writing one costs him nothing until he reads it.

## Build

The builder works through its lane's own steps ([lanes](lanes/)). Common to all:

1. `node Tools/preflight.mjs`. Fix what fails before touching anything else. Set the brief to `building`.
2. Change the game in the right layer ([ARCHITECTURE](ARCHITECTURE.md)): a rule in the sim, a picture in Unreal, a mesh in `Kit.txt`.
3. Prove it at the cheapest level that can: a sim test before a build, a build before a run, a tour before a demo run.
4. Look at what the run made. Read the log's warnings (G-28).
5. Write into the brief's log what was done and how each thing is known (G-06).
6. Commit and push at each checkpoint (G-34).

Between the gates a builder may, without asking: edit this repo; edit the web repo's working tree on `unreal-sim`; build, run, commit and push here through the loop; spend up to the brief's stated budget, saying the cost first.

It stops and asks in the cases of G-50. It does not widen the brief: a good idea found on the way goes into the lane's backlog or a new brief.

## Verify

The verifier takes the brief, the diff and the evidence, and answers three things for every line of "Done when":

- **Holds**, and how that is known (G-06).
- **Fails**, with what was seen instead.
- **Not seen by anyone**: motion, sound, feel, anything only a player can tell.

It also reads the diff for rules in C++ (G-10), hand edits in generated folders (G-11) and work outside the brief's scope. It runs `node Tools/preflight.mjs`. It changes no file: the lead puts its report into the brief's log. If something fails, the brief goes back to the builder; if all holds, the lead sets the status to `built`.

## Gate B: his play

What Leon gets, in the chat:

- how to start it (`Play.bat`),
- the brief's "Gate B" questions, three at most,
- what the verifier listed as not seen by anyone,
- a handful of pictures.

After he has played, read his session before asking him anything: `Play.bat` writes a line every five seconds and every story event to `Saved/Logs/CrystalVein.log` ([RUNBOOK](RUNBOOK.md), "Leon's own sessions"). Then take his notes in his words. His verdict goes into the brief: `accepted:` or, with status `returned`, into the log.

The rule of the round: his **five worst things** decide what is built next, in his order.

## What may run side by side

One tree, one sim copy, one loop: so one builder (G-30). Beside it may run: writing briefs, reading code, research, a verifier that does not need the loop, generating concept images that an approved brief has paid for. Two builders, or a builder and a verifier that both need the loop, may not.

## A session's start and end

Start:
1. [STATUS](STATUS.md), then the brief in hand and its lane.
2. `node Tools/preflight.mjs`.
3. In a Cowork session: check that the folders the work needs are connected ([RUNBOOK](RUNBOOK.md), "Where you are running").

End:
1. The brief's log says what was done, what is known how, and what is open.
2. [STATUS](STATUS.md) is current: last commit, what is uncommitted and where, what waits for Leon.
3. Everything in this repo is committed and pushed, or STATUS says why not.
4. No request is lying in `Saved/DevLoop`.
5. The last message to Leon names what he has to do next, and what nobody has verified.

## Work that has no lane yet

Sound, story text, packaging, the opening comic, the store page. A brief for one of these is a `C` brief until Leon asks for the lane; then the lane gets its own file in `Docs/lanes/`.
