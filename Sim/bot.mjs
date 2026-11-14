// A player that plays section 1 by itself, one input per tick. It is for the unattended demo run (DevLoop's run job): the whole
// section gets walked and screenshotted with nobody at the keyboard. The walk is the one the sim's own test does
// (apps/x-stranded/tests/story.test.mjs): A* over the tiles, doors opened on the way, E at each of the story's things.
// On top of that it swings at whatever comes into reach, twice puts its light out for a while, to show the dark, throws a flare
// and a noisemaker in the cargo bay, burns its way through the growth in the service way, and looks into the optional rooms.
import { astar } from './sim/astar.js';
import { tileAt, enumTile as E, SOLID } from './sim/tilemap.js';
import { THINGS } from './sim/story.js';
import { T } from './sim/tuning.js';
import { inputOf } from './sim/snapshot.js';

const S = T.TILE, FIRE = 4, LIGHT = 8, USE = 16; // input.ts's button bits
const thing = (k, name) => THINGS.find(t => t[0] === k && (!name || t[3] === name)).slice(1, 3);
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
  // search the container that holds this thing: stand beside it, face it, E, and wait out the search (about two seconds)
  const loot = function* (id) { const c = s.containers.find(q => !q.opened && q.items.some(i => i?.id === id)); if (!c) return;
    const [bx, by] = beside(s, c.x, c.y); yield* walk(bx, by); face = [(c.x - bx) * S, (c.y - by) * S]; yield* press(USE); yield* wait(130); };
  // throw it from its quick slot, to land dx, dy px from here
  const lob = function* (id, dx, dy) { const slot = s.inv.quick.findIndex(i => i?.id === id); if (slot < 0) return; yield* wait(8); yield inputOf(0, 0, dx * 4, dy * 4, 0, slot); yield* wait(45); };

  // stand and swing until nothing is left in reach (the bot cannot be hurt, so this is for the picture, and so nothing trails it for the rest of the run)
  const fight = function* (ticks) { for (let k = 0; k < ticks && foe(); k++) yield input(0, 0, 0); };
  const use = function* (x, y, ticks = 60) { yield* walk(x, y); yield* press(USE); yield* wait(ticks); };
  // stand facing a shut door for four seconds, so that one screenshot is sure to show what its prompt says
  const read = function* (dx, dy) { face = [dx, dy]; yield* wait(250); };
  const cage = thing('cage'), bulkhead = thing('exit');

  yield* wait(120);                                                                   // waking: a look at the room
  yield* loot('flare');                                                               // the stowage locker: two flares
  yield* use(Math.floor(s.items[0].x / S), Math.floor(s.items[0].y / S));             // the wrench
  yield* walk(bulkhead[0], bulkhead[1] - 2); yield* fight(600);                       // down to the bulkhead: a mite comes out of the vent beside it
  yield* read(0, 40); yield* press(USE); yield* wait(60);                             // the bulkhead is dead
  yield* use(...beside(s, ...thing('generator')));                                    // so is the generator
  yield* use(...beside(s, ...thing('terminal', 'log')));                              // the maintenance log says why
  yield* dark(420);                                                                   // light out for 7 s, no power: only the screen glows
  yield* loot('noisemaker');                                                          // the workshop crate
  yield* walk(11, 11); yield* read(40, 0);                                            // the bay's doors say where they lead
  yield* walk(14, 11); yield* lob('flare', 70, -60); yield* lob('noisemaker', 40, 85); // into the bay: the growth burns; a flare ahead into the dark, a noisemaker off to the side
  yield* walk(cage[0] - 1, cage[1]); yield* fight(600); yield* read(40, 0); yield* press(USE); yield* wait(60); // across the bay, past the nest, to the cage: locked
  yield* use(...beside(s, ...thing('terminal', 'office')));                           // the loadmaster's log: the key is in the ready room
  yield* loot('manifest-key');                                                        // back across the deck to locker three
  yield* use(...beside(s, ...thing('terminal', 'board')));                            // the duty board
  yield* walk(26, 2); yield* lob('flare', 40, 0);                                     // the other way round: the service way, and a flare into the growth that plugs it
  for (let k = 0; k < 40 && s.fires.length; k++) yield* wait(60);                     // let it burn out
  yield* walk(44, 2);                                                                 // on through where the plug was: from here the office is the short way to the cage
  yield* walk(cage[0] - 1, cage[1]); yield* fight(600); yield* read(40, 0); yield* press(USE); yield* wait(60); // through the office to the cage: the key turns
  yield* use(...beside(s, ...thing('cell')));                                         // the cell; the crawler comes out of the bay vent
  yield* use(...beside(s, ...thing('generator')), 150);                               // power: lamps, the door slams, the whisper, the light dies
  yield* relight(); yield* wait(120);                                                  // three smacks and it is back
  yield* dark(420);                                                                   // light out again: the amber lamps by adapted eyes
  yield* use(...thing('window'));                                                     // the viewpoint
  yield* use(Math.floor(s.items[0].x / S), Math.floor(s.items[0].y / S));             // the parts store: something jumps out of a crate; the fire axe
  yield* walk(...bulkhead);                                                           // out: the vent by the bulkhead again, and this time it is a crawler
  for (;;) yield input(0, 0, 0);
}
