# Lane: world

**Owns** how the ship looks: what each room is made of and furnished with, the light, the dark, the camera, and what the player can and cannot see.

**Serves** the second line of the [vision](../VISION.md) (the dark and the beam) and his words of 19 Nov: "The rooms seemed bare, they need assets, flavour and the correct interior design respective to the scene at hand". Since 24 Nov the scene at hand is a mining ship, days after: rooms left in the middle of a shift.

## Today

- **The kit.** Floors, wall panels, doors and furniture come from Leon's bought packs, placed by `Kit.txt`: by kind of piece, in every room or in one. Section 1's plan holds 29 tables, 27 lockers, 44 crates, 4 consoles and 2 barrels; `Kit.txt` says what each is in each room (a table is a workbench in the workshop and a desk in the office). What lies on tables and floors takes turns by tile.
- **Nothing is placed by hand.** There is no way to put one prop at one chosen spot. That is brief [W-001](../briefs/W-001-the-workshop.md).
- **Light.** Black outside the beam and the lamps (`FillLux` 0.25). Eighteen lamps, amber; after the power comes back two in three burn, one in four of those unsteady. The flashlight is 350 cd with a small spill above the head. Exposure is set by hand from what the flashlight does (dark adaptation). Lights of the growth, fire and screens are small unshadowed point lights; a thrown flare is a white light low over the floor that throws long shadows.
- **Camera.** Fixed: yaw -45, pitch -58, 41 m away through a 30 degree lens, about 22 x 15 m of deck on screen.
- **Walls** are 220 cm high and hide about 1.4 m of floor behind them: the south row and the west column of every room. No cut-away, no fade.
- **No line-of-sight mask**: a lit room behind a wall shows.
- **Doors** slide into the wall in 0.4 s inside lit frames; cold strip: opens, amber strip: wants power or a key.
- Nobody has judged the furnished rooms or the darkness by playing.

## Files

| File | What is in it |
|---|---|
| `Kit.txt`, all but the growth's and the aliens' lines | Which mesh is which piece, room by room. Its head documents every kind of line |
| `Source/CrystalVein/CVWorldView.*` | Builds and draws the deck: tiles, kit, wall faces, lamps, glows, doors (shared with the organism lane). `LoadKit` reads `Kit.txt` |
| `Source/CrystalVein/CVPawn.*` | The body's stand-in, flashlight, camera, exposure |
| `Source/CrystalVein/CVGallery.*` | The gallery run |
| Web repo `src/story.ts`, the furniture letters in `PLAN` | Furniture is an obstacle to the sim: adding or moving it is a change to the plan, made with the [levels lane's](levels.md) tests |
| `Content/<Pack>/` | Bought packs, not in git |

Tune without a build: press Play, eject (F8), select the pawn or the CVWorldView actor: `FlashlightCandelas`, `SpillCandelas`, `ExposureLit`, `ExposureDark`, `CameraPitch`, `CameraYaw`, `CameraDistance`; `LampCandelas`, `FireCandelas`, `CreepCandelas`, `FillLux`, `bLampShadows`. A value that is kept goes into the code with a comment saying what it does to the picture.

## Steps of a world brief

Dressing a room:
1. Write the room's story in two sentences in the brief: who worked here, what was in hand when it happened, what the organism has done to it since. Every thing placed answers to that (G-21).
2. Find the meshes: a gallery run of the pack folders, filtered by name.
3. Lines in `Kit.txt`. `node Tools/preflight.mjs kit`.
4. A tour run of the room; then a demo run to see it in the beam, which is how the player sees it.
5. If furniture has to move or be added: the plan in `story.ts`, with the no-pockets test (G-23).

Light, camera, what is seen:
1. Try values in a running game first where a property exists; exposure is never metered ([RUNBOOK](../RUNBOOK.md), "Traps").
2. C++ in `CVWorldView` or `CVPawn`, engine calls checked against the 5.8 headers (G-39).
3. Build, a tour with `stat unit` in `exec.txt`, a demo run. Compare frame rates with [STATUS](../STATUS.md).

## What a world brief must bring

- Tour pictures of every room changed, under the work light, and demo-run pictures of the same rooms in the beam.
- `Kit.txt` clean in preflight; no `Kit.txt` or `missing usage flag` line in the run log (G-28).
- Frame time, GPU time and video memory from `stat unit`, against the last numbers.
- What only a player can tell: whether a room reads as what it is, whether the dark is right.

## Rules of this lane

- **Colour** (G-20): cold is the ship, amber is the ship asking, red is alien. Nothing red from a pack is used on the ship: extinguishers, red cases, red panels.
- **Nothing because it is there** (G-21). A rifle pack is in the project and has no use: section 1 has no gun.
- **Faces to the camera** (G-22), until walls get a cut-away.
- **Loot looks like the ship.** Crates and lockers hold loot and carry the amber tag: they keep one look, and nothing stands on them.
- **Days, not years**: no dust, no rust that years would make. Wet, recent, interrupted. A pack's rust-brown desk beside the cold kit is a known mismatch.
- **Packs stay out of git** (G-24); a missing pack must leave grey boxes, not a crash.
- A material from a pack that lands on an instanced mesh can draw grey outside the editor (G-28).

## Backlog

1. Props placed by hand, and the workshop as the first finished room: brief [W-001](../briefs/W-001-the-workshop.md).
2. Walls that do not hide the room: cut-away or fade for south and west walls. Ends G-22 and shows the gallery's window.
3. A line-of-sight mask: what he cannot see is not drawn.
4. The other twelve rooms to the workshop's bar.
5. Lamp groups, so that power can come back in stages (with the levels lane).
6. A window that can sit on any wall; a map.
