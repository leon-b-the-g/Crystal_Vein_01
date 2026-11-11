import { T } from "./tuning.js";
import { tileAt, setTile, enumTile, LOW } from "./tilemap.js";
import { emit, lineOfSight } from "./ai.js";
import { damageAlien, blast } from "./combat.js";
import { next32 } from "./rng.js";
import { forSeats } from "./sim.js";
import { atan2, cos, hypot, sin } from "./dmath.js";
const F = T.fire, S = T.TILE;
const rnd = (s) => { const [v, ns] = next32(s.rngFx); s.rngFx = ns; return v; };
export const fireAt = (s, tx, ty) => s.fires.some(f => f.i === ty * s.map.w + tx);
export const burningNear = (s, x, y) => { const tx = Math.floor(x / S), ty = Math.floor(y / S); return [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => fireAt(s, tx + dx, ty + dy)); };
export function adoptDeckFires(s) {
    const m = s.map;
    for (let i = 0; i < m.tiles.length; i++)
        if (m.tiles[i] === enumTile.fire) {
            m.tiles[i] = enumTile.floor;
            s.fires.push({ i, t: 1e9, kind: 'deck' });
        }
    m.lights = m.lights.filter(l => !l.fire);
}
export function ignite(s, tx, ty, force = false) {
    const m = s.map, t = tileAt(m, tx, ty), i = ty * m.w + tx;
    if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h || s.fires.some(f => f.i === i))
        return false;
    const body = s.ai.corpses.find(c => !c.burn && Math.floor(c.x / S) === tx && Math.floor(c.y / S) === ty);
    if (body) {
        body.burn = F.life.corpse;
        body.spores = 0;
    }
    const kind = t === enumTile.barrel ? 'barrel' : t === enumTile.fuel ? 'fuel' : t === enumTile.creep ? 'goo' : body ? 'corpse' : force && !LOW.has(t) && (t === enumTile.floor || t === enumTile.vent || t === enumTile.doorOpen) ? 'floor' : null;
    if (!kind)
        return false;
    s.fires.push({ i, t: kind === 'barrel' ? F.barrel.fuse : kind === 'fuel' ? T.dock.fuelLife : F.life[kind], kind });
    if (kind === 'barrel')
        emit(s.ai, (tx + 0.5) * S, (ty + 0.5) * S, 'sound', 20, 120, s.tick);
    return true;
}
const flammable = (s, tx, ty) => { const t = tileAt(s.map, tx, ty); return t === enumTile.creep || t === enumTile.barrel || t === enumTile.fuel || s.ai.corpses.some(c => !c.burn && Math.floor(c.x / S) === tx && Math.floor(c.y / S) === ty); };
export function stepFire(s, dt) {
    for (const g of s.ground)
        if (g.kind === 'flare')
            ignite(s, Math.floor(g.x / S), Math.floor(g.y / S));
    s.fireT += dt;
    if (s.fireT < F.tick)
        return;
    const k = s.fireT;
    s.fireT = 0;
    const m = s.map, lit = new Set(s.fires.map(f => f.i));
    s.ai.hot = Object.fromEntries(s.fires.map(f => [f.i, 1]));
    forSeats(s, p => { if (lit.has(Math.floor(p.y / S) * m.w + Math.floor(p.x / S)) && p.alive && !s.god && !p.vault) {
        const d = F.playerDps * k;
        p.health -= d;
        s.stats.damageTaken += d;
        p.hurtT = 0.3;
        if (p.health <= 0) {
            p.health = 0;
            p.alive = false;
            p.cause = 'burned alive';
        }
    } });
    for (const a of [...s.ai.aliens])
        if (!a.inVent && lit.has(Math.floor(a.y / S) * m.w + Math.floor(a.x / S)))
            damageAlien(s, a, F.alienDps * k, 'fire', a.x, a.y, 0);
    for (const f of [...s.fires]) {
        const tx = f.i % m.w, ty = Math.floor(f.i / m.w);
        if (f.kind !== 'barrel')
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
                if (flammable(s, tx + dx, ty + dy) && (tileAt(m, tx + dx, ty + dy) === enumTile.fuel || rnd(s) < F.spread * k / F.tick))
                    ignite(s, tx + dx, ty + dy);
        f.t -= k;
        if (f.t > 0)
            continue;
        s.fires.splice(s.fires.indexOf(f), 1);
        if (f.kind === 'fuel')
            setTile(m, tx, ty, enumTile.floor);
        if (f.kind === 'goo') {
            setTile(m, tx, ty, enumTile.floor);
            s.ai.goo = null;
            s.debris.push({ x: (tx + 0.5) * S, y: (ty + 0.5) * S, v: 0, k: 'fx/scorch' });
        }
        if (f.kind === 'barrel') {
            setTile(m, tx, ty, enumTile.floor);
            s.ai.regions = null;
            s.debris.push({ x: (tx + 0.5) * S, y: (ty + 0.5) * S, v: 0, k: 'fx/scorch' });
            const B = F.barrel, x = (tx + 0.5) * S, y = (ty + 0.5) * S;
            blast(s, x, y, B.r, B.dmg, B.loud, 'a fuel barrel');
            for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]])
                ignite(s, tx + dx, ty + dy, true);
        }
    }
}
export function spray(s) {
    const p = s.player, E = F.extinguisher, m = s.map, half = E.cone / 2 * Math.PI / 180;
    let n = 0;
    for (const f of [...s.fires]) {
        const x = (f.i % m.w + 0.5) * S, y = (Math.floor(f.i / m.w) + 0.5) * S, d = hypot(x - p.x, y - p.y);
        let da = atan2(y - p.y, x - p.x) - p.aim;
        da = atan2(sin(da), cos(da));
        if (d < S * 0.8 || (d < E.range && Math.abs(da) < half && lineOfSight(m, p.x, p.y, x, y))) {
            s.fires.splice(s.fires.indexOf(f), 1);
            n++;
            const c = s.ai.corpses.find(c => c.burn && hypot(c.x - x, c.y - y) < S);
            if (c)
                c.burn = 0;
        }
    }
    emit(s.ai, p.x, p.y, 'sound', E.loud[0], E.loud[1], s.tick);
    s.fx.push({ kind: 'spray', x: p.x, y: p.y, rot: p.aim, t: 0 });
    return n;
}
