// 2026-11-13: section 1 was grown in this file by hand, ahead of apps/x-stranded/src/story.ts (the web repo was not connected that day).
// Port it there before running `npm run sim:unreal`: that writes this file from story.ts and would put the old section back.
import { T } from "./tuning.js";
import { createState, step } from "./sim.js";
import { parseAscii, visionSegments, setTile, tileAt, enumTile, doorGroup } from "./tilemap.js";
import { spawnAlien, emit, ejectFromDoor } from "./ai.js";
import { ignite } from "./fire.js";
import { make } from "./items.js";
import { cos, sin, hypot } from "./dmath.js";
const S = T.TILE;
const PLAN = [
    '###################################################',
    '#l.....1l#..#..cc..........~~~~~~..8..............#',
    '#...*....#..D.....*........~~Y~~~.....v..*........#',
    '#..@.W...#..#..............~~~~~~.................#',
    '#........D..##########D######################D#####',
    '#........#..#.........................cc.#.....N.l#',
    '#..l.....#*.#...cc.........cc.####.......#........#',
    '##########..#...c2..*......cc.####.*.....#..*.tt..#',
    '#........#..#........~~~.................D........#',
    '#...tt...#..#.......~~~~~.##.............#.......9#',
    '#T...*...#..#......~~~~~~.##.......~~M...#........#',
    '#........D..D......F~~~~~.##.......~B~~..##########',
    '#........#..D.......~~~~~.##.......M~~...#.....c###',
    '#......5.#..#........~~~.................#....P.###',
    '##########..#............................C..*...###',
    '#........#.*#............................#......###',
    '#........#..#..........cc.....####..cc...#cc....###',
    '#..cc....#..#...cc.....c......####..c3...##########',
    '#G...*...#..#...c4..*...........S........##########',
    '#........A..#.bb......................*..##########',
    '#........#..#............................##########',
    '#...cc...#..######################D################',
    '#........#..#...6...........#.cc....ccQ..##########',
    '##########*.#...............#............##########',
    '#llKl7.R.#..#......tt.*.....D......*.....##########',
    '#........#..D...............#..ccH..Z.tt.##########',
    '#.....*..#..#...........tt..#............##########',
    '#..tt....D..#.......V.......#............##########',
    '#........#..#######################################',
    '#..tt....#..#######################################',
    '#........#.*#######################################',
    '##########.....l###################################',
    '##########.....l###################################',
    '##########..U...###################################',
    '##########......###################################',
    '##########LL#######################################',
    '##########XX#######################################',
    '###################################################',
];
if (PLAN.some(r => r.length !== PLAN[0].length))
    throw new Error('story plan: rows differ in length');
const BASE = { W: '.', Z: '.', T: 'o', N: 'o', R: 'o', P: 't', G: 'o', V: '.', X: '.', F: '~', Y: '~', B: '.', M: '.', S: 'v', U: 'v', H: 'c', A: 'D', C: 'L' };
const LOOT = {
    1: { tile: 'l', items: [['flare', 2]] },
    2: { tile: 'c', items: [['ration']] },
    3: { tile: 'c', items: [['medkit']] },
    4: { tile: 'c', items: [['flare']] },
    5: { tile: 'c', items: [['bandage'], ['noisemaker']] },
    6: { tile: 'l', items: [['ration']] },
    7: { tile: 'l', items: [['bandage', 2]] },
    8: { tile: 'c', items: [['flare'], ['noisemaker']] },
    9: { tile: 'l', items: [['bandage']] },
    K: { tile: 'l', items: [['manifest-key']] },
    Q: { tile: 'c', items: [['noisemaker']] },
};
const AT = {};
const ROWS = PLAN.map((row, y) => [...row].map((ch, x) => { const b = BASE[ch] ?? LOOT[ch]?.tile; if (b)
    (AT[ch] ??= []).push([x, y]); return b ?? ch; }).join(''));
const at = (k) => AT[k][0];
const mid = ([x, y]) => [(x + 0.5) * S, (y + 0.5) * S];
const NOTES = {
    T: ['read', 'Maintenance log', 'Main bus is dead. The emergency generator across the corridor still turns over, but its cell is flat.\n\nSpare cells are in the caged store at the far end of the cargo bay. The loadmaster keeps the key. Cell first, then the generator: the bulkhead to the crew quarters will not cycle without power.\n\nKeep your light off in the bay if you can stand it. They come to light.'],
    N: ['office', 'Loadmaster\'s log', 'Hold two stays sealed until somebody tells me what is in those cases. The survey team signed them in as mineral samples. Mineral samples do not need the lights kept off.\n\nI have locked the cell cage as well. Everything that keeps this deck alive is in there.\n\nThe key is with my kit: ready room, locker three. If I am not about, you did not get it from me.'],
    R: ['board', 'Duty board', 'Deck watch, last entries.\n\nCargo bay: not relieved.\nWorkshop: not relieved.\nGenerator: not relieved.\n\nUnderneath, in grease pencil: SOMETHING IN THE VENTS KNOWS OUR NAMES.'],
};
const VIEW = ['Observation gallery', 'Beyond the glass the Kestrel Vane hangs off the port side, running dark. One red light pulses on her hull, slow as breathing.'];
const WHISPER = 'A woman\'s voice, close, from nowhere: "You\'re awake. Come home."';
const RUN = 'The voice again, sharp: "Run."';
const BURN_AT = 5.5, NEST_AT = 11, PLUG_AT = 4, REACH = 1.5, VIEW_REACH = 2.5, GEN_LOUD = [60, 400], MEAL = 200;
export const ROOMS = [['Stowage', 1, 1, 8, 6], ['Workshop', 1, 8, 8, 6], ['Generator room', 1, 15, 8, 8], ['Ready room', 1, 24, 8, 7], ['Bulkhead lobby', 10, 31, 6, 4],
    ['Maintenance corridor', 10, 1, 2, 34], ['Service way', 13, 1, 37, 3], ['Cargo bay', 13, 5, 28, 16], ['Loadmaster\'s office', 42, 5, 8, 6], ['Cell store', 42, 12, 6, 5],
    ['Observation gallery', 13, 22, 15, 6], ['Parts store', 29, 22, 12, 6], ['Crew quarters', 10, 36, 2, 1]];
export const roomAt = (x, y) => { const tx = Math.floor(x / S), ty = Math.floor(y / S); return ROOMS.find(([, rx, ry, w, h]) => tx >= rx && tx < rx + w && ty >= ry && ty < ry + h)?.[0] ?? ''; };
export const THINGS = [['terminal', ...at('T'), 'log'], ['terminal', ...at('N'), 'office'], ['terminal', ...at('R'), 'board'], ['cell', ...at('P')], ['generator', ...at('G')], ['window', ...at('V')],
    ['vent', ...at('S')], ['vent', ...at('U'), 'lobby'], ['slam', ...at('A')], ['cage', ...at('C')], ...AT.X.map(([x, y]) => ['exit', x, y])];
export function storyState(seed = 1) {
    const s = createState(seed, 1, 'crew', true, false), map = parseAscii(ROWS, seed);
    Object.assign(map, { decor: [], rooms: ROOMS.map(([, x, y, w, h], id) => ({ id, x, y, w, h, kind: 'hall', doors: 1, cx: x + (w >> 1), cy: y + (h >> 1) })), edges: [], spawnRoom: 0, elevator: [-9, -9] });
    s.map = map;
    s.segs = visionSegments(map);
    s.ai.regions = s.ai.vents = s.ai.goo = null;
    s.player.x = s.player.px = map.spawn[0];
    s.player.y = s.player.py = map.spawn[1];
    for (const [k, id] of [['W', 'wrench'], ['Z', 'fire-axe']]) {
        const [x, y] = mid(at(k));
        s.items.push({ x, y, it: make(id) });
    }
    for (const k in LOOT)
        for (const [x, y] of AT[k])
            s.containers.push({ x, y, opened: false, items: LOOT[k].items.map(([id, n]) => make(id, n)) });
    const [bx, by] = mid(at('B'));
    s.ai.corpses.push({ type: 'crew', x: bx, y: by, facing: 2, t: 99, meat: MEAL, spores: 0 });
    s.containers.push({ x: at('B')[0], y: at('B')[1], opened: false, body: true, items: [make('bandage'), make('flare')] });
    s.ambush.push({ x: at('U')[0], y: at('U')[1], kind: 'vent', type: 'mite' }, { x: at('H')[0], y: at('H')[1], kind: 'crate', type: 'mite' });
    s.story = { armed: false, read: false, tried: false, caged: false, office: false, board: false, nest: false, plug: false, cell: false, power: false, burn: false, run: false, done: false, ev: [] };
    return s;
}
const near = (s, k, reach = REACH) => { const [x, y] = mid(at(k)); return hypot(x - s.player.x, y - s.player.y) < reach * S; };
const faced = (s) => [0.9, 0.4].map(d => [Math.floor((s.player.x + cos(s.player.aim) * S * d) / S), Math.floor((s.player.y + sin(s.player.aim) * S * d) / S)]);
const faces = (s, t) => faced(s).some(([x, y]) => tileAt(s.map, x, y) === t);
const hasKey = (s) => s.inv.keys.includes('manifest');
const caged = (s) => tileAt(s.map, ...at('C')) === enumTile.doorLocked;
const atCage = (s) => caged(s) && faced(s).some(([x, y]) => x === at('C')[0] && y === at('C')[1]);
export function objective(s) {
    const st = s.story;
    if (!st)
        return '';
    return st.done ? 'Section clear' : !st.armed ? 'Find something to defend yourself with' : st.power ? 'Go through the bulkhead to the crew quarters: end of the corridor, past the ready room' : st.cell ? 'Fit the power cell to the generator'
        : !caged(s) ? 'Take a power cell from the caged store' : hasKey(s) ? 'Unlock the caged store at the far end of the cargo bay' : st.office ? 'Fetch the cage key from locker three in the ready room'
            : st.caged ? 'Find the key to the caged store: try the loadmaster\'s office' : st.read ? 'Fetch a power cell from the caged store in the cargo bay' : st.tried ? 'Restore emergency power' : 'Find a way off this deck';
}
export function storyPrompt(s) {
    const st = s.story;
    if (!st || st.done || !s.player.alive || s.player.hidden)
        return '';
    return near(s, 'P') && !st.cell ? 'Take the power cell' : near(s, 'G') && !st.power ? (st.cell ? 'Fit the power cell' : 'Check the generator') : near(s, 'T') || near(s, 'N') ? 'Read the terminal'
        : near(s, 'R') ? 'Read the duty board' : near(s, 'V', VIEW_REACH) ? 'Look out' : atCage(s) && hasKey(s) ? 'Unlock the cage' : doorSign(s);
}
function doorSign(s) {
    const p = s.player, m = s.map, door = faced(s).find(([x, y]) => tileAt(m, x, y) === enumTile.door || tileAt(m, x, y) === enumTile.doorLocked);
    if (!door)
        return '';
    let room = '', far = -1;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const [x, y] = mid([door[0] + dx, door[1] + dy]), d = hypot(x - p.x, y - p.y), r = roomAt(x, y);
        if (r && d > far) {
            far = d;
            room = r;
        }
    }
    return room && `${tileAt(m, ...door) === enumTile.door ? 'Open' : 'Locked'}: ${room}`;
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
function openDoor(s, x, y) {
    const m = s.map;
    for (const [gx, gy] of doorGroup(m, x, y))
        setTile(m, gx, gy, enumTile.doorOpen);
    s.segs = visionSegments(m);
    s.ai.regions = null;
    emit(s.ai, (x + 0.5) * S, (y + 0.5) * S, 'sound', T.stim.src.doorOpen[0], T.stim.src.doorOpen[1], s.tick);
}
function powerUp(s) {
    const st = s.story, m = s.map, [gx, gy] = mid(at('G')), [ux, uy] = at('U');
    st.power = true;
    st.ev.push(['power']);
    s.msg = 'emergency power restored';
    const L = s.light;
    if (L.on && !L.dead) {
        L.dead = true;
        L.diedAt = s.tick;
        L.intensity = 0;
        L.mash = 0;
        L.blinks = 0;
    }
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
    s.ambush = s.ambush.filter(a => a.x !== ux || a.y !== uy);
    s.ambush.push({ x: ux, y: uy, kind: 'vent', type: 'crawler' });
}
export function stepStory(s, inp) {
    const st = s.story, p = s.player, use = inp.interact && s.tick - p.lastAction > 6 && p.alive && !p.hidden;
    if (!st.power)
        s.light.diedAt = s.tick;
    step(s, inp);
    st.ev = [];
    if (st.done || !p.alive)
        return;
    if (s.inv.weapons.some(Boolean))
        st.armed = true;
    const note = use ? Object.keys(NOTES).find(k => near(s, k)) : undefined;
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
        else if (note) {
            const [flag, title, text] = NOTES[note];
            st[flag] = true;
            st.ev.push(['note', title, text]);
        }
        else if (near(s, 'V', VIEW_REACH))
            st.ev.push(['view', ...VIEW]);
        else if (atCage(s)) {
            st.caged = true;
            if (hasKey(s)) {
                openDoor(s, ...at('C'));
                s.msg = 'the cage unlocks';
            }
            else
                s.msg = 'locked: spare cells inside, and the loadmaster keeps the key';
        }
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
    const [bx, by] = mid(at('B'));
    if (!st.nest && hypot(bx - p.x, by - p.y) < NEST_AT * S) {
        st.nest = true;
        for (const m of AT.M)
            spawnAlien(s.ai, 'mite', ...mid(m));
    }
    const [yx, yy] = at('Y'), [px, py] = mid([yx, yy]);
    if (!st.plug && hypot(px - p.x, py - p.y) < PLUG_AT * S) {
        st.plug = true;
        if (tileAt(s.map, yx, yy) === enumTile.creep && !s.fires.length)
            s.msg = 'growth chokes the service way: fire would clear it';
    }
    if (st.power && !st.run && !s.ambush.some(a => a.x === at('U')[0] && a.y === at('U')[1])) {
        st.run = true;
        st.ev.push(['whisper', RUN]);
    }
    if (AT.X.some(([x, y]) => Math.floor(p.x / S) === x && Math.floor(p.y / S) === y)) {
        st.done = true;
        s.escaped = true;
        st.ev.push(['done']);
        s.msg = '';
    }
}
