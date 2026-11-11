import { T } from "./tuning.js";
import { stream } from "./rng.js";
import { hypot } from "./dmath.js";
export const enumTile = { floor: 0, wall: 1, crate: 2, barrel: 3, door: 4, console: 5, creep: 6, table: 7, locker: 8, vent: 9, doorOpen: 10, doorLocked: 11, elevator: 12, breach: 13, void: 14, fire: 15, crack: 16, fuel: 17, pod: 18, podOpen: 19, diagNW: 20, diagNE: 21, diagSW: 22, diagSE: 23 };
export const SOLID = new Set([1, 2, 3, 4, 5, 7, 8, 11, 13, 14, 16, 18, 20, 21, 22, 23]);
export const DIAG = new Set([20, 21, 22, 23]);
export const diagSolid = (t, u, v) => t === 20 ? u + v < 1 : t === 21 ? u > v : t === 22 ? u < v : u + v > 1;
export const diagLine = (t) => {
    const k = Math.SQRT1_2;
    return t === 20 ? [0, 1, 1, 0, k, k] : t === 23 ? [0, 1, 1, 0, -k, -k] : t === 21 ? [0, 0, 1, 1, -k, k] : [0, 0, 1, 1, k, -k];
};
export const LOW = new Set([2, 3, 5, 7]);
export const OPAQUE = new Set([1, 4, 8, 11, 13, 14, 16]);
const CHARS = { '.': 0, '#': 1, 'c': 2, 'b': 3, 'D': 4, 'o': 5, '~': 6, 't': 7, 'l': 8, 'v': 9, 'L': 11, '*': 0, '@': 0 };
export function parseAscii(rows, seed = 1) {
    const w = rows[0].length, h = rows.length, tiles = new Uint8Array(w * h), variant = new Uint8Array(w * h), r = stream(seed, 'tilevariant');
    const lights = [];
    let spawn = [1.5 * T.TILE, 1.5 * T.TILE];
    for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
            const ch = rows[y][x] ?? '#';
            if (!(ch in CHARS))
                throw new Error(`bad tile '${ch}' at ${x},${y}`);
            tiles[y * w + x] = CHARS[ch];
            variant[y * w + x] = r.next() < 0.6 ? 0 : r.int(4);
            if (ch === '*')
                lights.push({ x: (x + 0.5) * T.TILE, y: (y + 0.5) * T.TILE, r: 4 * T.TILE, color: [0.95, 0.62, 0.3] });
            if (ch === '@')
                spawn = [(x + 0.5) * T.TILE, (y + 0.5) * T.TILE];
        }
    return { w, h, tiles, variant, lights, spawn };
}
export const tileAt = (m, x, y) => (x < 0 || y < 0 || x >= m.w || y >= m.h) ? enumTile.wall : m.tiles[y * m.w + x];
export const solidAt = (m, x, y) => SOLID.has(tileAt(m, x, y));
export function blocksPoint(m, x, y) { const S = T.TILE, tx = Math.floor(x / S), ty = Math.floor(y / S), t = tileAt(m, tx, ty); return DIAG.has(t) ? diagSolid(t, x / S - tx, y / S - ty) : SOLID.has(t); }
export const opaqueAt = (m, x, y) => OPAQUE.has(tileAt(m, x, y));
export const setTile = (m, x, y, t) => { m.tiles[y * m.w + x] = t; };
export function moveCircle(m, x, y, dx, dy, r) {
    const S = T.TILE;
    const blocked = (px, py) => {
        const x0 = Math.floor((px - r) / S), x1 = Math.floor((px + r - 0.001) / S), y0 = Math.floor((py - r) / S), y1 = Math.floor((py + r - 0.001) / S);
        for (let ty = y0; ty <= y1; ty++)
            for (let tx = x0; tx <= x1; tx++) {
                const t = tileAt(m, tx, ty);
                if (SOLID.has(t) && !DIAG.has(t))
                    return true;
            }
        return false;
    };
    let nx = blocked(x + dx, y) ? x : x + dx, ny = blocked(nx, y + dy) ? y : y + dy;
    for (let ty = Math.floor((ny - r) / S); ty <= Math.floor((ny + r) / S); ty++)
        for (let tx = Math.floor((nx - r) / S); tx <= Math.floor((nx + r) / S); tx++) {
            const t = tileAt(m, tx, ty);
            if (!DIAG.has(t))
                continue;
            const [ax, ay, , , gx, gy] = diagLine(t);
            const qx = Math.max(tx * S, Math.min(nx, (tx + 1) * S)), qy = Math.max(ty * S, Math.min(ny, (ty + 1) * S));
            if (hypot(nx - qx, ny - qy) >= r)
                continue;
            const d = (nx - (tx + ax) * S) * gx + (ny - (ty + ay) * S) * gy;
            if (d < r) {
                const px = nx + gx * (r - d), py = ny + gy * (r - d);
                if (!blocked(px, py)) {
                    nx = px;
                    ny = py;
                }
                else {
                    nx = x;
                    ny = y;
                }
            }
        }
    return [nx, ny];
}
export function visionSegments(m, inset = 0, props = true) {
    const S = T.TILE, segs = [], op = (x, y) => opaqueAt(m, x, y) && (props || tileAt(m, x, y) !== enumTile.locker);
    const endAdj = (o, p) => (o && p) ? inset : (!o && !p) ? -inset : 0;
    for (let y = 0; y <= m.h; y++) {
        let run = -1, side = 0;
        const adj = (x, d) => endAdj(d === 1 ? op(x, y) : op(x, y - 1), d === 1 ? op(x, y - 1) : op(x, y));
        for (let x = 0; x <= m.w; x++) {
            const a = x < m.w && op(x, y), b = x < m.w && op(x, y - 1), d = a === b ? 0 : a ? 1 : -1;
            if (d !== side && run >= 0) {
                segs.push([run * S - adj(run - 1, side), y * S + side * inset, x * S + adj(x, side), y * S + side * inset]);
                run = -1;
            }
            if (d !== 0 && run < 0)
                run = x;
            side = d;
        }
    }
    for (let x = 0; x <= m.w; x++) {
        let run = -1, side = 0;
        const adj = (y, d) => endAdj(d === 1 ? op(x, y) : op(x - 1, y), d === 1 ? op(x - 1, y) : op(x, y));
        for (let y = 0; y <= m.h; y++) {
            const a = y < m.h && op(x, y), b = y < m.h && op(x - 1, y), d = a === b ? 0 : a ? 1 : -1;
            if (d !== side && run >= 0) {
                segs.push([x * S + side * inset, run * S - adj(run - 1, side), x * S + side * inset, y * S + adj(y, side)]);
                run = -1;
            }
            if (d !== 0 && run < 0)
                run = y;
            side = d;
        }
    }
    for (let y = 1; y < m.h; y++)
        for (let x = 1; x < m.w; x++) {
            const a = op(x - 1, y - 1), b = op(x, y - 1), c = op(x - 1, y), d = op(x, y);
            if (a && d && !b && !c)
                segs.push([x * S - 1, y * S - 1, x * S + 1, y * S + 1]);
            else if (b && c && !a && !d)
                segs.push([x * S + 1, y * S - 1, x * S - 1, y * S + 1]);
        }
    for (let i = 0; i < m.tiles.length; i++) {
        const t = m.tiles[i];
        if (!DIAG.has(t))
            continue;
        const tx = i % m.w, ty = Math.floor(i / m.w), [ax, ay, bx, by, gx, gy] = diagLine(t), k = -inset * 0.7;
        segs.push([(tx + ax) * S + gx * k, (ty + ay) * S + gy * k, (tx + bx) * S + gx * k, (ty + by) * S + gy * k]);
    }
    return segs;
}
export function propOccluders(m, props, vx, vy) {
    const S = T.TILE, out = [], wall = (x, y) => { const t = tileAt(m, x, y); return t === enumTile.wall || t === enumTile.void || t === enumTile.crack; };
    for (const i of props) {
        const tx = i % m.w, ty = Math.floor(i / m.w);
        if (wall(tx + 1, ty) || wall(tx - 1, ty) || wall(tx, ty + 1) || wall(tx, ty - 1))
            continue;
        const x0 = tx * S, y0 = ty * S, x1 = x0 + S, y1 = y0 + S;
        if (vx > x0 && vx < x1 && vy > y0 && vy < y1)
            continue;
        if (vy >= y0)
            out.push([x0, y0, x1, y0]);
        if (vy <= y1)
            out.push([x0, y1, x1, y1]);
        if (vx >= x0)
            out.push([x0, y0, x0, y1]);
        if (vx <= x1)
            out.push([x1, y0, x1, y1]);
    }
    return out;
}
export const M0_MAP = [
    '########################################',
    '#.....l........................l.l.l...#',
    '#..cc......b.......*...................#',
    '#..cc..........#########....o..........#',
    '#..............#.......#...............#',
    '#......~~......#...b...D.....tt........#',
    '#.....~~~~.....#.......#.......cc......#',
    '#......~~......#########.......cc......#',
    '#....................v.........b.......#',
    '#..o...................................#',
    '#...........####D####.......########...#',
    '#...........#.......#.......L......#...#',
    '#...........#..cc...#.......#.~~...#...#',
    '#...........#...*...#.......#~~~~..#...#',
    '#...........#########.......#.~~...#...#',
    '#...t.......................########...#',
    '#.@.....b..............................#',
    '#..................................v...#',
    '########################################',
];
export const isDoor = (t) => t === enumTile.door || t === enumTile.doorOpen || t === enumTile.doorLocked;
export function doorGroup(m, x, y) {
    const g = [[x, y]];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
        if (isDoor(tileAt(m, x + dx, y + dy)))
            g.push([x + dx, y + dy]);
    return g;
}
export const doorKey = (m, x, y) => Math.min(...doorGroup(m, x, y).map(([gx, gy]) => gy * m.w + gx));
