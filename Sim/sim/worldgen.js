import { T } from "./tuning.js";
import { stream } from "./rng.js";
import { astar } from "./astar.js";
import { enumTile, SOLID, DIAG } from "./tilemap.js";
import { THEMES, MOOD, FLOOR, PROPS } from "./themes.js";
import { hypot } from "./dmath.js";
const E = enumTile, VOID = E.void;
const DIAG_CORRIDOR = 0.95, DIAG_RUN = [2, 8];
const CLUTTER = 0.03;
const LOOT_ROOM_CHANCE = 0.6, SECRET_CHANCE = 0.4;
const DOUBLE_DOOR_CHANCE = 0.8;
const ROOM_VENT_CHANCE = 0.5;
const lerp = (a, b, t) => a + (b - a) * t;
const pickW = (r, items) => { let s = 0; for (const [, w] of items)
    s += w; let v = r.next() * s; for (const [t, w] of items) {
    v -= w;
    if (v <= 0)
        return t;
} return items[items.length - 1][0]; };
export function generateDeck(seed, floor = 1, theme = 'crew') {
    for (let attempt = 0; attempt < 30; attempt++) {
        const d = tryGenerate(seed, floor, theme, attempt);
        if (d)
            return d;
    }
    throw new Error(`worldgen: no valid deck for seed ${seed} floor ${floor}`);
}
function tryGenerate(seed, floor, theme, attempt) {
    const r = stream(seed + attempt * 7919, `worldgen${floor}`), t = (floor - 1) / 9;
    const w = Math.round(lerp(80, 120, t)), h = Math.round(lerp(60, 90, t)), roomTarget = Math.round(lerp(14, 28, t));
    const tiles = new Uint8Array(w * h).fill(VOID), variant = new Uint8Array(w * h), at = (x, y) => tiles[y * w + x], set = (x, y, v) => { tiles[y * w + x] = v; };
    const lights = [];
    const rooms = [];
    const sizes = [['closet', 3, 4, 2], ['cabin', 5, 8, 5], ['hall', 8, 13, 3]];
    const overlaps = (x, y, rw, rh) => rooms.some(o => x < o.x + o.w + 3 && x + rw + 3 > o.x && y < o.y + o.h + 3 && y + rh + 3 > o.y);
    const tryPlace = (kind, lo, hi) => {
        for (let i = 0; i < 60; i++) {
            const rw = lo + r.int(hi - lo + 1), rh = lo + r.int(hi - lo + 1), x = 2 + r.int(w - rw - 4), y = 2 + r.int(h - rh - 4);
            if (!overlaps(x, y, rw, rh)) {
                rooms.push({ id: rooms.length, x, y, w: rw, h: rh, kind, doors: 0, cx: x + (rw >> 1), cy: y + (rh >> 1) });
                return true;
            }
        }
        return false;
    };
    tryPlace('signature', 12, 16);
    while (rooms.length < roomTarget) {
        const s = pickW(r, sizes.map(s => [sizes.indexOf(s), s[3]]));
        if (!tryPlace(sizes[s][0], sizes[s][1], sizes[s][2]))
            break;
    }
    if (rooms.length < Math.max(6, roomTarget * 0.6))
        return null;
    for (const rm of rooms)
        for (let y = rm.y; y < rm.y + rm.h; y++)
            for (let x = rm.x; x < rm.x + rm.w; x++)
                set(x, y, E.floor);
    const roomAt = new Int16Array(w * h).fill(-1);
    for (const rm of rooms)
        for (let y = rm.y; y < rm.y + rm.h; y++)
            for (let x = rm.x; x < rm.x + rm.w; x++)
                roomAt[y * w + x] = rm.id;
    const dist = (a, b) => hypot(a.cx - b.cx, a.cy - b.cy);
    const inTree = new Set([0]), edges = [];
    while (inTree.size < rooms.length) {
        let best = [-1, -1, Infinity];
        for (const a of inTree)
            for (const b of rooms)
                if (!inTree.has(b.id)) {
                    const dd = dist(rooms[a], b);
                    if (dd < best[2])
                        best = [a, b.id, dd];
                }
        inTree.add(best[1]);
        edges.push([best[0], best[1]]);
    }
    const extra = Math.round(rooms.length * 0.25);
    const cand = [];
    for (const a of rooms)
        for (const b of rooms)
            if (a.id < b.id && !edges.some(([p, q]) => (p === a.id && q === b.id) || (p === b.id && q === a.id)))
                cand.push([a.id, b.id, dist(a, b)]);
    cand.sort((p, q) => p[2] - q[2]);
    for (let i = 0; i < extra && i < cand.length; i++)
        edges.push([cand[i][0], cand[i][1]]);
    const corridor = new Uint8Array(w * h);
    const doorPoint = (a, b) => {
        const dx = b.cx - a.cx, dy = b.cy - a.cy;
        if (Math.abs(dx) > Math.abs(dy)) {
            const x = dx > 0 ? a.x + a.w - 1 : a.x, y = a.y + 1 + r.int(Math.max(1, a.h - 2));
            return [x, y, x + Math.sign(dx), y];
        }
        const y = dy > 0 ? a.y + a.h - 1 : a.y, x = a.x + 1 + r.int(Math.max(1, a.w - 2));
        return [x, y, x, y + Math.sign(dy)];
    };
    const nearRoom = new Uint8Array(w * h);
    for (let y = 1; y < h - 1; y++)
        for (let x = 1; x < w - 1; x++)
            if (roomAt[y * w + x] < 0 && (roomAt[y * w + x - 1] >= 0 || roomAt[y * w + x + 1] >= 0 || roomAt[(y - 1) * w + x] >= 0 || roomAt[(y + 1) * w + x] >= 0))
                nearRoom[y * w + x] = 1;
    const doorTiles = [], band = new Uint8Array(w * h);
    const angled = (path) => {
        const pts = [];
        for (let i = 0; i < path.length; i += 2)
            pts.push([path[i], path[i + 1]]);
        const dir = (i) => [pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]], same = (a, b) => a[0] === b[0] && a[1] === b[1];
        const free = (x, y) => x > 1 && y > 1 && x < w - 2 && y < h - 2 && roomAt[y * w + x] < 0 && !nearRoom[y * w + x];
        const skip = new Set(), extra = [];
        for (let s = 2; s < pts.length - 4;) {
            const d1 = dir(s);
            let d2 = null, e = s, n1 = 0, n2 = 0;
            while (e < pts.length - 3) {
                const d = dir(e);
                if (same(d, d1))
                    n1++;
                else if (!d2 && d[0] !== -d1[0] && d[1] !== -d1[1]) {
                    d2 = d;
                    n2++;
                }
                else if (d2 && same(d, d2))
                    n2++;
                else
                    break;
                e++;
            }
            if (!d2 || Math.min(n1, n2) < DIAG_RUN[0] || r.next() >= DIAG_CORRIDOR) {
                s++;
                continue;
            }
            const run = (u, v, nu, nv, k) => {
                const D = [u[0] + v[0], u[1] + v[1]], A = [pts[s][0] + u[0] * (nu - k), pts[s][1] + u[1] * (nu - k)];
                const g = (x, y) => D[1] * x - D[0] * y, g0 = g(A[0], A[1]), side = g(A[0] - u[0], A[1] - u[1]) - g0;
                const t = [], bt = [];
                for (let q = 1; q < nu - k; q++)
                    t.push((pts[s][1] + u[1] * q) * w + pts[s][0] + u[0] * q);
                for (let q = 1; q < nv - k; q++)
                    t.push((A[1] + D[1] * k + v[1] * q) * w + A[0] + D[0] * k + v[0] * q);
                for (let y = Math.min(A[1], A[1] + D[1] * k) - 3; y <= Math.max(A[1], A[1] + D[1] * k) + 3; y++)
                    for (let x = Math.min(A[0], A[0] + D[0] * k) - 3; x <= Math.max(A[0], A[0] + D[0] * k) + 3; x++) {
                        const j = (g(x, y) - g0) * side, p = ((x - A[0]) * D[0] + (y - A[1]) * D[1]) / 2;
                        if (j >= -1 && j <= 2 && p >= 0 && p <= k)
                            bt.push(y * w + x);
                    }
                return [...t, ...bt].every(i => free(i % w, Math.floor(i / w))) ? { t, bt } : null;
            };
            let got = null;
            for (let k = Math.min(n1, n2, DIAG_RUN[1]); k >= DIAG_RUN[0] && !got; k--)
                got = run(d1, d2, n1, n2, k) ?? run(d2, d1, n2, n1, k);
            if (!got) {
                s++;
                continue;
            }
            for (const i of got.t)
                extra.push(i);
            for (const i of got.bt) {
                extra.push(i);
                band[i] = 1;
            }
            for (let q = s + 1; q < e; q++)
                skip.add(q);
            s = e;
        }
        return [...pts.filter((_, q) => !skip.has(q)).map(([x, y]) => y * w + x), ...extra];
    };
    const doubles = [];
    const tryDouble = (ox, oy, ix, iy, room) => {
        if (r.next() >= DOUBLE_DOOR_CHANCE)
            return;
        const outX = ox - ix, outY = oy - iy, sides = outX ? [[0, 1], [0, -1]] : [[1, 0], [-1, 0]];
        if (r.next() < 0.5)
            sides.reverse();
        for (const [sx, sy] of sides) {
            const px = ox + sx, py = oy + sy, qx = px + outX, qy = py + outY;
            if (px < 2 || py < 2 || px >= w - 2 || py >= h - 2 || qx < 1 || qy < 1 || qx >= w - 1 || qy >= h - 1)
                continue;
            if (roomAt[py * w + px] >= 0 || roomAt[(py - outY) * w + px - outX] !== room || roomAt[qy * w + qx] >= 0 || nearRoom[qy * w + qx] || at(px, py) !== VOID)
                continue;
            set(px, py, E.floor);
            set(qx, qy, E.floor);
            corridor[py * w + px] = 1;
            corridor[qy * w + qx] = 1;
            doorTiles.push([px, py]);
            doubles.push({ o: [ox, oy], oo: [ox + outX, oy + outY], p: [px, py], q: [qx, qy], room });
            return;
        }
    };
    for (const [ai, bi] of edges) {
        const a = rooms[ai], b = rooms[bi], [adx, ady, aox, aoy] = doorPoint(a, b), [bdx, bdy, box, boy] = doorPoint(b, a);
        if (aox < 1 || aoy < 1 || aox >= w - 1 || aoy >= h - 1 || box < 1 || boy < 1 || box >= w - 1 || boy >= h - 1)
            continue;
        const isEnd = (x, y) => (x === aox && y === aoy) || (x === box && y === boy);
        const path = astar(w, h, (x, y) => (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) ? Infinity : roomAt[y * w + x] >= 0 ? Infinity : (nearRoom[y * w + x] && !isEnd(x, y)) ? Infinity : corridor[y * w + x] ? 1 : 2.5, aox, aoy, box, boy);
        if (!path)
            continue;
        for (const i of angled(path)) {
            corridor[i] = 1;
            set(i % w, Math.floor(i / w), E.floor);
        }
        doorTiles.push([aox, aoy], [box, boy]);
        a.doors++;
        b.doors++;
        tryDouble(aox, aoy, adx, ady, a.id);
        tryDouble(box, boy, bdx, bdy, b.id);
    }
    for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++)
            if (at(x, y) === VOID) {
                let near = false;
                for (let dy = -1; dy <= 1 && !near; dy++)
                    for (let dx = -1; dx <= 1; dx++) {
                        const nx = x + dx, ny = y + dy;
                        if (nx >= 0 && ny >= 0 && nx < w && ny < h && at(nx, ny) === E.floor) {
                            near = true;
                            break;
                        }
                    }
                if (near)
                    set(x, y, E.wall);
            }
    for (const [x, y] of doorTiles)
        if (at(x, y) === E.floor)
            set(x, y, r.next() < 0.1 ? E.doorOpen : E.door);
    for (const d of doubles)
        if (at(d.p[0], d.p[1]) === E.door || at(d.p[0], d.p[1]) === E.doorOpen)
            set(d.p[0], d.p[1], at(d.o[0], d.o[1]));
    const adj = rooms.map(() => []);
    for (const [a, b] of edges) {
        adj[a].push(b);
        adj[b].push(a);
    }
    const bfs = (start) => { const d = new Array(rooms.length).fill(-1); d[start] = 0; const q = [start]; while (q.length) {
        const c = q.shift();
        for (const n of adj[c])
            if (d[n] < 0) {
                d[n] = d[c] + 1;
                q.push(n);
            }
    } return d; };
    const edgeRooms = rooms.filter(rm => rm.kind !== 'signature').sort((p, q) => Math.min(p.x, p.y, w - p.x - p.w, h - p.y - p.h) - Math.min(q.x, q.y, w - q.x - q.w, h - q.y - q.h));
    const spawnRoom = edgeRooms[0].id, dS = bfs(spawnRoom);
    if (dS.some(v => v < 0))
        return null;
    let elevatorRoom = -1, bestD = -1;
    for (const rm of rooms)
        if (rm.id !== spawnRoom && rm.doors >= 2 && (dS[rm.id] > bestD || (dS[rm.id] === bestD && rm.w * rm.h > rooms[elevatorRoom].w * rooms[elevatorRoom].h))) {
            bestD = dS[rm.id];
            elevatorRoom = rm.id;
        }
    if (elevatorRoom < 0)
        elevatorRoom = rooms.map(rm => rm.id).filter(id => id !== spawnRoom).sort((a, b) => dS[b] - dS[a])[0];
    const er = rooms[elevatorRoom], elevator = [er.cx, er.cy];
    set(er.cx, er.cy, E.elevator);
    const sr = rooms[spawnRoom], spawn = [(sr.cx + 0.5) * T.TILE, (sr.cy + 0.5) * T.TILE];
    const safe = (id) => id !== spawnRoom && id !== elevatorRoom;
    const breachCount = floor >= 3 ? 1 + r.int(2) : r.int(2);
    const breached = new Set();
    const connectedWithout = (skip) => { const seen = new Set([spawnRoom]), q = [spawnRoom]; while (q.length) {
        const c = q.shift();
        for (const n of adj[c])
            if (!seen.has(n) && !skip.has(n)) {
                seen.add(n);
                q.push(n);
            }
    } return seen.size + skip.size === rooms.length; };
    for (let i = 0; i < breachCount; i++) {
        const cands = rooms.filter(rm => safe(rm.id) && !breached.has(rm.id) && rm.doors >= 2 && rm.kind !== 'signature' && connectedWithout(new Set([...breached, rm.id])));
        if (!cands.length)
            break;
        const rm = r.pick(cands);
        breached.add(rm.id);
        for (let y = rm.y; y < rm.y + rm.h; y++)
            for (let x = rm.x; x < rm.x + rm.w; x++)
                set(x, y, E.breach);
    }
    const openT = (x, y) => { const t = at(x, y); return t === E.floor || t === E.door || t === E.doorOpen || t === E.creep || t === E.vent; };
    const keep = new Uint8Array(w * h);
    for (const d of doubles)
        if (!breached.has(d.room))
            for (const [x, y] of [d.o, d.oo, d.p, d.q])
                keep[y * w + x] = 1;
    for (let i = 0; i < band.length; i++)
        if (band[i])
            keep[i] = 1;
    for (let changed = true; changed;) {
        changed = false;
        for (let y = 1; y < h - 1; y++)
            for (let x = 1; x < w - 1; x++) {
                if (roomAt[y * w + x] >= 0 || !openT(x, y) || keep[y * w + x])
                    continue;
                const e = openT(x + 1, y), wv = openT(x - 1, y), sv = openT(x, y + 1), nv = openT(x, y - 1), n = +e + +wv + +sv + +nv;
                const fat = n === 2 && !(e && wv) && !(sv && nv) && openT(x + (e ? 1 : -1), y + (sv ? 1 : -1));
                if (n <= 1 || fat) {
                    set(x, y, E.wall);
                    corridor[y * w + x] = 0;
                    changed = true;
                }
            }
    }
    const doorAt = (x, y) => { const t = at(x, y); return t === E.door || t === E.doorOpen; };
    for (const rm of rooms)
        rm.doors = 0;
    for (let i = doorTiles.length - 1; i >= 0; i--) {
        const [x, y] = doorTiles[i], t = at(x, y);
        if (t !== E.door && t !== E.doorOpen) {
            doorTiles.splice(i, 1);
            continue;
        }
        if (doorAt(x - 1, y) || doorAt(x, y - 1))
            continue;
        for (const rm of rooms)
            if (x >= rm.x - 1 && x <= rm.x + rm.w && y >= rm.y - 1 && y <= rm.y + rm.h)
                rm.doors++;
    }
    const TH = THEMES[theme];
    for (let i = 0; i < TH.creep; i++) {
        const rm = r.pick(rooms.filter(rm => safe(rm.id) && at(rm.cx, rm.cy) === E.floor));
        if (!rm)
            break;
        let cx = rm.x + r.int(rm.w), cy = rm.y + r.int(rm.h);
        for (let k = 0; k < 8 + r.int(14); k++) {
            if (at(cx, cy) === E.floor)
                set(cx, cy, E.creep);
            const [dx, dy] = r.pick([[1, 0], [-1, 0], [0, 1], [0, -1]]);
            const nx = cx + dx, ny = cy + dy;
            if (at(nx, ny) === E.floor || at(nx, ny) === E.creep) {
                cx = nx;
                cy = ny;
            }
        }
    }
    for (let i = 0, tries = 0; i < 2 + r.int(3) && tries < 200; tries++) {
        const x = r.int(w), y = r.int(h);
        if (corridor[y * w + x] && at(x, y) === E.floor) {
            set(x, y, E.vent);
            i++;
        }
    }
    for (const rm of rooms) {
        if (rm.id === spawnRoom || breached.has(rm.id) || rm.w < 3 || rm.h < 3 || r.next() >= ROOM_VENT_CHANCE)
            continue;
        for (let k = 0; k < 10; k++) {
            const x = rm.x + 1 + r.int(rm.w - 2), y = rm.y + 1 + r.int(rm.h - 2);
            if (at(x, y) === E.floor) {
                set(x, y, E.vent);
                break;
            }
        }
    }
    for (let i = 0, tries = 0; i < 1 + r.int(3) && tries < 200; tries++) {
        const rm = r.pick(rooms);
        const x = rm.x + r.int(rm.w), y = rm.y + r.int(rm.h);
        if (at(x, y) === E.floor && !(rm.id === spawnRoom)) {
            set(x, y, E.fire);
            lights.push({ x: (x + 0.5) * T.TILE, y: (y + 0.5) * T.TILE, r: 3.5 * T.TILE, color: [1, 0.55, 0.2], fire: true });
            i++;
        }
    }
    bevel(tiles, w, h, r, rooms, (x, y) => (Math.abs(x - Math.floor(spawn[0] / T.TILE)) <= 1 && Math.abs(y - Math.floor(spawn[1] / T.TILE)) <= 1) || Math.abs(x - elevator[0]) + Math.abs(y - elevator[1]) <= 1);
    const props = PROPS[FLOOR[theme]] ?? [], blocks = props.filter(p => p[3] === 'block'), litter = props.filter(p => p[3] === 'floor'), decor = [];
    const dr = stream(seed + attempt * 7919, `decor${floor}`), sx0 = Math.floor(spawn[0] / T.TILE), sy0 = Math.floor(spawn[1] / T.TILE);
    const wallAt = (x, y) => { const t = at(x, y); return t === E.wall || t === VOID || DIAG.has(t); };
    const doorNear = (x, y) => { for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
            const t = at(x + dx, y + dy);
            if (t === E.door || t === E.doorOpen || t === E.doorLocked || t === E.elevator)
                return true;
        } return false; };
    const blockProp = (x, y, rm) => {
        if (!blocks.length)
            return false;
        const [id, pw, ph] = dr.pick(blocks), backs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
        const k = backs.findIndex(([dx, dy]) => wallAt(x + dx, y + dy));
        if (k < 0)
            return false;
        const fw = k % 2 ? ph : pw, fh = k % 2 ? pw : ph, [bx, by] = backs[k];
        for (let o = 0; o < Math.max(fw, fh); o++) {
            const x0 = bx ? (bx > 0 ? x - fw + 1 : x) : x - o, y0 = by ? (by > 0 ? y - fh + 1 : y) : y - o;
            let ok = true;
            for (let yy = y0; yy < y0 + fh && ok; yy++)
                for (let xx = x0; xx < x0 + fw && ok; xx++)
                    ok = xx >= rm.x && yy >= rm.y && xx < rm.x + rm.w && yy < rm.y + rm.h && at(xx, yy) === E.floor && !doorNear(xx, yy) && !(xx === sx0 && yy === sy0)
                        && (!(bx ? xx === (bx > 0 ? x0 + fw - 1 : x0) : yy === (by > 0 ? y0 + fh - 1 : y0)) || wallAt(xx + bx, yy + by));
            if (!ok)
                continue;
            for (let yy = y0; yy < y0 + fh; yy++)
                for (let xx = x0; xx < x0 + fw; xx++)
                    set(xx, yy, E.table);
            decor.push({ id, x: x0, y: y0, w: fw, h: fh, a: k * Math.PI / 2 });
            return true;
        }
        return false;
    };
    for (const rm of rooms) {
        if (at(rm.cx, rm.cy) === E.breach)
            continue;
        if (r.next() < TH.lamps) {
            const j = ((rm.cx * 7 + rm.cy * 13) % 9) / 9 - 0.5, c = MOOD[theme].lamp;
            lights.push({ x: (rm.cx + 0.5) * T.TILE, y: (rm.cy + 0.5) * T.TILE, r: Math.max(2.5, Math.min(rm.w, rm.h) * 0.9) * T.TILE, color: [c[0] * (1 + 0.08 * j), c[1], c[2] * (1 - 0.08 * j)] });
        }
        if (rm.w < 4 || rm.h < 4)
            continue;
        for (let y = rm.y; y < rm.y + rm.h; y++)
            for (let x = rm.x; x < rm.x + rm.w; x++) {
                const ring = x === rm.x || y === rm.y || x === rm.x + rm.w - 1 || y === rm.y + rm.h - 1;
                if (!ring || at(x, y) !== E.floor || r.next() > TH.density)
                    continue;
                let nearDoor = false;
                for (let dy = -1; dy <= 1; dy++)
                    for (let dx = -1; dx <= 1; dx++) {
                        const tt = at(x + dx, y + dy);
                        if (tt === E.door || tt === E.doorOpen || tt === E.doorLocked || tt === E.elevator)
                            nearDoor = true;
                    }
                if (nearDoor)
                    continue;
                const pick = pickW(r, TH.props);
                if (pick !== E.table || !blockProp(x, y, rm))
                    set(x, y, pick);
            }
    }
    if (floor >= 3) {
        const cands = doorTiles.filter(([x, y]) => at(x, y) === E.door && rooms.find(rm => x >= rm.x && x < rm.x + rm.w && y >= rm.y && y < rm.y + rm.h && rm.doors >= 2));
        if (cands.length) {
            const [x, y] = r.pick(cands);
            set(x, y, E.doorLocked);
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
                if (doorAt(x + dx, y + dy))
                    set(x + dx, y + dy, E.doorLocked);
        }
    }
    let lootRoom = -1;
    if (floor >= 2 && r.next() < LOOT_ROOM_CHANCE) {
        const cands = rooms.filter(rm => rm.doors === 1 && rm.id !== spawnRoom && rm.id !== elevatorRoom && !breached.has(rm.id) && at(rm.cx, rm.cy) !== E.breach);
        if (cands.length) {
            const rm = r.pick(cands), ds = doorTiles.filter(([x, y]) => at(x, y) === E.door && x >= rm.x - 1 && x <= rm.x + rm.w && y >= rm.y - 1 && y <= rm.y + rm.h);
            if (ds.length) {
                for (const [x, y] of ds) {
                    set(x, y, E.doorLocked);
                    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
                        if (doorAt(x + dx, y + dy))
                            set(x + dx, y + dy, E.doorLocked);
                }
                lootRoom = rm.id;
            }
        }
    }
    let secret = null;
    const pocket = (rm, rr) => {
        const [dx, dy] = [[1, 0], [-1, 0], [0, 1], [0, -1]][rr.int(4)];
        const ex = dx === 1 ? rm.x + rm.w - 1 : dx === -1 ? rm.x : rm.x + 1 + rr.int(Math.max(1, rm.w - 2)), ey = dy === 1 ? rm.y + rm.h - 1 : dy === -1 ? rm.y : rm.y + 1 + rr.int(Math.max(1, rm.h - 2));
        const wx = ex + dx, wy = ey + dy;
        if (at(ex, ey) !== E.floor || at(wx, wy) !== E.wall)
            return null;
        if ([-1, 0, 1].some(oy => [-1, 0, 1].some(ox => DIAG.has(at(wx + ox, wy + oy)))))
            return null;
        const cx = wx + dx * 2, cy = wy + dy * 2;
        for (let y = cy - 2; y <= cy + 2; y++)
            for (let x = cx - 2; x <= cx + 2; x++) {
                if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1)
                    return null;
                const t = at(x, y), inner = Math.abs(x - cx) <= 1 && Math.abs(y - cy) <= 1;
                if (inner ? t !== VOID : t !== VOID && t !== E.wall)
                    return null;
            }
        for (let y = cy - 2; y <= cy + 2; y++)
            for (let x = cx - 2; x <= cx + 2; x++)
                set(x, y, Math.abs(x - cx) <= 1 && Math.abs(y - cy) <= 1 ? E.floor : at(x, y) === VOID ? E.wall : at(x, y));
        return [cx, cy, wx, wy];
    };
    if (r.next() < SECRET_CHANCE)
        for (let tries = 0; tries < 80 && !secret; tries++) {
            const rm = r.pick(rooms);
            if (rm.id === spawnRoom || breached.has(rm.id) || at(rm.cx, rm.cy) === E.breach)
                continue;
            const pk = pocket(rm, r);
            if (!pk)
                continue;
            const [cx, cy, wx, wy] = pk;
            const kind = r.next() < 0.6 ? 'crack' : 'door';
            set(wx, wy, kind === 'crack' ? E.crack : E.doorLocked);
            secret = { x: cx, y: cy, ex: wx, ey: wy, kind };
        }
    let vault = null;
    const vr0 = stream(seed, `vault${floor}`), near = [elevatorRoom, ...adj[elevatorRoom]].map(id => rooms[id]).filter(rm => rm.id !== spawnRoom && rm.id !== lootRoom && !breached.has(rm.id) && at(rm.cx, rm.cy) !== E.breach);
    for (let tries = 0; tries < 120 && !vault && near.length; tries++) {
        const pk = pocket(tries < 60 ? near[0] : vr0.pick(near), vr0);
        if (pk) {
            set(pk[2], pk[3], E.doorLocked);
            vault = { x: pk[0], y: pk[1], ex: pk[2], ey: pk[3] };
        }
    }
    const steam = [], used = new Set(), SC = T.steam.rooms[theme] ?? T.steam.other;
    for (const rm of rooms) {
        if (rm.id === spawnRoom || at(rm.cx, rm.cy) === E.breach || rm.w < 3 || rm.h < 3 || dr.next() >= SC)
            continue;
        for (let k = 0; k < 12; k++) {
            const x = rm.x + 1 + dr.int(rm.w - 2), y = rm.y + 1 + dr.int(rm.h - 2);
            if (at(x, y) !== E.floor || doorNear(x, y))
                continue;
            steam.push(y * w + x);
            used.add(y * w + x);
            break;
        }
    }
    if (litter.length) {
        for (const rm of rooms) {
            if (at(rm.cx, rm.cy) === E.breach)
                continue;
            const n = Math.floor(rm.w * rm.h * CLUTTER + dr.next());
            const left = [...litter];
            for (let i = 0, tries = 0; i < n && tries < 20; tries++) {
                if (!left.length)
                    left.push(...litter);
                const [id, pw, ph] = left[dr.int(left.length)], k = dr.int(4), fw = k % 2 ? ph : pw, fh = k % 2 ? pw : ph, x0 = rm.x + dr.int(rm.w - fw + 1), y0 = rm.y + dr.int(rm.h - fh + 1);
                let ok = true;
                for (let yy = y0; yy < y0 + fh && ok; yy++)
                    for (let xx = x0; xx < x0 + fw && ok; xx++)
                        ok = (at(xx, yy) === E.floor || at(xx, yy) === E.creep) && !used.has(yy * w + xx);
                if (!ok)
                    continue;
                for (let yy = y0; yy < y0 + fh; yy++)
                    for (let xx = x0; xx < x0 + fw; xx++)
                        used.add(yy * w + xx);
                decor.push({ id, x: x0, y: y0, w: fw, h: fh, a: pw === ph ? dr.next() * Math.PI * 2 : k * Math.PI / 2 });
                left.splice(left.findIndex(p => p[0] === id), 1);
                i++;
            }
        }
    }
    const vr = stream(seed, 'tilevariant');
    for (let i = 0; i < variant.length; i++)
        variant[i] = vr.next() < 0.6 ? 0 : vr.int(4);
    const deck = { w, h, tiles, variant, lights, spawn, decor, steam, rooms, edges, elevator, spawnRoom, elevatorRoom, theme, floor, seed, lootRoom, secret, vault };
    return validate(deck) ? deck : null;
}
export function validate(d) {
    const { w, h, tiles } = d, pass = new Uint8Array(w * h), q = [];
    const ok = (x, y) => { const t = tiles[y * w + x]; return t === E.door || !SOLID.has(t); };
    const sx = Math.floor(d.spawn[0] / T.TILE), sy = Math.floor(d.spawn[1] / T.TILE);
    if (!ok(sx, sy))
        return false;
    pass[sy * w + sx] = 1;
    q.push(sx, sy);
    while (q.length) {
        const y = q.pop(), x = q.pop();
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h || pass[ny * w + nx] || !ok(nx, ny))
                continue;
            pass[ny * w + nx] = 1;
            q.push(nx, ny);
        }
    }
    if (!pass[d.elevator[1] * w + d.elevator[0]])
        return false;
    for (let y = 1; y < h - 1; y++)
        for (let x = 1; x < w - 1; x++) {
            const t = tiles[y * w + x];
            if (t !== E.door && t !== E.doorOpen && t !== E.doorLocked)
                continue;
            const o = (xx, yy) => { const tt = tiles[yy * w + xx]; return !SOLID.has(tt) && tt !== E.doorOpen && tt !== E.breach && tt !== E.void; };
            if (!((o(x, y - 1) && o(x, y + 1)) || (o(x - 1, y) && o(x + 1, y))))
                return false;
        }
    for (const rm of d.rooms) {
        if (tiles[rm.cy * w + rm.cx] === E.breach || rm.id === d.lootRoom)
            continue;
        let any = false;
        for (let y = rm.y; y < rm.y + rm.h && !any; y++)
            for (let x = rm.x; x < rm.x + rm.w; x++)
                if (pass[y * w + x]) {
                    any = true;
                    break;
                }
        if (!any)
            return false;
    }
    return true;
}
export function ascii(d) {
    const ch = ' #cbDo~tlv_L^XV*KfPp/\\\\/';
    const rows = [];
    for (let y = 0; y < d.h; y++) {
        let row = '';
        for (let x = 0; x < d.w; x++) {
            const i = y * d.w + x;
            row += (Math.floor(d.spawn[0] / 16) === x && Math.floor(d.spawn[1] / 16) === y) ? '@' : ch[d.tiles[i]] ?? '?';
        }
        rows.push(row);
    }
    return rows.join('\n');
}
export function bevel(tiles, w, h, r, rooms, keep, o = { corner: 0.9, corridor: 1, oct: 0.08 }) {
    const at = (x, y) => x < 0 || y < 0 || x >= w || y >= h ? E.void : tiles[y * w + x], set = (x, y, t) => { tiles[y * w + x] = t; };
    const wallish = (x, y) => { const t = at(x, y); return t === E.wall || t === E.void; };
    const isDoor = (x, y) => { const t = at(x, y); return t === E.door || t === E.doorOpen || t === E.doorLocked; };
    const nearDoor = (x, y) => { for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++)
            if (isDoor(x + dx, y + dy))
                return true; return false; };
    const roomOf = (x, y) => rooms.find(rm => x >= rm.x && x < rm.x + rm.w && y >= rm.y && y < rm.y + rm.h);
    const pick = (n, e, s, wv) => n && wv ? E.diagNW : n && e ? E.diagNE : s && wv ? E.diagSW : s && e ? E.diagSE : -1;
    for (const rm of rooms) {
        if (rm.w < 7 || rm.h < 7 || r.next() >= o.oct)
            continue;
        const corners = [[rm.x, rm.y, 1, 1, E.diagNW], [rm.x + rm.w - 1, rm.y, -1, 1, E.diagNE], [rm.x, rm.y + rm.h - 1, 1, -1, E.diagSW], [rm.x + rm.w - 1, rm.y + rm.h - 1, -1, -1, E.diagSE]];
        for (const [cx, cy, sx, sy, d] of corners) {
            const cells = [[cx, cy], [cx + sx, cy], [cx, cy + sy]];
            if (cells.some(([x, y]) => at(x, y) !== E.floor || nearDoor(x, y) || keep(x, y)))
                continue;
            set(cx, cy, E.wall);
            set(cx + sx, cy, d);
            set(cx, cy + sy, d);
        }
    }
    for (let y = 1; y < h - 1; y++)
        for (let x = 1; x < w - 1; x++) {
            if (at(x, y) !== E.floor || nearDoor(x, y) || keep(x, y))
                continue;
            const n = wallish(x, y - 1), e = wallish(x + 1, y), s = wallish(x, y + 1), wv = wallish(x - 1, y);
            if (+n + +e + +s + +wv !== 2)
                continue;
            const t = pick(n, e, s, wv);
            if (t < 0)
                continue;
            const ox = t === E.diagNW || t === E.diagSW ? 1 : -1, oy = t === E.diagNW || t === E.diagNE ? 1 : -1;
            if (SOLID.has(at(x + ox, y)) || SOLID.has(at(x, y + oy)) || SOLID.has(at(x + ox, y + oy)))
                continue;
            if (r.next() < (roomOf(x, y) ? o.corner : o.corridor))
                set(x, y, t);
        }
}
