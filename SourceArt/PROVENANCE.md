# Where each source asset came from

One row per asset, added the day it is made. Everything generated is a placeholder until the designer replaces or signs it off
(decision of 10 Nov 2026: generated now, replaced later; the most visible assets first). Check the generator's terms for the
account's plan before any release: this file records facts, not a licence opinion.

| Asset | Files | Made with | Date | Cost | Status | Notes |
|---|---|---|---|---|---|---|
| Supply case (lootable container) | `Meshy/supply_case/supply_case.glb`, `supply_case_textures/` (base colour, metallic, roughness, normal, 2K), `concept.png`, `preview.png` | Meshy via its MCP server. Concept: text-to-image, model `nano-banana`, task `01a1c7d6-141e-7041-8f50-93e974b98072`. Mesh: image-to-3D from that task, `meshy-t2` smart topology, target 4,000 triangles, default texture model with PBR maps, task `01a1c7d6-c04f-71e6-8178-61386e1ef148`. | 2026-11-11 | 3 + 15 = 18 credits | Placeholder, not in the Unreal project yet | 3,969 triangles, 4,617 vertices, one material. 1.00 x 0.46 x 0.78 m, pivot at the centre (not the bottom). Known flaw: the flat lid shades as four triangles (see `preview.png`); fix in Blender (flatten the lid, weighted normals) before import. Stencil text is gibberish. |

## Prompts

**Supply case, concept image:**

> A single sci-fi equipment supply case from a deep-space research ship. Hard-surface industrial design: a rectangular hard-shell
> case about 90 cm wide, matte blue-grey painted metal with worn, chipped edges, reinforced corners, two heavy mechanical latches
> on the front, recessed carry handles on both sides, one narrow amber status light strip on the lid, small stencilled white
> inventory markings. No red anywhere. Three-quarter view from slightly above, the whole object in frame and centred, plain
> mid-grey background, soft even studio lighting, no cast shadow, photorealistic game prop concept.

## Colour rule the prompts follow

Cold blue-grey is the ship. Amber is the ship asking for attention (emergency lamps, status lights, things that hold loot).
Red is alien and nothing else.
