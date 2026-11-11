import { T } from "./tuning.js";
import { createState, step } from "./sim.js";
import { parseAscii, visionSegments, setTile, tileAt, enumTile } from "./tilemap.js";
import { spawnAlien, emit, ejectFromDoor } from "./ai.js";
import { ignite } from "./fire.js";
import { make } from "./items.js";
import { cos, sin, hypot } from "./dmath.js";
const S = T.TILE;
const PLAN = [
    '#####################################',
    '#l.....1l#..#.......................#',
    '#...*....#..#..cc........cc.........#',
    '#..@.W...#..#..c2.*......cc...B.M...#',
    '#........D..#.................M..~~.#',
    '#........#..#......~~~...........~~~#',
    '#..l.....#*.#.....~~~~~.....cc......#',
    '##########..D....~F~~~~.....c3......#',
    '#........#..D....~~~~~~.............#',
    '#...tt...#..#.....~~~~~..S..........#',
    '#T...*...#..#......~~~........#######',
    '#........D..#..cc.............#...*.#',
    '#........#..#..c4.*...........D...P.#',
    '#......5.#.*#.................#.....#',
    '##########..#bb...............#..c..#',
    '#........#..#.................#######',
    '#........#..#########################',
    '#..cc....#..#...6...........#########',
    '#G...*...#*.#.......*.......#########',
    '#........A..#...............#########',
    '#........#..D....tt.....tt..#########',
    '#...cc...#..#...............#########',
    '#........#..#......V........#########',
    '##########LL#########################',
    '##########XX#########################',
    '#####################################',
];
if (PLAN.some(r => r.length !== PLAN[0].length))
    throw new Error('story plan: rows differ in length');
const BASE = { W: '.', T: 'o', P: 't', G: 'o', V: '.', X: '.', F: '~', B: '.', M: '.', S: 'v', A: 'D' };
const LOOT = {
    1: { tile: 'l', items: [['flare', 2]] },
    2: { tile: 'c', items: [['ration']] },
    3: { tile: 'c', items: [['medkit']] },
    4: { tile: 'c', items: [['flare']] },
    5: { tile: 'c', items: [['bandage'], ['noisemaker']] },
    6: { tile: 'l', items: [['ration']] },
};
const AT = {};
const ROWS = PLAN.map((row, y) => [...row].map((ch, x) => { const b = BASE[ch] ?? LOOT[ch]?.tile; if (b)
    (AT[ch] ??= []).push([x, y]); return b ?? ch; }).join(''));
const at = (k) => AT[k][0];
const mid = ([x, y]) => [(x + 0.5) * S, (y + 0.5) * S];
const NOTE = ['Maintenance log', 'Main bus is dead. The emergency generator across the corridor still turns over, but its cell is flat.\n\nSpare cells are in the caged store at the far end of the cargo bay. Cell first, then the generator. The bulkhead to the crew quarters will not cycle without power.\n\nKeep your light off in the bay if you can stand it. They come to light.'];
const VIEW = ['Observation gallery', 'Beyond the glass the Kestrel Vane hangs off the port side, running dark. One red light pulses on her hull, slow as breathing.'];
const WHISPER = 'A woman\'s voice, close, from nowhere: "You\'re awake. Come home."';
const BURN_AT = 5.5, REACH = 1.5, GEN_LOUD = [60, 400];
export const ROOMS = [['Stowage', 1, 1, 8, 6], ['Workshop', 1, 8, 8, 6], ['Generator room', 1, 15, 8, 8], ['Maintenance corridor', 10, 1, 2, 22],
    ['Cell store', 31, 11, 5, 4], ['Cargo bay', 13, 1, 23, 15], ['Observation gallery', 13, 17, 15, 6], ['Airlock', 10, 24, 2, 1]];
export const roomAt = (x, y) => { const tx = Math.floor(x / S), ty = Math.floor(y / S); return ROOMS.find(([, rx, ry, w, h]) => tx >= rx && tx < rx + w && ty >= ry && ty < ry + h)?.[0] ?? ''; };
export const THINGS = [['terminal', ...at('T')], ['cell', ...at('P')], ['generator', ...at('G')], ['window', ...at('V')], ['vent', ...at('S')], ['slam', ...at('A')],
    ...AT.X.map(([x, y]) => ['exit', x, y])];
export function storyState(seed = 1) {
    const s = createState(seed, 1, 'crew', true, false), map = parseAscii(ROWS, seed);
    Object.assign(map, { decor: [], rooms: ROOMS.map(([, x, y, w, h], id) => ({ id, x, y, w, h, kind: 'hall', doors: 1, cx: x + (w >> 1), cy: y + (h >> 1) })), edges: [], spawnRoom: 0, elevator: [-9, -9] });
    s.map = map;
    s.segs = visionSegments(map);
    s.ai.regions = s.ai.vents = s.ai.goo = null;
    s.player.x = s.player.px = map.spawn[0];
    s.player.y = s.player.py = map.spawn[1];
    const [wx, wy] = mid(at('W'));
    s.items.push({ x: wx, y: wy, it: make('wrench') });
    for (const k in LOOT)
        for (const [x, y] of AT[k])
            s.containers.push({ x, y, opened: false, items: LOOT[k].items.map(([id, n]) => make(id, n)) });
    const [bx, by] = mid(at('B'));
    s.ai.corpses.push({ type: 'crew', x: bx, y: by, facing: 2, t: 99, meat: 1, spores: 0 });
    s.containers.push({ x: at('B')[0], y: at('B')[1], opened: false, body: true, items: [make('bandage'), make('flare')] });
    for (const m of AT.M)
        spawnAlien(s.ai, 'mite', ...mid(m));
    s.story = { armed: false, read: false, tried: false, cell: false, power: false, burn: false, done: false, ev: [] };
    return s;
}
const near = (s, k) => { const [x, y] = mid(at(k)); return hypot(x - s.player.x, y - s.player.y) < REACH * S; };
const faces = (s, t) => [0.9, 0.4].some(d => tileAt(s.map, Math.floor((s.player.x + cos(s.player.aim) * S * d) / S), Math.floor((s.player.y + sin(s.player.aim) * S * d) / S)) === t);
export function objective(s) {
    const st = s.story;
    if (!st)
        return '';
    return st.done ? 'Section clear' : !st.armed ? 'Find something to defend yourself with' : st.power ? 'Go through the bulkhead to the crew quarters' : st.cell ? 'Fit the power cell to the generator'
        : st.read ? 'Fetch a power cell from the caged store in the cargo bay' : st.tried ? 'Restore emergency power' : 'Find a way off this deck';
}
export function storyPrompt(s) {
    const st = s.story;
    if (!st || st.done || !s.player.alive || s.player.hidden)
        return '';
    return near(s, 'P') && !st.cell ? 'Take the power cell' : near(s, 'G') && !st.power ? (st.cell ? 'Fit the power cell' : 'Check the generator') : near(s, 'T') ? 'Read the terminal' : near(s, 'V') ? 'Look out' : '';
}
function wake(s) {
    const [vx, vy] = at('S'), [x, y] = mid([vx, vy]), a = spawnAlien(s.ai, 'crawler', x, y), p = s.player;
    a.emergeT = T.ai.emergeTime;
    a.alert = 40;
    a.stimX = p.x;
    a.stimY = p.y;
    a.stimT = s.tick;
    s.story.ev.push(['vent', vx, vy]);
}
function powerUp(s) {
    const st = s.story, m = s.map, [gx, gy] = mid(at('G'));
    st.power = true;
    st.ev.push(['power']);
    s.msg = 'emergency power restored';
    for (let i = 0; i < m.tiles.length; i++)
        if (m.tiles[i] === enumTile.doorLocked)
            m.tiles[i] = enumTile.door;
    for (const [x, y] of AT.A)
        if (tileAt(m, x, y) === enumTile.doorOpen) {
            setTile(m, x, y, enumTile.door);
            ejectFromDoor(m, s.player, x, y, T.player.radius);
            for (const a of s.ai.aliens)
                if (ejectFromDoor(m, a, x, y, T.ai.types[a.type].r)) {
                    a.path = [];
                    a.repathAt = 0;
                }
            st.ev.push(['slam', x, y]);
        }
    s.segs = visionSegments(m);
    s.ai.regions = null;
    emit(s.ai, gx, gy, 'sound', GEN_LOUD[0], GEN_LOUD[1], s.tick);
    st.ev.push(['whisper', WHISPER]);
}
export function stepStory(s, inp) {
    const st = s.story, p = s.player, use = inp.interact && s.tick - p.lastAction > 6 && p.alive && !p.hidden;
    step(s, inp);
    st.ev = [];
    if (st.done || !p.alive)
        return;
    if (s.inv.weapons.some(Boolean))
        st.armed = true;
    if (use) {
        if (near(s, 'P') && !st.cell) {
            st.cell = true;
            st.ev.push(['cell']);
            s.msg = 'you have the power cell';
            wake(s);
        }
        else if (near(s, 'G') && !st.power) {
            if (st.cell)
                powerUp(s);
            else {
                st.tried = true;
                s.msg = 'the generator turns over and dies: its cell is flat';
            }
        }
        else if (near(s, 'T')) {
            st.read = true;
            st.ev.push(['note', ...NOTE]);
        }
        else if (near(s, 'V'))
            st.ev.push(['view', ...VIEW]);
        else if (!st.power && faces(s, enumTile.doorLocked)) {
            st.tried = true;
            s.msg = 'the bulkhead is dead: no power';
        }
    }
    const [fx, fy] = at('F'), [cx, cy] = mid([fx, fy]);
    if (!st.burn && hypot(cx - p.x, cy - p.y) < BURN_AT * S && ignite(s, fx, fy)) {
        st.burn = true;
        st.ev.push(['burn', fx, fy]);
        s.msg = 'a conduit arcs: the growth takes fire';
    }
    if (AT.X.some(([x, y]) => Math.floor(p.x / S) === x && Math.floor(p.y / S) === y)) {
        st.done = true;
        s.escaped = true;
        st.ev.push(['done']);
        s.msg = '';
    }
}
