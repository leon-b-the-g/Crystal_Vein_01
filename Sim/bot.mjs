// A player that plays section 1 by itself, one input per tick. It is for the unattended demo run (DevLoop's run job): the whole
// section gets walked and screenshotted with nobody at the keyboard. The walk is the one the sim's own test does
// (apps/x-stranded/tests/story.test.mjs): A* over the tiles, doors opened on the way, E at each of the story's things.
// On top of that it swings at whatever comes into reach and twice puts its light out for a while, to show the dark.
import { astar } from './sim/astar.js';
import { tileAt, enumTile as E, SOLID } from './sim/tilemap.js';
import { THINGS } from './sim/story.js';
import { T } from './sim/tuning.js';
import { inputOf } from './sim/snapshot.js';

const S = T.TILE, FIRE = 4, LIGHT = 8, USE = 16; // input.ts's button bits
const thing = k => THINGS.find(t => t[0] === k).slice(1);
const beside = (s, x, y) => [[-1, 0], [1, 0], [0, -1], [0, 1]].map(([dx, dy]) => [x + dx, y + dy]).find(([nx, ny]) => !SOLID.has(tileAt(s.map, nx, ny)));

/** yields the input for each tick, for as long as it is asked; s is the live state the sidecar steps in between */
export function* play(s) {
  const p = s.player;
  let face = [40, 0]; // where it looks when nothing is in reach: the way it last walked
  const foe = () => { let best = null, bd = 30; for (const a of s.ai.aliens) { const d = Math.hypot(a.x - p.x, a.y - p.y); if (!a.inVent && a.hp > 0 && d < bd) { bd = d; best = a; } } return best; };
  // fight: aim and swing at what is in reach, unless this tick's aim matters for something else (a door)
  const input = (mx, my, bits, fight = true) => { const a = fight ? foe() : null, [ax, ay] = a ? [a.x - p.x, a.y - p.y] : face, l = Math.hypot(ax, ay) || 1;
    return inputOf(mx * 127, my * 127, Math.round(ax / l * 160), Math.round(ay / l * 160), bits | (a ? FIRE : 0)); };
  const wait = function* (n) { for (let k = 0; k < n; k++) yield input(0, 0, 0); };
  const press = function* (bit) { yield* wait(8); yield input(0, 0, bit, false); }; // 8 ticks: past the sim's "can act" gap
  const relight = function* () { while (s.light.dead && p.alive) yield* press(LIGHT); }; // a dead light is smacked until it comes back
  const walk = function* (gx, gy) {
    const m = s.map, free = (x, y) => { const t = tileAt(m, x, y); return !SOLID.has(t) || t === E.door; };
    for (let plan = 0; plan < 60 && p.alive && !s.escaped; plan++) {
      const sx = Math.floor(p.x / S), sy = Math.floor(p.y / S); if (sx === gx && sy === gy) return;
      const path = astar(m.w, m.h, (x, y) => free(x, y) ? 1 : Infinity, sx, sy, gx, gy);
      if (!path) { yield* wait(30); continue; } // shut in for the moment: look again shortly
      for (let k = 2; k < path.length && p.alive && !s.escaped; k += 2) {
        const tx = path[k], ty = path[k + 1], cx = (tx + 0.5) * S, cy = (ty + 0.5) * S;
        yield* relight();
        if (tileAt(m, tx, ty) === E.door) { face = [cx - p.x, cy - p.y]; yield* press(USE); yield* wait(4); if (tileAt(m, tx, ty) === E.door) break; } // still shut: plan again
        let n = 0;
        while (Math.hypot(cx - p.x, cy - p.y) > 2 && n++ < 240) { const dx = cx - p.x, dy = cy - p.y; if (Math.hypot(dx, dy) > 4) face = [dx, dy]; yield input(Math.sign(Math.round(dx)), Math.sign(Math.round(dy)), 0); }
        if (n > 240) break; // something is in the way: plan again
      }
    }
  };
  const dark = function* (ticks) { yield* press(LIGHT); yield* wait(ticks); yield* press(LIGHT); yield* wait(60); };

  yield* wait(120);                                                                   // waking: a look at the room
  yield* walk(Math.floor(s.items[0].x / S), Math.floor(s.items[0].y / S)); yield* press(USE); yield* wait(60); // the wrench
  yield* walk(...beside(s, ...thing('terminal'))); yield* press(USE); yield* wait(60); // the note
  yield* dark(420);                                                                   // light out for 7 s, no power: only the screen glows
  yield* walk(...beside(s, ...thing('cell'))); yield* press(USE); yield* wait(60);     // through the burning bay to the cell; the crawler comes
  yield* walk(...beside(s, ...thing('generator'))); yield* press(USE); yield* wait(150); // power: lamps, the door slams, the whisper, the light dies
  yield* relight(); yield* wait(120);                                                  // three smacks and it is back
  yield* dark(420);                                                                   // light out again: the amber lamps by adapted eyes
  yield* walk(...thing('window')); yield* press(USE); yield* wait(60);                 // the viewpoint
  yield* walk(...thing('exit'));
  for (;;) yield input(0, 0, 0);
}
