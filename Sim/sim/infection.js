import { T } from "./tuning.js";
import { tileAt, enumTile, SOLID } from "./tilemap.js";
import { spawnAlien, emit, gooOf } from "./ai.js";
import { ITEMS } from "./items.js";
import { stream, next32 } from "./rng.js";
import { burningNear } from "./fire.js";
import { decal } from "./gore.js";
import { forSeats } from "./sim.js";
import { atan2, cos, hypot, sin } from "./dmath.js";
export const createInfection = () => ({ pupae: [], nests: [], clouds: [], spit: [], nextId: 1, possessedBeat: false, creep: null });
const I = T.inf, S = T.TILE;
const rnd = (s) => { const [v, ns] = next32(s.rngFx); s.rngFx = ns; return v; };
export function populateInfection(s) {
    const d = s.map, r = stream(s.seed, `infection${s.floor}`);
    const rooms = d.rooms.filter(rm => rm.id !== d.spawnRoom && tileAt(d, rm.cx, rm.cy) !== enumTile.breach);
    const n = Math.round(I.crewCorpses[0] + (I.crewCorpses[1] - I.crewCorpses[0]) * (s.floor - 1) / 9);
    for (let i = 0, tries = 0; i < n && tries < 200; tries++) {
        const rm = r.pick(rooms), x = rm.x + r.int(rm.w), y = rm.y + r.int(rm.h);
        if (SOLID.has(tileAt(d, x, y)))
            continue;
        s.ai.corpses.push({ type: 'crew', x: (x + 0.5) * S, y: (y + 0.5) * S, facing: r.next() * 6.28, t: 99, meat: 1, spores: 0 });
        i++;
    }
    const goo = gooOf(s.ai, d), nests = s.floor >= I.nestFrom[1] ? 2 : s.floor >= I.nestFrom[0] ? 1 : 0;
    for (let i = 0; i < nests && goo.length; i++) {
        const g = r.pick(goo), x = ((g % d.w) + 0.5) * S, y = (Math.floor(g / d.w) + 0.5) * S;
        if (hypot(x - d.spawn[0], y - d.spawn[1]) < 12 * S || s.inf.nests.some(n => hypot(n.x - x, n.y - y) < 6 * S))
            continue;
        s.inf.nests.push({ id: s.inf.nextId++, x, y, hp: I.nest.hp, t: I.nest.every * (0.3 + 0.7 * r.next()), burn: 0 });
    }
    const C = I.creep, cr = creepOf(s), seen = new Uint8Array(d.w * d.h), oldest = C.start[0] + C.start[1] * (s.floor - 1);
    for (const g0 of goo) {
        if (seen[g0])
            continue;
        const patch = [g0];
        seen[g0] = 1;
        for (let k = 0; k < patch.length; k++)
            for (const n of near(d, patch[k]))
                if (d.tiles[n] === enumTile.creep && !seen[n]) {
                    seen[n] = 1;
                    patch.push(n);
                }
        const base = r.next() * oldest, dist = new Map([[r.pick(patch), 0]]), q = [...dist.keys()];
        for (let k = 0; k < q.length; k++)
            for (const n of near(d, q[k]))
                if (d.tiles[n] === enumTile.creep && !dist.has(n)) {
                    dist.set(n, dist.get(q[k]) + 1);
                    q.push(n);
                }
        for (const [i, k] of dist)
            cr.age[i] = Math.max(2, Math.round(base - k * C.ring));
    }
}
export function addPupa(s, x, y, nest = 0) { s.inf.pupae.push({ id: s.inf.nextId++, x, y, hp: I.pupa.hp, age: 0, burn: 0, nest }); }
export const pupaGrowth = (p) => Math.max(0, Math.min(1, p.age / I.pupa.growth));
export const pupaPulsing = (p) => p.age >= I.pupa.growth;
export const pupaRadius = (p) => 3 + 5 * pupaGrowth(p);
function burst(s, i) {
    const pu = s.inf.pupae.splice(i, 1)[0], full = pupaPulsing(pu), b = full ? I.burst.full : I.burst.early, p = s.player;
    forSeats(s, p => {
        const d = hypot(p.x - pu.x, p.y - pu.y);
        if (d < b.r && p.alive && !s.god) {
            const dmg = Math.round(b.dmg * (1 - d / b.r));
            p.health -= dmg;
            p.hurtT = 0.3;
            s.stats.damageTaken += dmg;
            if (p.health <= 0) {
                p.health = 0;
                p.alive = false;
                p.cause = 'caught in a pupa burst';
            }
        }
    });
    const room = Math.max(0, I.popCap[0] + I.popCap[1] * s.floor - s.ai.aliens.length);
    for (let k = 0; k < Math.min(b.mites, room); k++) {
        const a = rnd(s) * 6.28, m = spawnAlien(s.ai, 'mite', pu.x + cos(a) * 4, pu.y + sin(a) * 4);
        m.alert = 50;
        m.stimX = p.x;
        m.stimY = p.y;
        m.stimT = s.tick / T.SIM_HZ;
        m.emergeT = 0.3;
        m.facing = a;
    }
    s.inf.clouds.push({ x: pu.x, y: pu.y, r: b.cloudR, density: b.density, life: I.cloud.life, age: 0 });
    emit(s.ai, pu.x, pu.y, 'sound', T.combat.burst[0], T.combat.burst[1], s.tick);
    s.fx.push({ kind: 'hit', x: pu.x, y: pu.y, t: 0 });
    s.ai.log.push(`${s.tick} pupa burst (${full ? 'full' : 'early'})`);
}
export function damagePupa(s, pu, dmg, melee = false) {
    const i = s.inf.pupae.indexOf(pu);
    if (i < 0)
        return;
    s.fx.push({ kind: 'hit', x: pu.x, y: pu.y, t: 0 }, { kind: 'dmg', x: pu.x, y: pu.y - 6, t: 0, n: Math.round(dmg) });
    if (melee) {
        burst(s, i);
        return;
    }
    pu.hp -= dmg;
    if (pu.hp <= 0)
        burst(s, i);
}
export function damageNest(s, n, dmg) {
    n.hp -= dmg;
    s.fx.push({ kind: 'hit', x: n.x, y: n.y, t: 0 }, { kind: 'dmg', x: n.x, y: n.y - 6, t: 0, n: Math.round(dmg) });
    if (n.hp <= 0) {
        s.inf.nests.splice(s.inf.nests.indexOf(n), 1);
        s.debris.push({ x: n.x, y: n.y, v: 0 });
        emit(s.ai, n.x, n.y, 'sound', 30, 160, s.tick);
        s.ai.log.push(`${s.tick} nest destroyed`);
        s.stats.kills++;
    }
}
const burning = (s, x, y) => s.ground.some(g => g.kind === 'flare' && hypot(g.x - x, g.y - y) < I.burnReach)
    || burningNear(s, x, y);
export function spitAt(s, a, ang) {
    const v = T.ai.spit.speed;
    s.inf.spit.push({ x: a.x + cos(ang) * 6, y: a.y + sin(ang) * 6, vx: cos(ang) * v, vy: sin(ang) * v, t: 0 });
    emit(s.ai, a.x, a.y, 'sound', 20, 128, s.tick, a.id);
}
export function grapple(s, a) { if (s.god || !s.player.alive)
    return; s.player.grapple = { by: a.id, t: 0, mash: 0 }; s.msg = 'GRABBED — mash SPACE'; }
export function stepInfection(s, dt) {
    layGoo(s);
    stepCreep(s, dt);
    const B = T.ai.brood;
    for (const w of [...s.ai.aliens])
        if (w.type === 'broodwarden' && !w.inVent && s.ai.aliens.length < I.popCap[0] + I.popCap[1] * s.floor) {
            const every = Math.round((w.alert >= 70 ? B.aggrEvery : B.every) * T.SIM_HZ);
            if ((s.tick + w.id * 37) % every)
                continue;
            for (let k = 0; k < B.mites; k++) {
                const a = spawnAlien(s.ai, 'mite', w.x + cos(k * 3) * 4, w.y + sin(k * 3) * 4);
                a.alert = w.alert * 0.8;
                a.emergeT = 0.6;
            }
            emit(s.ai, w.x, w.y, 'sound', 25, 160, s.tick, w.id);
            s.ai.log.push(`${s.tick} #${w.id} broodwarden hatches mites`);
        }
    const inf = s.inf;
    for (let i = s.ai.corpses.length - 1; i >= 0; i--) {
        const c = s.ai.corpses[i];
        c.t += dt;
        if (c.burn && c.burn > 0) {
            c.burn -= dt;
            if (c.burn <= 0) {
                s.ai.corpses.splice(i, 1);
                s.debris.push({ x: c.x, y: c.y, v: 0, k: 'fx/scorch' });
            }
            continue;
        }
        if (c.type !== 'crew' && c.meat <= 0 && c.t > 30) {
            s.ai.corpses.splice(i, 1);
            continue;
        }
        if (c.type === 'crew' && (c.meat < 1 || inf.clouds.some(k => hypot(k.x - c.x, k.y - c.y) < k.r)))
            c.spores += dt;
        if (c.type === 'crew' && c.spores >= I.possessDelay) {
            s.ai.corpses.splice(i, 1);
            const a = spawnAlien(s.ai, 'possessed', c.x, c.y);
            a.alert = 45;
            a.emergeT = 1.2;
            a.facing = c.facing;
            emit(s.ai, c.x, c.y, 'sound', 25, 160, s.tick, a.id);
            s.ai.log.push(`${s.tick} #${a.id} a body rises (possessed)`);
        }
    }
    while (s.ai.corpses.length > I.corpseCap) {
        const k = s.ai.corpses.findIndex(c => c.type !== 'crew');
        if (k < 0)
            break;
        s.ai.corpses.splice(k, 1);
    }
    for (let i = inf.pupae.length - 1; i >= 0; i--) {
        const pu = inf.pupae[i];
        pu.age += dt;
        if (burning(s, pu.x, pu.y)) {
            pu.burn += dt;
            pu.hp -= I.pupa.burnDps * dt;
            if (pu.hp <= 0) {
                inf.pupae.splice(i, 1);
                s.debris.push({ x: pu.x, y: pu.y, v: 1 });
                s.ai.log.push(`${s.tick} pupa burned`);
                continue;
            }
        }
        if (pupaPulsing(pu) && Math.floor(pu.age * 1.6) !== Math.floor((pu.age - dt) * 1.6))
            emit(s.ai, pu.x, pu.y, 'sound', I.pupa.beat[0], I.pupa.beat[1], s.tick, undefined, true);
        if (pu.age >= I.pupa.growth + I.pupa.pulse)
            burst(s, i);
    }
    for (const n of [...inf.nests]) {
        n.t -= dt;
        if (burning(s, n.x, n.y))
            damageNest(s, n, I.nest.burnDps * dt);
        if (n.t <= 0) {
            n.t = I.nest.every;
            if (inf.pupae.filter(q => q.nest === n.id).length < I.nest.max && s.ai.aliens.length < I.popCap[0] + I.popCap[1] * s.floor) {
                for (let k = 0; k < 8; k++) {
                    const tx = Math.floor(n.x / S) + Math.round((rnd(s) - 0.5) * 6), ty = Math.floor(n.y / S) + Math.round((rnd(s) - 0.5) * 6);
                    if (tileAt(s.map, tx, ty) === enumTile.creep && !inf.pupae.some(q => hypot(q.x - (tx + 0.5) * S, q.y - (ty + 0.5) * S) < S)) {
                        addPupa(s, (tx + 0.5) * S, (ty + 0.5) * S, n.id);
                        break;
                    }
                }
            }
        }
    }
    for (let i = inf.clouds.length - 1; i >= 0; i--) {
        const k = inf.clouds[i];
        k.age += dt;
        if (k.age >= k.life)
            inf.clouds.splice(i, 1);
    }
    forSeats(s, p => {
        let inCloud = 0;
        for (const k of inf.clouds) {
            const d = hypot(p.x - k.x, p.y - k.y);
            if (d < k.r)
                inCloud = Math.max(inCloud, cloudDensity(k) * (1 - d / k.r * 0.5));
        }
        const mask = s.inv.mask ? ITEMS[s.inv.mask.id].armor.spores ?? 1 : 1;
        if (p.alive && !s.god) {
            p.spores = inCloud > 0 && p.antiT <= 0 ? Math.min(100, p.spores + I.spores.rate * inCloud * mask * s.mods.spores * dt) : Math.max(0, p.spores - I.spores.decay * dt);
            if (p.spores > I.spores.hurt) {
                p.health -= I.spores.drain * dt;
                if (p.health <= 0) {
                    p.health = 0;
                    p.alive = false;
                    p.cause = 'consumed by spores';
                }
            }
        }
        if (!p.alive && p.spores >= I.spores.possess)
            inf.possessedBeat = true;
    });
    for (let i = inf.spit.length - 1; i >= 0; i--) {
        const g = inf.spit[i];
        g.t += dt;
        g.x += g.vx * dt;
        g.y += g.vy * dt;
        const hitWall = SOLID.has(tileAt(s.map, Math.floor(g.x / S), Math.floor(g.y / S))) && !LOWISH(s.map, g.x, g.y);
        let onYou = false;
        forSeats(s, p => {
            if (onYou || !(hypot(p.x - g.x, p.y - g.y) < T.player.radius + 3 && p.alive && !p.hidden))
                return;
            onYou = true;
            const mask = s.inv.mask ? ITEMS[s.inv.mask.id].armor.spores ?? 1 : 1;
            if (!s.god) {
                const SP = T.ai.spit, dmg = Math.max(1, SP.dmg - (s.inv.vest ? ITEMS[s.inv.vest.id].armor.reduce : 0));
                p.health -= dmg;
                s.stats.damageTaken += dmg;
                p.slow = SP.slowTime;
                p.slowAmt = SP.slow;
                p.hurtT = 0.3;
                if (p.antiT <= 0)
                    p.spores = Math.min(100, p.spores + SP.spores * mask * s.mods.spores);
                if (p.health <= 0) {
                    p.health = 0;
                    p.alive = false;
                    p.cause = 'drowned in spitter goo';
                }
            }
        });
        if (onYou || hitWall || g.t > 2.5) {
            const bx = hitWall ? g.x - g.vx * dt : g.x, by = hitWall ? g.y - g.vy * dt : g.y, C = T.ai.spit.cloud;
            inf.clouds.push({ x: bx, y: by, r: C.r, density: C.density, life: C.life, age: 0 });
            decal(s, bx, by, `fx/splat-goo.${i % 3}`, atan2(g.vy, g.vx), 0.7, 0.9, 'goo');
            inf.spit.splice(i, 1);
        }
    }
}
export function stepGrapple(s, dt, mash) {
    const p = s.player, gr = p.grapple;
    if (gr) {
        const a = s.ai.aliens.find(a => a.id === gr.by);
        gr.t += dt;
        if (mash)
            gr.mash++;
        if (!a || !p.alive)
            p.grapple = null;
        else {
            if (!s.god) {
                p.health -= T.ai.grapple.dps * dt;
                s.stats.damageTaken += T.ai.grapple.dps * dt;
                if (p.health <= 0) {
                    p.health = 0;
                    p.alive = false;
                    p.cause = 'dragged into the dark';
                }
            }
            if (gr.mash >= T.ai.grapple.mash || gr.t >= T.ai.grapple.time) {
                if (gr.mash >= T.ai.grapple.mash) {
                    a.chewT = T.ai.grapple.stun;
                    a.attackT = T.ai.grapple.stun + 1;
                    s.msg = 'you tear free';
                }
                p.grapple = null;
            }
        }
    }
}
const LOWISH = (m, x, y) => [enumTile.crate, enumTile.barrel, enumTile.table, enumTile.console].includes(tileAt(m, Math.floor(x / S), Math.floor(y / S)));
export const cloudDensity = (k) => k.density * (1 - k.age / k.life);
function layGoo(s) {
    const G = I.miteGoo, every = Math.round(G.every * T.SIM_HZ), m = s.map, goo = gooOf(s.ai, m);
    if (goo.length >= G.cap[0] + G.cap[1] * s.floor)
        return;
    for (const a of s.ai.aliens) {
        if (a.type !== 'mite' || a.inVent || (s.tick + a.id) % every)
            continue;
        const tx = Math.floor(a.x / S), ty = Math.floor(a.y / S), i = ty * m.w + tx;
        if (m.tiles[i] !== enumTile.floor || s.fires.some(f => f.i === i))
            continue;
        const [v, ns] = next32(s.rngFx);
        s.rngFx = ns;
        if (v >= G.chance)
            continue;
        m.tiles[i] = enumTile.creep;
        goo.push(i);
    }
}
const SIDES = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const near = (m, i) => SIDES.map(([dx, dy]) => [i % m.w + dx, Math.floor(i / m.w) + dy]).filter(([x, y]) => x >= 0 && y >= 0 && x < m.w && y < m.h).map(([x, y]) => y * m.w + x);
const creepOf = (s) => {
    const C = I.creep, k = (s.floor - 1) / 9;
    return s.inf.creep ?? (s.inf.creep = { age: new Uint16Array(s.map.w * s.map.h), grow: [], harden: Math.round(C.harden[0] + (C.harden[1] - C.harden[0]) * k), hard: Math.round(C.hard[0] + (C.hard[1] - C.hard[0]) * k) });
};
export const hardCreep = (s, i) => !!s.inf.creep && s.map.tiles[i] === enumTile.creep && s.inf.creep.age[i] >= s.inf.creep.hard;
function stepCreep(s, dt) {
    const C = I.creep, m = s.map, cr = creepOf(s), E = enumTile;
    for (let k = cr.grow.length - 1; k >= 0; k--) {
        const g = cr.grow[k], t = m.tiles[g.i];
        if (t === E.floor && !s.fires.some(f => f.i === g.i)) {
            g.t += dt;
            if (g.t >= C.grow) {
                m.tiles[g.i] = E.creep;
                cr.age[g.i] = 0;
                s.ai.goo = null;
            }
            continue;
        }
        if (t !== E.creep || (g.t += dt) >= C.grow + 1)
            cr.grow.splice(k, 1);
    }
    forSeats(s, p => {
        const i = Math.floor(p.y / S) * m.w + Math.floor(p.x / S);
        if (!p.alive || s.god || p.vault || m.tiles[i] !== E.creep || cr.age[i] < cr.hard)
            return;
        const d = C.dps * dt;
        p.health -= d;
        s.stats.damageTaken += d;
        p.hurtT = 0.3;
        if (p.health <= 0) {
            p.health = 0;
            p.alive = false;
            p.cause = 'eaten by hard creep';
        }
    });
    if (s.tick % T.SIM_HZ)
        return;
    for (let i = 0; i < cr.age.length; i++)
        cr.age[i] = m.tiles[i] === E.creep ? Math.min(65535, cr.age[i] + 1) : 0;
    const goo = gooOf(s.ai, m), G = I.miteGoo, chance = C.spread * (1 + C.perFloor * (s.floor - 1));
    let room = G.cap[0] + G.cap[1] * s.floor - goo.length - cr.grow.length;
    for (const g of goo)
        for (let k = 0; k < 4 && room > 0; k++) {
            const x = g % m.w + SIDES[k][0], y = Math.floor(g / m.w) + SIDES[k][1], n = y * m.w + x;
            if (tileAt(m, x, y) !== E.floor || cr.grow.some(q => q.i === n) || s.fires.some(f => f.i === n) || rnd(s) >= chance)
                continue;
            cr.grow.push({ i: n, dir: k, t: 0 });
            room--;
        }
}
