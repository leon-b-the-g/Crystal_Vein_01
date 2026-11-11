import { T } from "./tuning.js";
import { stream } from "./rng.js";
import { enumTile as E } from "./tilemap.js";
import { bevel } from "./worldgen.js";
import { hypot } from "./dmath.js";
const W = 100, H = 76;
export function generateDock(seed) {
    const r = stream(seed, 'dock'), tiles = new Uint8Array(W * H).fill(E.void), variant = new Uint8Array(W * H), lights = [], S = T.TILE;
    const set = (x, y, t) => { tiles[y * W + x] = t; }, at = (x, y) => tiles[y * W + x];
    const rect = (x, y, w, h, t) => { for (let yy = y; yy < y + h; yy++)
        for (let xx = x; xx < x + w; xx++)
            set(xx, yy, t); };
    const rooms = [], room = (x, y, w, h, kind) => { const rm = { id: rooms.length, x, y, w, h, kind, doors: 0, cx: x + (w >> 1), cy: y + (h >> 1) }; rooms.push(rm); rect(x, y, w, h, E.floor); return rm; };
    const lamp = (x, y, rr, c = [0.95, 0.62, 0.3]) => lights.push({ x: (x + 0.5) * S, y: (y + 0.5) * S, r: rr * S, color: c });
    const arrival = room(2, 34, 8, 8, 'cabin');
    rect(10, 37, 4, 2, E.floor);
    set(9, 37, E.door);
    set(9, 38, E.door);
    arrival.doors = 1;
    set(3, 37, E.elevator);
    lamp(5, 37, 4);
    const bay = room(14, 10, 72, 56, 'signature');
    for (const [i, top] of [[0, true], [1, true], [2, true], [0, false], [1, false], [2, false]]) {
        const x = 20 + i * 22 + r.int(4), y = top ? 2 : 68, rm = room(x, y, 10, 6, 'cabin'), dx = x + 2 + r.int(6), dy = top ? y + 5 : y;
        set(dx, dy, E.door);
        rect(dx, top ? dy + 1 : dy - 2, 1, 2, E.floor);
        rm.doors = 1;
        for (let k = 0; k < 3; k++) {
            const fx = x + r.int(10), fy = top ? y + r.int(2) : y + 4 + r.int(2);
            if (at(fx, fy) === E.floor && Math.abs(fx - dx) > 1)
                set(fx, fy, r.next() < 0.5 ? E.locker : E.crate);
        }
        if (r.next() < 0.5)
            lamp(rm.cx, rm.cy, 3.5);
    }
    const px = 46, py = 34;
    rect(px, py, 9, 9, E.wall);
    const pad = room(px + 1, py + 1, 7, 7, 'closet');
    pad.doors = 1;
    const door = [[px, py + 3], [px, py + 4]];
    for (const [x, y] of door)
        set(x, y, E.door);
    const pod = [px + 4, py + 4], con = [px + 2, py + 1];
    set(...pod, E.pod);
    set(...con, E.console);
    lamp(px + 4, py + 4, 4.5, [0.4, 0.8, 1]);
    const loop = [[28, 20], [72, 20], [72, 56], [28, 56]], patrol = loop.flatMap(([x, y]) => [(x + 0.5) * S, (y + 0.5) * S]);
    const onLoop = (k, f) => { const a = loop[k], b = loop[(k + 1) % 4]; return [Math.round(a[0] + (b[0] - a[0]) * f), Math.round(a[1] + (b[1] - a[1]) * f)]; };
    const fuel = [onLoop(0, 0.3 + r.next() * 0.2), onLoop(1, 0.5 + r.next() * 0.2), onLoop(2, 0.3 + r.next() * 0.2), onLoop(3, 0.6 + r.next() * 0.2)];
    for (const [fx, fy] of fuel)
        for (let y = fy - 2; y <= fy + 2; y++)
            for (let x = fx - 2; x <= fx + 2; x++)
                if (hypot(x - fx, y - fy) <= 1.8 + r.next() * 0.6 && at(x, y) === E.floor)
                    set(x, y, E.fuel);
    const drops = [];
    for (const [k, f] of [[0, 0.75], [1, 0.2], [2, 0.75], [3, 0.2]]) {
        const [zx, zy] = onLoop(k, f + (r.next() - 0.5) * 0.1);
        const cx = k === 1 ? 84 : k === 3 ? 15 : zx, cy = k === 0 ? 11 : k === 2 ? 64 : zy;
        set(cx, cy, E.console);
        drops.push({ cx, cy, zx, zy, used: false, t: 0 });
    }
    const busy = (x, y) => at(x, y) !== E.floor || (x >= px - 3 && x <= px + 11 && y >= py - 3 && y <= py + 11) || drops.some(d => Math.abs(x - d.zx) <= 2 && Math.abs(y - d.zy) <= 2)
        || loop.some((a, i) => { const b = loop[(i + 1) % 4]; return a[0] === b[0] ? Math.abs(x - a[0]) <= 2 && y >= Math.min(a[1], b[1]) - 2 && y <= Math.max(a[1], b[1]) + 2 : Math.abs(y - a[1]) <= 2 && x >= Math.min(a[0], b[0]) - 2 && x <= Math.max(a[0], b[0]) + 2; })
        || (y >= 35 && y <= 40 && x <= 22);
    for (let n = 0, tries = 0; n < 14 && tries < 400; tries++) {
        const horiz = r.next() < 0.5, len = 4 + r.int(5), x = 16 + r.int(66), y = 12 + r.int(52), cells = [];
        for (let i = 0; i < len; i++)
            cells.push(horiz ? [x + i, y] : [x, y + i]);
        if (cells.some(([cx, cy]) => busy(cx, cy) || busy(cx + 1, cy) || busy(cx, cy + 1) || busy(cx - 1, cy) || busy(cx, cy - 1)))
            continue;
        for (const [cx, cy] of cells)
            set(cx, cy, E.table);
        n++;
    }
    for (let n = 0, tries = 0; n < 16 && tries < 400; tries++) {
        const w = 2 + r.int(2), h = 2 + r.int(2), x = 16 + r.int(66), y = 12 + r.int(52);
        let ok = true;
        for (let yy = y - 1; yy <= y + h && ok; yy++)
            for (let xx = x - 1; xx <= x + w; xx++)
                if (busy(xx, yy)) {
                    ok = false;
                    break;
                }
        if (!ok)
            continue;
        rect(x, y, w, h, E.crate);
        if (r.next() < 0.3)
            set(x + w, y, E.barrel);
        n++;
    }
    for (let i = 0; i < 6; i++) {
        const x = 18 + r.int(64), y = 14 + r.int(48);
        if (!busy(x, y))
            set(x, y, E.vent);
    }
    for (const [x, y] of [[30, 30], [70, 30], [30, 48], [70, 48], [50, 16], [50, 60]])
        lamp(x, y, 5, [0.9, 0.55, 0.35]);
    for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
            if (at(x, y) !== E.void)
                continue;
            let near = false;
            for (let dy = -1; dy <= 1 && !near; dy++)
                for (let dx = -1; dx <= 1; dx++) {
                    const xx = x + dx, yy = y + dy;
                    if (xx >= 0 && yy >= 0 && xx < W && yy < H && at(xx, yy) !== E.void && at(xx, yy) !== E.wall) {
                        near = true;
                        break;
                    }
                }
            if (near)
                set(x, y, E.wall);
        }
    bevel(tiles, W, H, r, rooms, (x, y) => (x <= 13 && y >= 33 && y <= 42) || (x >= px - 1 && x <= px + 9 && y >= py - 1 && y <= py + 9), { corner: 1, corridor: 0.8, oct: 0 });
    const vr = stream(seed, 'tilevariant');
    for (let i = 0; i < variant.length; i++)
        variant[i] = vr.next() < 0.6 ? 0 : vr.int(4);
    const dock = { pod, console: con, door, drops, patrol };
    return { w: W, h: H, tiles, variant, lights, spawn: [(arrival.cx + 0.5) * S, (arrival.cy + 0.5) * S], rooms, edges: [], elevator: [3, 37], spawnRoom: arrival.id, elevatorRoom: arrival.id,
        theme: 'landing', floor: 11, seed, lootRoom: -1, secret: null, dock };
}
