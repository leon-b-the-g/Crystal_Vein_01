// Section 1 as it stands in Sim/sim, and the demo bot against it: the plan, the gates, the scripted company.
// Run from the project folder: node --test Sim/story.test.mjs   (about two seconds; no Unreal needed).
// The sim's own cases are in apps/x-stranded/tests/story.test.mjs; this one is the check after `npm run sim:unreal` or a change to bot.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { storyState, stepStory, objective, storyPrompt, ROOMS, THINGS, roomAt } from './sim/story.js';
import { inputOf, snapshot, levelData } from './sim/snapshot.js';
import { tileAt, enumTile as E, SOLID, isDoor } from './sim/tilemap.js';
import { make, give } from './sim/items.js';
import { play } from './bot.mjs';

const S = 16, USE = 16, idle = inputOf(0, 0, 40, 0, 0);
const thing = (k, name) => THINGS.find(t => t[0] === k && (!name || t[3] === name)).slice(1, 3);
const put = (s, x, y) => { s.player.x = s.player.px = (x + 0.5) * S; s.player.y = s.player.py = (y + 0.5) * S; };
const wait = (s, n) => { for (let k = 0; k < n; k++) stepStory(s, idle); };
/** E, looking dx, dy from where the player stands */
const use = (s, dx = 1, dy = 0) => { wait(s, 8); stepStory(s, inputOf(0, 0, dx * 160, dy * 160, USE)); };

test('the plan holds together: doors hang in walls, every floor tile can be walked to and has a room', () => {
  const s = storyState(1), m = s.map, wall = (x, y) => tileAt(m, x, y) === E.wall, open = (x, y) => !SOLID.has(tileAt(m, x, y)), post = (x, y) => wall(x, y) || isDoor(tileAt(m, x, y));
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    const t = tileAt(m, x, y);
    if (isDoor(t)) assert.notEqual(post(x - 1, y) && post(x + 1, y) && open(x, y - 1) && open(x, y + 1), post(x, y - 1) && post(x, y + 1) && open(x - 1, y) && open(x + 1, y), `door at ${x},${y}`);
    else if (!wall(x, y)) assert.notEqual(roomAt((x + 0.5) * S, (y + 0.5) * S), '', `floor at ${x},${y} has no room`);
  }
  const seen = new Uint8Array(m.w * m.h), q = [Math.floor(m.spawn[1] / S) * m.w + Math.floor(m.spawn[0] / S)]; seen[q[0]] = 1;
  for (let k = 0; k < q.length; k++) for (const d of [1, -1, m.w, -m.w]) { const n = q[k] + d, t = m.tiles[n]; if (!seen[n] && (!SOLID.has(t) || isDoor(t))) { seen[n] = 1; q.push(n); } }
  const beside = (x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen[(y + dy) * m.w + x + dx] && open(x + dx, y + dy));
  for (let i = 0; i < m.tiles.length; i++) assert(seen[i] || SOLID.has(m.tiles[i]), `floor at ${i % m.w},${Math.floor(i / m.w)} is cut off`);
  for (const c of s.containers) assert(c.body || beside(c.x, c.y), `container at ${c.x},${c.y}`);
  for (const [k, x, y] of THINGS) assert(seen[y * m.w + x] || beside(x, y), `${k} at ${x},${y}`);
  assert.equal(ROOMS.length, 13);
  assert.equal(levelData(s).lamps.filter(l => l[3]).length, 1, 'only the stowage lamp burns before the power is back');
});

test("the bot's walk clears the section, every beat in its order", () => {
  const s = storyState(1), seen = Uint8Array.from(s.map.tiles), bot = play(s), beats = [], objectives = [];
  s.god = true;
  for (let k = 0; k < 60 * 60 * 8 && !s.escaped; k++) {
    stepStory(s, bot.next().value);
    for (const e of s.story.ev) beats.push(e[0] === 'note' ? e[1] : e[0]);
    const o = snapshot(s, seen).obj; if (o !== objectives.at(-1)) objectives.push(o);
  }
  assert(s.escaped, 'the walk reaches the airlock');
  assert.deepEqual(beats, ['Maintenance log', 'burn', "Loadmaster's log", 'Duty board', 'cell', 'vent', 'power', 'slam', 'whisper', 'view', 'whisper', 'done']);
  assert.deepEqual(objectives, ['Find something to defend yourself with', 'Find a way off this deck', 'Restore emergency power', 'Fetch a power cell from the caged store in the cargo bay',
    "Find the key to the caged store: try the loadmaster's office", 'Fetch the cage key from locker three in the ready room', 'Unlock the caged store at the far end of the cargo bay',
    'Take a power cell from the caged store', 'Fit the power cell to the generator', 'Go through the bulkhead to the crew quarters: end of the corridor, past the ready room', 'Section clear']);
  assert(s.tick / 60 > 180 && s.tick / 60 < 420, `the walk takes ${Math.round(s.tick / 60)} s: the demo run allows ten minutes`);
  assert.deepEqual(s.inv.weapons.map(w => w?.id), ['wrench', 'fire-axe']);
});

test('the cage wants its key, and the key alone is enough', () => {
  const s = storyState(1), [cx, cy] = thing('cage');
  s.god = true; put(s, cx - 1, cy); use(s);
  assert.equal(tileAt(s.map, cx, cy), E.doorLocked);
  assert(s.story.caged && s.msg.startsWith('locked'), s.msg);
  assert.equal(storyPrompt(s), 'Locked: Cell store');
  s.story.armed = true;
  assert.match(objective(s), /loadmaster's office/);
  give(s.inv, make('manifest-key'));
  assert.equal(storyPrompt(s), 'Unlock the cage');
  assert.match(objective(s), /^Unlock the caged store/);
  use(s);
  assert.equal(tileAt(s.map, cx, cy), E.doorOpen);
  assert.match(objective(s), /^Take a power cell/);
  put(s, ...thing('cell').map((v, i) => v - (i ? 0 : 1))); use(s);
  assert(s.story.cell, 'the cell is taken');
  assert(s.ai.aliens.some(a => a.type === 'crawler'), 'and the crawler comes');
});

test('the bulkhead stays shut until the generator runs', () => {
  const s = storyState(1), [ex, ey] = thing('exit'), [gx, gy] = thing('generator');
  s.god = true; s.ambush.length = 0; put(s, ex, ey - 2); use(s, 0, 1);
  assert.equal(tileAt(s.map, ex, ey - 1), E.doorLocked);
  assert(s.story.tried && /no power/.test(s.msg));
  give(s.inv, make('manifest-key')); use(s, 0, 1);
  assert.equal(tileAt(s.map, ex, ey - 1), E.doorLocked, 'the cage key does not open it');
  s.story.cell = true; put(s, gx + 1, gy); use(s, -1, 0);
  assert(s.story.power);
  assert.equal(tileAt(s.map, ex, ey - 1), E.door);
  assert(s.light.dead, 'the light dies once, under the lamps');
});

test('a shut door says where it leads', () => {
  const s = storyState(1), look = (x, y, dx, dy) => { put(s, x, y); stepStory(s, inputOf(0, 0, dx * 160, dy * 160, 0)); return storyPrompt(s); };
  assert.equal(look(8, 4, 1, 0), 'Open: Maintenance corridor');
  assert.equal(look(10, 4, -1, 0), 'Open: Stowage');
  assert.equal(look(11, 11, 1, 0), 'Open: Cargo bay');
  assert.equal(look(10, 19, -1, 0), 'Open: Generator room');
  assert.equal(look(22, 3, 0, 1), 'Open: Cargo bay');
  assert.equal(look(22, 5, 0, -1), 'Open: Service way');
  assert.equal(look(10, 34, 0, 1), 'Locked: Crew quarters');
  assert.equal(look(10, 20, 0, 1), '', 'and nothing when there is no door');
  assert.equal(look(20, 25, 0, 1), 'Look out', 'the window is offered from two tiles off: the tile under it is hidden behind the hull wall');
});

test('the nest wakes when you come near; the body feeds it and does not get up', () => {
  const s = storyState(1);
  s.god = true; wait(s, 120);
  assert.equal(s.ai.aliens.length, 0, 'nobody is about while you are in the stowage');
  const home = [s.player.x, s.player.y]; put(s, 45, 8); wait(s, 2); [s.player.x, s.player.y] = home;
  assert.equal(s.ai.aliens.filter(a => a.type === 'mite').length, 2);
  wait(s, 60 * 60 * 10);
  assert(!s.ai.aliens.some(a => a.type === 'possessed'), 'ten minutes on, the body has not risen');
  assert(s.ai.corpses.some(c => c.type === 'crew' && c.meat >= 1));
});

test('the vent by the bulkhead: a mite the first time, a crawler once the power is back', () => {
  const s = storyState(1), [ex, ey] = thing('exit'), [gx, gy] = thing('generator'), whispers = [];
  s.god = true; put(s, ex, ey - 3); wait(s, 12);
  assert.deepEqual(s.ai.aliens.map(a => a.type), ['mite']);
  s.ai.aliens.length = 0; s.story.cell = true; put(s, gx + 1, gy); use(s, -1, 0);
  put(s, ex, ey - 3);
  for (let k = 0; k < 12; k++) { stepStory(s, idle); for (const e of s.story.ev) if (e[0] === 'whisper') whispers.push(e[1]); }
  assert.deepEqual(s.ai.aliens.map(a => a.type), ['crawler']);
  assert.match(whispers.at(-1) ?? '', /Run/);
});
