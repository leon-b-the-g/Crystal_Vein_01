import { T } from "./tuning.js";
import { tileAt, enumTile } from "./tilemap.js";
import { ITEMS } from "./items.js";
import { nearestItem } from "./combat.js";
import { decodeInput, INPUT_BYTES } from "./input.js";
import { cos, sin, hypot } from "./dmath.js";
import { objective, storyPrompt, roomAt, ROOMS, THINGS } from "./story.js";
const S = T.TILE, r1 = (v) => Math.round(v * 10) / 10, r2 = (v) => Math.round(v * 100) / 100;
export function levelData(s) {
    const m = s.map;
    return { t: 'level', w: m.w, h: m.h, tile: S, hp: T.player.maxHealth, stamina: T.player.stamina.max, tiles: Array.from(m.tiles),
        lamps: m.lights.map(l => [l.x, l.y, l.r, roomAt(l.x, l.y) === ROOMS[0][0] ? 1 : 0]), rooms: ROOMS, things: THINGS };
}
function prompt(s) {
    const p = s.player;
    if (!p.alive || s.escaped)
        return '';
    if (p.hidden)
        return 'Get out';
    const story = storyPrompt(s);
    if (story)
        return story;
    const tile = (d) => [Math.floor((p.x + cos(p.aim) * S * d) / S), Math.floor((p.y + sin(p.aim) * S * d) / S)], far = tile(0.9);
    for (const [x, y] of [far, tile(0.4)]) {
        const t = tileAt(s.map, x, y);
        if (t === enumTile.door)
            return 'Open';
        if (t === enumTile.doorOpen)
            return 'Close';
        if (t === enumTile.doorLocked)
            return 'Locked';
    }
    if (s.containers.some(c => !c.opened && (c.body ? hypot((c.x + 0.5) * S - p.x, (c.y + 0.5) * S - p.y) < S * 1.2 : c.x === far[0] && c.y === far[1])))
        return 'Search';
    if (tileAt(s.map, far[0], far[1]) === enumTile.locker)
        return 'Hide';
    const i = nearestItem(s);
    return i >= 0 ? `Pick up the ${ITEMS[s.items[i].it.id].name}` : '';
}
export function snapshot(s, seen) {
    const p = s.player, m = s.map, st = s.story, w = s.inv.weapons[s.inv.active], td = [];
    for (let i = 0; i < m.tiles.length; i++)
        if (m.tiles[i] !== seen[i]) {
            td.push(i, m.tiles[i]);
            seen[i] = m.tiles[i];
        }
    return { t: 'snap', tick: s.tick,
        p: [r1(p.x), r1(p.y), r2(p.aim), Math.ceil(p.health), Math.round(p.stamina), (p.alive ? 1 : 0) | (p.sprinting ? 2 : 0) | (p.crouching ? 4 : 0) | (p.hidden ? 8 : 0) | (p.moving ? 16 : 0) | (p.swingT > 0 ? 32 : 0) | (p.hurtT > 0 ? 64 : 0) | (st?.cell && !st.power ? 128 : 0)],
        l: [s.light.on ? 1 : 0, r2(s.light.intensity), s.light.dead ? 1 : 0],
        a: s.ai.aliens.filter(a => !a.inVent).map(a => [a.id, a.type, r1(a.x), r1(a.y), r2(a.facing), Math.ceil(a.hp), (a.emergeT > 0 ? 1 : 0) | (a.moving ? 2 : 0) | (a.behave === 'chase' ? 4 : 0) | (a.hitT > 0 ? 8 : 0), T.ai.types[a.type].r]),
        c: s.ai.corpses.map(c => [c.type, r1(c.x), r1(c.y), c.burn ? 1 : 0]),
        it: s.items.map(i => [r1(i.x), r1(i.y), ITEMS[i.it.id].name]),
        loot: s.containers.filter(c => !c.opened).map(c => c.y * m.w + c.x),
        fires: s.fires.map(f => f.i), td,
        th: s.thrown.map(t => { const k = t.t / t.dur; return [t.kind === 'flare' ? 0 : t.kind === 'noise' ? 1 : 2, r1(t.x0 + (t.x1 - t.x0) * k), r1(t.y0 + (t.y1 - t.y0) * k)]; }),
        gr: s.ground.map(g => [g.kind === 'flare' ? 0 : 1, r1(g.x), r1(g.y), r1(g.t)]),
        ch: p.channel ? r2(p.channel.t / p.channel.dur) : -1,
        msg: s.msg, obj: objective(s), prompt: prompt(s), room: roomAt(p.x, p.y), power: st?.power ? 1 : 0, cause: p.cause,
        w: w ? ITEMS[w.id].name : '', q: s.inv.quick.map(i => i ? ITEMS[i.id].name + (i.n > 1 ? ` x${i.n}` : '') : ''), ev: st?.ev ?? [] };
}
export function inputOf(x, y, aimX, aimY, bits, quick = -1) {
    const b = new Uint8Array(INPUT_BYTES), v = new DataView(b.buffer);
    v.setInt8(0, x);
    v.setInt8(1, y);
    v.setInt16(2, aimX, true);
    v.setInt16(4, aimY, true);
    v.setUint16(6, (bits & 1023) | ((quick >= 0 && quick < 4 ? quick + 1 : 0) << 10), true);
    return decodeInput(b);
}
