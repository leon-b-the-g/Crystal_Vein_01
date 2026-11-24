# Lane: organism

**Owns** everything alive or once alive: the growth and its life, the creatures, the crew's bodies and the player's own body. Their rules in the sim, their models, how they move, and what a fight with them does to both sides.

**Serves** the first line of the [vision](../VISION.md) (the place is alive: it senses, each form by its own sense; burned back, never beaten; buds and hosts) and the third (fights are winnable, and they cost).

## Today

**The growth** has the life Leon described on 20 Nov, as rules of the sim drawn by `CVWorldView`: it tests a tile with feelers and swells in over twelve seconds; young growth breathes; after four minutes it is crust with spore pods and the walls beside it are overgrown; crust near the player breathes out red mist every twenty seconds; the mist drifts to the nearest dead crewman, who gets up after fifteen seconds in it; bites carry spores (mite 8, crawler 12, risen crewman 25; from 50 of 100 the load costs health); after five minutes it is crystal that cuts and still burns. Fire burns it back and runs through a connected patch.

**Creatures** in section 1: mite (bites for 5 of the player's 50), crawler (16, sixty hit points, not staggered by a wrench or an axe, rears with a red flare before it bites), the risen crewman (12, and 25 spores). The sim knows more types: brute, spitter, lurker, stalker and others.

**Senses**: the sim has stimuli of five kinds (`sound`, `light`, `pheromone`, `sight`, `damage`), each with one weight for every creature. The vision asks for a different sense per form; that is brief [O-001](../briefs/O-001-a-sense-per-form.md).

**Bodies**: the mite, the crawler and five pieces of the growth are generated models (`SourceArt/PROVENANCE.md`), still, moved whole by code. The risen crewman is a bought skeleton (`Whisper`) that cuts between animations; getting up is its death played backwards. A dead crewman is a pale shape. The player is a cylinder.

**Nobody has been bitten, misted or infected in this version.** The bot cannot be. Every number above is a first guess.

## Files

| File | What is in it |
|---|---|
| Web repo `src/infection.ts` | Growth, spores, clouds, the spore load |
| Web repo `src/ai.ts`, `combat.ts`, `tuning.ts` | Creatures: types, senses, bites, staggers. `T.stim` holds the senses' weights |
| Web repo `src/story.ts`, the numbers at its top | The story's own values: `BITE`, `TOUGH`, `NEST`, `OLD`, `SPORE`, `RISE`, `RISE_UP`, `CARRY`, `GOO` |
| `Kit.txt`, the growth's and the aliens' lines | `Creep +`, `Crust +`, `Crystal +`, `CrystalWall +`, `GrownWall +`, `Feeler +`, and `mite =`, `crawler =`, `possessed =` |
| `Source/CrystalVein/CVWorldView.cpp` | How growth, creatures and mist are drawn (shared with the world lane) |
| `SourceArt/Meshy/`, `SourceArt/PROVENANCE.md`, `Tools/editor_job.py`, `Content/CrystalVein/Meshy/` | Generated models, their record, their import |

## Steps of an organism brief

A rule:
1. The number or the behaviour goes into the sim, as a story-only field if the deck game must not change (G-13).
2. A test in the web repo that pins the behaviour, not the number.
3. Regenerate; the section test here.
4. What the player must be able to read off the screen goes over the wire (G-14) and is drawn.

A body:
1. Say in the brief which it is, a bud or a host, and how old: that sets flesh against anatomy and how much crystal.
2. Cost first (G-04). Then the steps of [RUNBOOK](../RUNBOOK.md), "Generated models". Palette: black, dark red, blood red, bone white; no amber, yellow, green or purple (G-20).
3. Judge it in the game, under the flashlight, at the size it has on screen: a tour stop, then a demo run. Never in a viewer.

A look of the growth:
1. Movement that can live in a material lives there. Redrawing instances every frame cost 30 ms.
2. A stage that appears all at once when a tile comes of age is a known weak spot; say whether the brief touches it.

## What an organism brief must bring

- The sim tests that pin the new behaviour.
- A tour or first-time picture of each thing changed, close enough to see it.
- Frame rates of a demo run against the last one in [STATUS](../STATUS.md).
- The list of what only a player can tell. In this lane that is most of it: whether a creature is a hazard, whether a sense can be learned, whether the growth feels alive.

## Rules of this lane

- **Red is alien and nothing else** (G-20). A concept that comes out amber is not used.
- **It senses; it does not know him.** No behaviour that needs the organism to know this player in particular (vision, line 1).
- **Nothing ends it.** No brief adds a way to clear growth for good.
- **A tell for every threat.** What can hurt the player shows it first: the rearing flare is the model. A sense that cannot be read cannot be learned.
- **Creatures that lay growth** are mites and the risen (`GOO`); crawlers do not.
- Feeding creatures are half deaf. A fed crawler pupates on growth and bursts into four mites seventy seconds later.

## Backlog

1. A sense per form: brief [O-001](../briefs/O-001-a-sense-per-form.md).
2. The crawler rigged and animated: the art bar for creatures (12 Nov). Generated models come without rigs, and a six-legged body has no automatic path: find out with one.
3. The engineer's body, in place of the cylinder.
4. Growth that changes stage gradually, and climbs.
5. The mist: three soft spheres a cloud today, and it hides the crystal under it.
6. His own infection, once Leon has said what it is in Act I ([vision](../VISION.md), "Open" 6).
