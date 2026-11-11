import { T } from "./tuning.js";
import { tileAt, enumTile, DIAG, diagSolid } from "./tilemap.js";
import { forSeats } from "./sim.js";
import { atan2, cos, hypot, sin } from "./dmath.js";
export const createGore = (seed) => ({ decals: [], walk: 0, wet: 0, fluid: 'blood', side: 1, px: 0, py: 0, seed });
const rnd = (s) => (s.gore.seed = (Math.imul(s.gore.seed, 1664525) + 1013904223) >>> 0) / 4294967296;
const S = T.TILE, G = T.gore;
export const FLUIDS = ['blood', 'ichor', 'goo'];
const fling = (s, x, y, ang, spread, n, f) => {
    for (let i = 0; i < n; i++) {
        const a = ang + (rnd(s) - 0.5) * spread, sp = 50 + rnd(s) * 120;
        s.fx.push({ kind: 'drop', x, y, vx: cos(a) * sp, vy: sin(a) * sp, t: rnd(s) * 0.05, c: FLUIDS.indexOf(f), rot: a, n: 0.45 + rnd(s) * 0.45 });
    }
};
export const fluidOf = (type) => type === 'crew' || type === 'possessed' ? 'blood' : 'ichor';
export function wallAt(s, x, y) {
    const tx = Math.floor(x / S), ty = Math.floor(y / S), t = tileAt(s.map, tx, ty);
    return DIAG.has(t) ? diagSolid(t, x / S - tx, y / S - ty) : t === enumTile.wall || t === enumTile.crack || t === enumTile.void;
}
export function decal(s, x, y, k, rot, sc, a = 1, f, onWall = false) {
    if (!onWall && wallAt(s, x, y))
        return;
    const d = s.gore.decals;
    d.push({ x, y, k, rot, sc, a, f });
    if (d.length > G.cap * 1.1)
        d.splice(0, d.length - G.cap);
}
const v = (s, n) => Math.floor(rnd(s) * n);
export function bleed(s, x, y, ang, dmg, f, r) {
    const amt = Math.max(1, Math.min(4, dmg / G.perDmg)) * Math.max(1, r / 7) * G.amount, c = cos(ang), sn = sin(ang);
    fling(s, x + c * r * 0.5, y + sn * r * 0.5, ang, 1.3, Math.round(G.flying[0] + G.flying[1] * amt), f);
    const d0 = r * 0.5 + rnd(s) * 4;
    decal(s, x + c * d0, y + sn * d0, `fx/splat-${f}.${v(s, 3)}`, ang + (rnd(s) - 0.5) * 0.4, Math.min(1.6, 0.35 + 0.12 * amt), 0.95, f);
    for (let i = 0, n = 2 + Math.round(amt * 2); i < n; i++) {
        const a = ang + (rnd(s) - 0.5) * 1.1, d = r + rnd(s) * (8 + 6 * amt), far = d > r + 6;
        decal(s, x + cos(a) * d, y + sin(a) * d, `fx/drop-${f}.${far ? 2 : v(s, 4)}`, a, 0.6 + rnd(s) * 0.5, 0.95);
    }
    if (rnd(s) < G.wallChance)
        for (let d = r; d < r + G.wallReach; d += 1.5)
            if (wallAt(s, x + c * d, y + sn * d)) {
                decal(s, x + c * (d + 2), y + sn * (d + 2), `fx/wallsplat-${f}.${v(s, 2)}`, (rnd(s) - 0.5) * 0.3, Math.min(1.3, 0.45 + 0.1 * amt), 0.9, undefined, true);
                break;
            }
}
export function deathGore(s, a, ang, dmg, blast) {
    const f = fluidOf(a.type), r = T.ai.types[a.type].r;
    fling(s, a.x, a.y, ang, Math.PI * 2, Math.round(G.burst * G.amount), f);
    for (let i = 0, n = Math.round(6 * G.amount); i < n; i++) {
        const q = rnd(s) * Math.PI * 2, d = r * 0.6 + rnd(s) * r;
        decal(s, a.x + cos(q) * d, a.y + sin(q) * d, `fx/drop-${f}.${v(s, 4)}`, q, 0.7 + rnd(s) * 0.5, 0.95);
    }
    if (!(blast || dmg >= G.gibDmg || G.gibTypes.includes(a.type)))
        return;
    for (let i = 0, n = Math.round((G.gibs[0] + v(s, G.gibs[1] - G.gibs[0] + 1)) * G.amount); i < n; i++) {
        const q = blast ? rnd(s) * Math.PI * 2 : ang + (rnd(s) - 0.5) * 2.2;
        let d = r * 0.5;
        for (const end = r + 4 + rnd(s) * 14; d < end && !wallAt(s, a.x + cos(q) * (d + 2), a.y + sin(q) * (d + 2)); d += 2)
            ;
        decal(s, a.x + cos(q) * d / 2, a.y + sin(q) * d / 2, `fx/smear-${f}.${v(s, 2)}`, q, Math.max(0.5, Math.min(1.0, d / 16)), 0.85, f);
        decal(s, a.x + cos(q) * d, a.y + sin(q) * d, `fx/gib-${f}.${v(s, 4)}`, rnd(s) * 6.28, (0.9 + rnd(s) * 0.5) * Math.max(1, r / 9), 1);
    }
}
export function impact(s, x, y, ang) {
    decal(s, x, y, `fx/bullethole.${v(s, 3)}`, rnd(s) * 6.28, 0.8 + rnd(s) * 0.3, 0.95, undefined, true);
    s.fx.push({ kind: 'hit', x: x - cos(ang) * 2, y: y - sin(ang) * 2, t: 0 });
    for (let i = 0; i < 3; i++) {
        const q = ang + Math.PI + (rnd(s) - 0.5) * 1.6, sp = 30 + rnd(s) * 50;
        s.fx.push({ kind: 'chip', x: x - cos(ang) * 2, y: y - sin(ang) * 2, vx: cos(q) * sp, vy: sin(q) * sp, t: 0, rot: rnd(s) * 6, c: v(s, 2) });
    }
}
export function explosion(s, x, y, r) {
    decal(s, x, y, 'fx/scorch', rnd(s) * 6.28, Math.max(0.6, r / 22), 0.9);
    for (let i = 0; i < 10; i++) {
        const q = rnd(s) * Math.PI * 2, d = r * (0.3 + rnd(s) * 0.7);
        decal(s, x + cos(q) * d, y + sin(q) * d, `fx/chip.${v(s, 2)}`, rnd(s) * 6.28, 0.8 + rnd(s) * 0.6, 0.9);
    }
    s.fx.push({ kind: 'ring', x, y, t: 0, n: r });
    for (let i = 0; i < 7; i++) {
        const q = rnd(s) * Math.PI * 2, sp = 4 + rnd(s) * 10;
        s.fx.push({ kind: 'smoke', x: x + cos(q) * r * 0.3, y: y + sin(q) * r * 0.3, vx: cos(q) * sp, vy: sin(q) * sp - 3, t: 0, n: 3 + rnd(s) * 3, rot: rnd(s) * 6 });
    }
}
export function stepGore(s) {
    const g = s.gore;
    if (s.tick % 6 === 0) {
        for (const a of s.ai.aliens) {
            if (a.inVent)
                continue;
            const hp = a.hp / T.ai.types[a.type].hp;
            if (hp >= G.trailBelow) {
                a.bleedX = a.x;
                a.bleedY = a.y;
                continue;
            }
            const d = hypot(a.x - (a.bleedX ?? a.x), a.y - (a.bleedY ?? a.y));
            if (d < G.trailStep)
                continue;
            const q = atan2(a.y - a.bleedY, a.x - a.bleedX), f = fluidOf(a.type);
            if (hp < G.smearBelow && rnd(s) < 0.5)
                decal(s, a.x - cos(q) * 4, a.y - sin(q) * 4, `fx/smear-${f}.${v(s, 2)}`, q + Math.PI, 0.6, 0.7, f);
            else
                decal(s, a.x + (rnd(s) - 0.5) * 4, a.y + (rnd(s) - 0.5) * 4, `fx/drop-${f}.${v(s, 4)}`, q, 0.6 + rnd(s) * 0.4, 0.9);
            a.bleedX = a.x;
            a.bleedY = a.y;
        }
        forSeats(s, p => {
            if (p.alive && p.health < G.playerTrailBelow && hypot(p.x - g.px, p.y - g.py) >= G.trailStep * (0.6 + p.health / G.playerTrailBelow)) {
                decal(s, p.x + (rnd(s) - 0.5) * 4, p.y + (rnd(s) - 0.5) * 4, `fx/drop-blood.${v(s, 4)}`, rnd(s) * 6.28, 0.6 + rnd(s) * 0.4, 0.9);
                g.px = p.x;
                g.py = p.y;
            }
        });
    }
    forSeats(s, p => footprints(s, p));
}
function footprints(s, p) {
    const g = s.gore, moved = hypot(p.x - p.px, p.y - p.py);
    if (!moved || p.vault)
        return;
    if (s.tick % 4 === 0) {
        const wet = wetAt(s, p.x, p.y);
        if (wet) {
            g.wet = G.footPrints;
            g.fluid = wet;
        }
    }
    g.walk += moved;
    if (g.walk < G.footStep || g.wet <= 0)
        return;
    g.walk = 0;
    g.wet--;
    g.side = -g.side;
    const q = atan2(p.y - p.py, p.x - p.px);
    decal(s, p.x + cos(q + Math.PI / 2) * 2.2 * g.side, p.y + sin(q + Math.PI / 2) * 2.2 * g.side, `fx/foot-${g.fluid}`, q, 0.75, 0.25 + 0.7 * g.wet / G.footPrints);
}
function wetAt(s, x, y) {
    if (tileAt(s.map, Math.floor(x / S), Math.floor(y / S)) === enumTile.creep)
        return 'goo';
    for (const c of s.ai.corpses)
        if ((c.type === 'crew' || c.meat > 0) && hypot(c.x - x, c.y - y) < 7)
            return fluidOf(c.type);
    const d = s.gore.decals;
    for (let i = d.length - 1, n = 0; i >= 0 && n < 250; i--, n++)
        if (d[i].f && hypot(d[i].x - x, d[i].y - y) < 5 * d[i].sc + 1)
            return d[i].f;
    return null;
}
