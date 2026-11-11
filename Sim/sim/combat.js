import { bleed, deathGore, impact, explosion, fluidOf, wallAt, decal, FLUIDS } from "./gore.js";
import { T } from "./tuning.js";
import { angerTrader, damageCrack, tipNear } from "./deck.js";
import { ignite, spray } from "./fire.js";
import { ITEMS, make, give, rollItem, pickItem, setLootPrefs, getSlot, setSlot } from "./items.js";
import { weaponLevelMul, dismantle, yieldOf, yieldText } from "./workbench.js";
import { tileAt, setTile, enumTile, SOLID, DIAG, diagSolid, blocksPoint, moveCircle, isDoor, doorGroup, visionSegments } from "./tilemap.js";
import { emit, spawnAlien, lineOfSight } from "./ai.js";
import { damagePupa, damageNest, pupaRadius } from "./infection.js";
import { stream, next32 } from "./rng.js";
import { forSeats } from "./sim.js";
import { atan2, cos, hypot, sin } from "./dmath.js";
const S = T.TILE, C = T.combat;
const rnd = (s) => { const [v, ns] = next32(s.rngFx); s.rngFx = ns; return v; };
export function populateLoot(s) {
    const d = s.map, r = stream(s.seed, `loot${s.floor}`), E = enumTile;
    setLootPrefs(s.inv);
    const cands = [];
    for (let y = 0; y < d.h; y++)
        for (let x = 0; x < d.w; x++) {
            const t = tileAt(d, x, y);
            if (t === E.crate || t === E.locker)
                cands.push([x, y]);
        }
    const nC = Math.min(cands.length, C.containersPerDeck[0] + C.containersPerDeck[1] * s.floor);
    for (let i = 0; i < nC; i++) {
        const k = r.int(cands.length), [x, y] = cands.splice(k, 1)[0];
        const locker = tileAt(d, x, y) === E.locker;
        const items = [];
        const n = 1 + r.int(locker ? 3 : 2);
        for (let j = 0; j < n; j++)
            items.push(rollItem(r, s.floor, d.theme, locker ? 0.4 : 0));
        if (r.next() < C.ammoChance)
            items.push(make(pickItem(r, [ITEMS['pistol-ammo'], ITEMS['rifle-ammo'], ITEMS['shells']]).id, 1, r));
        s.containers.push({ x, y, items, opened: false });
    }
    const rooms = d.rooms.filter(rm => tileAt(d, rm.cx, rm.cy) !== E.breach);
    for (let i = 0, tries = 0; i < C.floorItemsPerDeck[0] + C.floorItemsPerDeck[1] * s.floor && tries < 400; tries++) {
        const rm = r.pick(rooms), x = rm.x + r.int(rm.w), y = rm.y + r.int(rm.h);
        if (tileAt(d, x, y) !== E.floor || (rm.id === d.spawnRoom && r.next() < 0.7))
            continue;
        s.items.push({ x: (x + 0.3 + r.next() * 0.4) * S, y: (y + 0.3 + r.next() * 0.4) * S, it: rollItem(r, s.floor, d.theme) });
        i++;
    }
    const put = (id, lockerFirst) => { const pool = s.containers.filter(c => !lockerFirst || tileAt(d, c.x, c.y) === E.locker); const c = r.pick(pool.length ? pool : s.containers); if (c)
        c.items.push(make(id)); };
    if (s.floor <= 3 && !s.inv.packs.backpack && r.next() < C.backpackChance)
        put('backpack', false);
    if (s.floor >= 4 && !s.inv.packs.military && r.next() < C.militaryChance)
        put('military-backpack', true);
    if (r.next() < T.fire.extinguisherChance)
        for (let k = 0; k < 40; k++) {
            const rm = r.pick(rooms), x = rm.x + r.int(rm.w), y = rm.y + r.int(rm.h);
            if (tileAt(d, x, y) === E.floor) {
                s.items.push({ x: (x + 0.5) * S, y: (y + 0.5) * S, it: make('extinguisher') });
                break;
            }
        }
    if (s.floor === 1 || !s.inv.weapons.some(Boolean)) {
        const rs = stream(s.seed, `starter${s.floor}`), rm = d.rooms[d.spawnRoom], sx = Math.floor(d.spawn[0] / S), sy = Math.floor(d.spawn[1] / S);
        const inRoom = (x, y) => !rm || (x >= rm.x && x < rm.x + rm.w && y >= rm.y && y < rm.y + rm.h);
        let put = false;
        for (const strict of [true, false]) {
            if (put)
                break;
            for (let k = strict ? 10 : 0; k < 74; k++) {
                const x = sx + Math.round(cos(k * 2.4) * k / 10), y = sy + Math.round(sin(k * 2.4) * k / 10);
                if ((!strict || inRoom(x, y)) && tileAt(d, x, y) === E.floor) {
                    s.items.push({ x: (x + 0.5) * S, y: (y + 0.5) * S, it: make(rs.pick(C.starterWeapons), 1, rs) });
                    put = true;
                    break;
                }
            }
        }
    }
    const far = (x, y) => hypot((x + 0.5) * S - d.spawn[0], (y + 0.5) * S - d.spawn[1]) > C.ambushSafe * S;
    for (let y = 0; y < d.h; y++)
        for (let x = 0; x < d.w; x++) {
            const t = tileAt(d, x, y);
            if (!far(x, y))
                continue;
            const ch = t === E.crate ? C.crateAmbush : t === E.vent ? C.ventAmbush : 0;
            if (ch && r.next() < ch)
                s.ambush.push({ x, y, kind: t === E.crate ? 'crate' : 'vent', type: t === E.vent && s.floor >= C.lurkerFrom && r.next() < C.lurkerShare ? 'lurker' : r.next() < C.ambushMix.mite ? 'mite' : 'crawler' });
        }
}
export function blast(s, x, y, r, dmg, loud, cause, tier = 0) {
    tipNear(s, x, y, r);
    for (const a of [...s.ai.aliens]) {
        const d = hypot(a.x - x, a.y - y);
        if (d < r && !a.inVent)
            damageAlien(s, a, dmg * (1 - d / r * 0.6), 'fire', x, y, 12, tier);
    }
    for (const pu of [...s.inf.pupae])
        if (hypot(pu.x - x, pu.y - y) < r)
            damagePupa(s, pu, 999);
    forSeats(s, p => { const d = hypot(p.x - x, p.y - y); if (d < r && !s.god && p.alive) {
        const k = Math.round(dmg * 0.5 * (1 - d / r));
        p.health -= k;
        p.hurtT = 0.3;
        s.stats.damageTaken += k;
        if (k > 0)
            bleed(s, p.x, p.y, atan2(p.y - y, p.x - x), k, 'blood', 5);
        if (p.health <= 0) {
            p.health = 0;
            p.alive = false;
            p.cause = cause;
        }
    } });
    const tx = Math.floor(x / S), ty = Math.floor(y / S), R = Math.ceil(r / S);
    for (let yy = ty - R; yy <= ty + R; yy++)
        for (let xx = tx - R; xx <= tx + R; xx++) {
            if (hypot((xx + 0.5) * S - x, (yy + 0.5) * S - y) > r)
                continue;
            const t = tileAt(s.map, xx, yy);
            if (t === enumTile.crate)
                breakCrate(s, xx, yy);
            else if (t === enumTile.barrel)
                ignite(s, xx, yy);
            else if (t === enumTile.crack)
                damageCrack(s, xx, yy, 999);
        }
    emit(s.ai, x, y, 'sound', loud[0], loud[1], s.tick);
    s.shake = Math.max(s.shake, 2.5);
    s.fx.push({ kind: 'hit', x, y, t: 0 });
    explosion(s, x, y, r);
}
export function explode(s, x, y) {
    const B = C.breach;
    blast(s, x, y, B.r, B.dmg, B.loud, 'your own breach charge', 3);
    const tx = Math.floor(x / S), ty = Math.floor(y / S), R = Math.ceil(B.r / S);
    let doors = false;
    for (let yy = ty - R; yy <= ty + R; yy++)
        for (let xx = tx - R; xx <= tx + R; xx++) {
            if (hypot((xx + 0.5) * S - x, (yy + 0.5) * S - y) > B.r)
                continue;
            const t = tileAt(s.map, xx, yy);
            if (t === enumTile.door || t === enumTile.doorLocked) {
                for (const [gx, gy] of doorGroup(s.map, xx, yy))
                    setTile(s.map, gx, gy, enumTile.doorOpen);
                doors = true;
            }
        }
    if (doors) {
        s.segs = visionSegments(s.map);
        s.ai.regions = null;
    }
}
export function damageCrate(s, tx, ty, dmg) {
    if (s.trader && s.trader.x === tx && s.trader.y === ty) {
        angerTrader(s);
        return;
    }
    if (tileAt(s.map, tx, ty) === enumTile.barrel) {
        ignite(s, tx, ty);
        return;
    }
    if (tileAt(s.map, tx, ty) === enumTile.crack) {
        damageCrack(s, tx, ty, dmg);
        return;
    }
    if (tileAt(s.map, tx, ty) !== enumTile.crate)
        return;
    const key = ty * s.map.w + tx, hp = (s.crateHP[key] ?? C.crateHP) - dmg;
    s.crateHP[key] = hp;
    s.fx.push({ kind: 'hit', x: (tx + 0.5) * S, y: (ty + 0.5) * S, t: 0 });
    const am = s.ambush.findIndex(a => a.x === tx && a.y === ty);
    if (am >= 0) {
        burst(s, am);
        return;
    }
    if (hp <= 0)
        breakCrate(s, tx, ty);
}
function breakCrate(s, tx, ty) {
    setTile(s.map, tx, ty, enumTile.floor);
    delete s.crateHP[ty * s.map.w + tx];
    s.ai.regions = null;
    const cx = (tx + 0.5) * S, cy = (ty + 0.5) * S;
    s.debris.push({ x: cx, y: cy, v: (tx * 7 + ty) % 3 });
    emit(s.ai, cx, cy, 'sound', C.crateSmash[0], C.crateSmash[1], s.tick);
    const c = s.containers.find(c => c.x === tx && c.y === ty);
    let k = 0;
    const drop = (it) => { const a = (k++) * 2.4 + tx; s.items.push({ x: cx + cos(a) * 4, y: cy + sin(a) * 4, it }); };
    if (c) {
        if (!c.opened)
            c.items.forEach(drop);
        c.items = [];
        c.opened = true;
    }
    else if (rnd(s) < C.crateScrap)
        drop(make('scrap', 1 + Math.floor(rnd(s) * 3)));
}
function burst(s, i) {
    const am = s.ambush.splice(i, 1)[0], cx = (am.x + 0.5) * S, cy = (am.y + 0.5) * S, p = s.player;
    if (am.kind === 'crate')
        breakCrate(s, am.x, am.y);
    const a = spawnAlien(s.ai, am.type, cx, cy);
    a.alert = 100;
    a.target = 0;
    a.lastSeen = s.tick;
    a.los = 0;
    a.behave = 'chase';
    a.facing = atan2(p.y - cy, p.x - cx);
    a.emergeT = T.ai.emergeTime;
    a.cue = 'aggro';
    a.cueT = T.ai.cueTime;
    emit(s.ai, cx, cy, 'sound', C.burst[0], C.burst[1], s.tick, a.id);
    s.ai.log.push(`${s.tick} #${a.id} AMBUSH from a ${am.kind}`);
}
function stepAmbush(s) {
    const p = s.player;
    if (s.tick % 6 || p.hidden || !p.alive)
        return;
    for (let i = s.ambush.length - 1; i >= 0; i--) {
        const am = s.ambush[i], cx = (am.x + 0.5) * S, cy = (am.y + 0.5) * S;
        if (hypot(p.x - cx, p.y - cy) < C.ambushTrigger[am.kind] * S && lineOfSight(s.map, cx, cy, p.x, p.y))
            burst(s, i);
    }
}
export function hitImpact(s, heavy, shake) { const P = C.punch; s.hitstop = Math.max(s.hitstop ?? 0, heavy ? P.freeze[1] : P.freeze[0]); s.shakeAfter = Math.max(s.shakeAfter ?? 0, shake); s.slowT = Math.max(s.slowT ?? 0, P.after * P.slowScale); }
const slowMo = (s) => { const P = C.punch; if (s.tick - (s.slowAt ?? -1e9) <= P.slowGap * T.SIM_HZ)
    return; s.slowT = P.slow * P.slowScale; s.slowAt = s.tick; };
let curTier = 0;
export function damageAlien(s, a, dmg, kind, fromX, fromY, knock = 0, tier = curTier) {
    const bleeds = kind !== 'fire' || knock > 0;
    if (a.type === 'brute' && kind === 'ballistic')
        dmg *= 0.5;
    if (a.type === 'hivemind') {
        const W = T.dock.weak;
        if (tier > 0 && tier < T.dock.immuneBelow) {
            s.fx.push({ kind: 'hit', x: a.x, y: a.y, t: 0 }, { kind: 'dmg', x: a.x, y: a.y - 14, t: 0, n: 0 });
            if (s.tick % 90 < 2)
                s.msg = 'it does not even notice';
            return;
        }
        if (tier > 0) {
            let da = atan2(fromY - a.y, fromX - a.x) - a.facing;
            da = Math.abs(atan2(sin(da), cos(da))) * 180 / Math.PI;
            dmg *= da < W.eyesArc ? W.eyes : da >= 60 && da <= 120 ? W.sacs : da > 140 ? W.back : 1;
        }
        if (kind === 'fire' && tier === 0 && tileAt(s.map, Math.floor(a.x / S), Math.floor(a.y / S)) === enumTile.fuel)
            dmg *= T.dock.fuelDps / T.fire.alienDps;
        knock = 0;
    }
    dmg = Math.round(dmg);
    const alive = a.hp > 0;
    a.hp -= dmg;
    const ang = atan2(a.y - fromY, a.x - fromX);
    a.hitT = C.hitFlash;
    a.hitDir = ang;
    if (a.type === 'brute' || a.type === 'sentinel')
        knock *= C.knock.brute;
    if (knock > 0) {
        const K = C.knock, v = 2 * knock / K.time;
        a.kv = [cos(ang) * v, sin(ang) * v, K.time];
        a.path = [];
        a.repathAt = 0;
        if (knock >= K.staggerFrom) {
            a.windT = 0;
            a.attackT = Math.max(a.attackT, K.time + K.stagger);
            a.chewT = Math.max(a.chewT, K.time + K.stagger);
        }
        if (knock >= K.heavy) {
            slowMo(s);
            s.shake = Math.max(s.shake, K.shake);
        }
    }
    emit(s.ai, a.x, a.y, 'damage', T.stim.damageFlat, 1, s.tick);
    s.fx.push({ kind: 'hit', x: a.x, y: a.y, t: 0 }, { kind: 'dmg', x: a.x, y: a.y - 6, t: 0, n: dmg });
    if (bleeds && dmg > 0) {
        bleed(s, a.x, a.y, ang, kind === 'energy' ? dmg * 0.5 : dmg, fluidOf(a.type), T.ai.types[a.type].r);
        if (a.hp <= 0)
            deathGore(s, a, ang, dmg, kind === 'fire');
    }
    if (a.hp <= 0 && alive) {
        const big = T.ai.types[a.type].hp >= C.punch.killSlowFrom;
        if (big) {
            slowMo(s);
            s.shake = Math.max(s.shake, 1.2);
        }
        s.fx.push({ kind: 'ring', x: a.x, y: a.y, t: 0, n: T.ai.types[a.type].r * 1.6 });
    }
    if (a.hp <= 0) {
        s.stats.kills++;
        if (a.type === 'hivemind') {
            s.stats.boss = true;
            s.msg = 'THE HIVE MIND IS DEAD';
            s.shake = 6;
        }
    }
}
function castRay(s, x, y, ang, range) {
    const dx = cos(ang), dy = sin(ang);
    let wall = range, tx = -1, ty = -1;
    for (let d = 2; d < range; d += 2) {
        const cx = Math.floor((x + dx * d) / S), cy = Math.floor((y + dy * d) / S);
        if (blocksPoint(s.map, x + dx * d, y + dy * d)) {
            wall = d;
            tx = cx;
            ty = cy;
            break;
        }
    }
    let best = null, bd = wall;
    for (const a of s.ai.aliens) {
        if (a.inVent)
            continue;
        const r = T.ai.types[a.type].r + 1, ox = a.x - x, oy = a.y - y, t = ox * dx + oy * dy;
        if (t < 0 || t > bd)
            continue;
        const px = x + dx * t - a.x, py = y + dy * t - a.y, q = r * r - (px * px + py * py);
        if (q < 0)
            continue;
        const hit = t - Math.sqrt(q);
        if (hit < bd) {
            bd = hit;
            best = a;
        }
    }
    const circ = (cx, cy, r) => { const ox = cx - x, oy = cy - y, t = ox * dx + oy * dy; if (t < 0 || t > bd)
        return Infinity; const px = x + dx * t - cx, py = y + dy * t - cy, q = r * r - (px * px + py * py); return q < 0 ? Infinity : t - Math.sqrt(q); };
    let pupa = null, nest = null;
    for (const pu of s.inf.pupae) {
        const h = circ(pu.x, pu.y, pupaRadius(pu));
        if (h < bd) {
            bd = h;
            pupa = pu;
            best = null;
        }
    }
    for (const n of s.inf.nests) {
        const h = circ(n.x, n.y, 11);
        if (h < bd) {
            bd = h;
            nest = n;
            pupa = null;
            best = null;
        }
    }
    const hitSomething = best || pupa || nest;
    return { x: x + dx * bd, y: y + dy * bd, alien: best, pupa, nest, d: bd, tx: hitSomething ? -1 : tx, ty: hitSomething ? -1 : ty };
}
const active = (s) => s.inv.weapons[s.inv.active];
const canAct = (s) => !s.player.vault && !s.player.channel && s.player.reloadT <= 0 && !s.player.hidden;
function swing(s, it) {
    const mdm = s.mods.melee * weaponLevelMul(it);
    const p = s.player, m = ITEMS[it.id].melee;
    if (p.stamina < m.stamina) {
        s.msg = 'winded — catch your breath';
        return;
    }
    p.stamina -= m.stamina;
    p.staminaWait = T.player.stamina.regenDelay;
    p.weaponT = m.swing * (p.lockout > 0 ? 1.5 : 1);
    p.swingT = p.weaponT;
    const half = m.arc / 2 * Math.PI / 180;
    let hits = 0;
    const targets = m.targets ?? 1;
    const clear = (x, y) => {
        if (!lineOfSight(s.map, p.x, p.y, x, y))
            return false;
        const n = Math.ceil(hypot(x - p.x, y - p.y) / 2);
        for (let i = 1; i < n; i++) {
            const qx = p.x + (x - p.x) * i / n, qy = p.y + (y - p.y) * i / n, tx = Math.floor(qx / S), ty = Math.floor(qy / S), t = tileAt(s.map, tx, ty);
            if (DIAG.has(t) && diagSolid(t, qx / S - tx, qy / S - ty))
                return false;
        }
        return true;
    };
    const inArc = s.ai.aliens.filter(a => { if (a.inVent)
        return false; const d = hypot(a.x - p.x, a.y - p.y) - T.ai.types[a.type].r; if (d > m.reach)
        return false; let da = atan2(a.y - p.y, a.x - p.x) - p.aim; da = atan2(sin(da), cos(da)); return Math.abs(da) <= half && clear(a.x, a.y); })
        .sort((a, b) => hypot(a.x - p.x, a.y - p.y) - hypot(b.x - p.x, b.y - p.y));
    if (m.kind === 'katana') {
        p.dashT = 0.15;
        p.iframeT = m.swing;
    }
    if (inArc.length)
        hitImpact(s, m.dmg * mdm >= C.punch.heavyMelee || (m.knock ?? 0) >= C.knock.heavy, C.punch.meleeShake * (1 + Math.min(1, m.dmg * mdm / 60)));
    for (const a of inArc) {
        if (hits++ >= targets)
            break;
        damageAlien(s, a, m.dmg * mdm, m.kind === 'esword' ? 'energy' : 'melee', p.x, p.y, m.knock ?? C.knock.melee);
        if (m.stagger) {
            a.windT = 0;
            a.attackT = Math.max(a.attackT, m.stagger);
            a.chewT = Math.max(a.chewT, m.stagger);
        }
    }
    if (m.kind === 'fist') {
        const fx = Math.floor((p.x + cos(p.aim) * S * 0.9) / S), fy = Math.floor((p.y + sin(p.aim) * S * 0.9) / S), t = tileAt(s.map, fx, fy);
        if ((t === enumTile.door || t === enumTile.doorLocked) && clear((fx + 0.5) * S, (fy + 0.5) * S)) {
            for (const [gx, gy] of doorGroup(s.map, fx, fy))
                setTile(s.map, gx, gy, enumTile.doorOpen);
            s.segs = visionSegments(s.map);
            s.ai.regions = null;
            s.shake = Math.max(s.shake, 2);
            hits = Math.max(hits, 1);
        }
    }
    if (!hits) {
        const reachOf = (x, y, r) => { const d = hypot(x - p.x, y - p.y) - r; let da = atan2(y - p.y, x - p.x) - p.aim; da = atan2(sin(da), cos(da)); return d <= m.reach && Math.abs(da) <= half && clear(x, y); };
        const pu = s.inf.pupae.find(q => reachOf(q.x, q.y, pupaRadius(q)));
        if (pu) {
            damagePupa(s, pu, m.dmg * mdm, true);
            hits = 1;
        }
        else {
            const n = s.inf.nests.find(q => reachOf(q.x, q.y, 11));
            if (n) {
                damageNest(s, n, m.dmg * mdm);
                hits = 1;
            }
        }
    }
    if (!hits) {
        const cx = Math.floor((p.x + cos(p.aim) * m.reach * 0.9) / S), cy = Math.floor((p.y + sin(p.aim) * m.reach * 0.9) / S);
        if ((tileAt(s.map, cx, cy) === enumTile.crate || tileAt(s.map, cx, cy) === enumTile.crack || (s.trader?.x === cx && s.trader?.y === cy)) && clear((cx + 0.5) * S, (cy + 0.5) * S)) {
            damageCrate(s, cx, cy, m.dmg * mdm * (m.kind === 'fist' ? 10 : 1));
            hits = 1;
        }
    }
    const src = hits ? T.stim.src.meleeHit : T.stim.src.meleeSwing;
    emit(s.ai, p.x, p.y, 'sound', src[0], src[1], s.tick);
    if (hits && it.cond !== undefined) {
        it.cond = Math.max(0, it.cond - C.meleeWear[ITEMS[it.id].tier - 1]);
        if (it.cond <= 0) {
            const k = s.inv.weapons.indexOf(it);
            if (k >= 0)
                s.inv.weapons[k] = null;
            s.msg = `your ${ITEMS[it.id].name} breaks`;
            emit(s.ai, p.x, p.y, 'sound', T.stim.src.meleeHit[0], T.stim.src.meleeHit[1], s.tick);
        }
    }
}
function shoot(s, it) {
    const p = s.player, g = ITEMS[it.id].gun;
    if (p.jam) {
        s.msg = 'jammed — R to clear';
        p.weaponT = 0.3;
        return;
    }
    if (!it.mag && g.caliber === 'none' && !s.infiniteAmmo) {
        p.weaponT = 0.3;
        s.msg = 'empty — this one never reloads';
        return;
    }
    if (!it.mag && g.caliber !== 'none') {
        p.weaponT = 0.3;
        if (s.inv.ammo[g.caliber] > 0 || s.infiniteAmmo)
            reload(s, it);
        else
            s.msg = `no ${g.caliber} ammo`;
        return;
    }
    p.weaponT = 1 / g.rate;
    if (!s.infiniteAmmo) {
        it.mag--;
        it.cond = Math.max(0, it.cond - g.wear);
    }
    const misfire = g.misfire + (100 - it.cond) * C.misfirePerCond;
    if (rnd(s) < misfire) {
        p.jam = true;
        s.msg = 'misfire!';
        emit(s.ai, p.x, p.y, 'sound', C.jamLoud[0], C.jamLoud[1], s.tick);
        s.stats.misfires++;
        return;
    }
    const spread = (g.spread * (1 + (100 - it.cond) / 100) + p.bloom) * Math.PI / 180;
    const [lx, ly] = [p.x + cos(p.aim) * 6, p.y + sin(p.aim) * 6], k = g.kind, gd = g.dmg * weaponLevelMul(it);
    if (k === 'launcher')
        lob(s, 'frag', g.range);
    else if (k === 'flame')
        flame(s, lx, ly, g.range, gd);
    else
        for (let i = 0; i < g.pellets; i++) {
            const ang = p.aim + (rnd(s) - 0.5) * 2 * spread;
            if (k === 'rail' || k === 'laser') {
                pierce(s, lx, ly, ang, g.range, gd, k);
                continue;
            }
            const h = castRay(s, lx, ly, ang, g.range);
            s.fx.push({ kind: 'tracer', x: lx, y: ly, x1: h.x, y1: h.y, t: 0, c: k === 'energy' ? 1 : k === 'flameShot' ? 3 : 0 });
            if (h.alien) {
                damageAlien(s, h.alien, gd, k === 'energy' ? 'energy' : k === 'flameShot' ? 'fire' : 'ballistic', p.x, p.y, C.knock.bullet);
                s.stats.hits++;
                if (k === 'hmg') {
                    h.alien.windT = 0;
                    h.alien.attackT = Math.max(h.alien.attackT, C.hmg.stagger);
                    h.alien.chewT = Math.max(h.alien.chewT, C.hmg.stagger);
                }
            }
            else if (h.pupa) {
                damagePupa(s, h.pupa, gd);
                s.stats.hits++;
            }
            else if (h.nest) {
                damageNest(s, h.nest, gd);
                s.stats.hits++;
            }
            else if (h.tx >= 0) {
                damageCrate(s, h.tx, h.ty, gd);
                if (wallAt(s, h.x, h.y))
                    impact(s, h.x, h.y, ang);
            }
            if (k === 'flameShot')
                ignite(s, Math.floor((h.x - cos(ang) * 4) / S), Math.floor((h.y - sin(ang) * 4) / S), true);
        }
    s.fx.push({ kind: 'smoke', x: lx + cos(p.aim) * 4, y: ly + sin(p.aim) * 4, vx: cos(p.aim) * 14, vy: sin(p.aim) * 14, t: 0, n: 0.7, rot: s.tick, c: 1 });
    s.stats.shots++;
    p.flashT = C.flashTime;
    if (it.id !== 'nail-pistol' && (!k || k === 'hmg' || k === 'minigun' || k === 'flameShot')) {
        const side = p.aim + Math.PI / 2 + (rnd(s) - 0.5) * 0.6, sp = 40 + rnd(s) * 30;
        s.fx.push({ kind: 'casing', x: p.x + cos(p.aim) * 3, y: p.y + sin(p.aim) * 3, t: 0, vx: cos(side) * sp - cos(p.aim) * 10, vy: sin(side) * sp - sin(p.aim) * 10, rot: rnd(s) * 6 });
    }
    const kick = Math.min(1, g.dmg * g.pellets / 60);
    p.kick = Math.max(p.kick, kick);
    p.bloom = Math.min(C.recoil.bloomMax, p.bloom + C.recoil.bloom * kick);
    s.shake = Math.max(s.shake, C.shake.base + C.shake.perKick * kick);
    const src = T.stim.src[g.loud];
    emit(s.ai, p.x, p.y, 'sound', src[0], src[1], s.tick);
    emit(s.ai, p.x, p.y, 'light', C.flashStim[0], C.flashStim[1], s.tick);
}
function pierce(s, x, y, ang, range, dmg, k) {
    const dx = cos(ang), dy = sin(ang);
    let wall = range, wx = -1, wy = -1;
    for (let d = 2; d < range; d += 2) {
        const cx = Math.floor((x + dx * d) / S), cy = Math.floor((y + dy * d) / S);
        if (blocksPoint(s.map, x + dx * d, y + dy * d)) {
            wall = d;
            wx = cx;
            wy = cy;
            break;
        }
    }
    const on = (cx, cy, r) => { const ox = cx - x, oy = cy - y, t = ox * dx + oy * dy; if (t < 0 || t > wall)
        return false; const px = x + dx * t - cx, py = y + dy * t - cy; return px * px + py * py < r * r; };
    for (const a of [...s.ai.aliens])
        if (!a.inVent && on(a.x, a.y, T.ai.types[a.type].r + 1)) {
            damageAlien(s, a, dmg, 'energy', s.player.x, s.player.y, C.knock.bullet * 3);
            s.stats.hits++;
        }
    for (const pu of [...s.inf.pupae])
        if (on(pu.x, pu.y, pupaRadius(pu))) {
            if (k === 'laser')
                pu.burn = Math.max(pu.burn, 0.01), ignite(s, Math.floor(pu.x / S), Math.floor(pu.y / S), true);
            else
                damagePupa(s, pu, dmg);
        }
    for (const n of [...s.inf.nests])
        if (on(n.x, n.y, 11))
            damageNest(s, n, dmg);
    if (wx >= 0) {
        damageCrate(s, wx, wy, dmg);
        if (wallAt(s, x + dx * wall, y + dy * wall))
            impact(s, x + dx * wall, y + dy * wall, ang);
    }
    if (k === 'laser')
        for (let d = 12; d < wall; d += S)
            ignite(s, Math.floor((x + dx * d) / S), Math.floor((y + dy * d) / S), true);
    s.fx.push({ kind: 'tracer', x, y, x1: x + dx * wall, y1: y + dy * wall, t: 0, c: k === 'laser' ? 2 : 1 });
}
function flame(s, x, y, range, dmg) {
    const p = s.player, half = C.flame.arc / 2 * Math.PI / 180;
    let reach = range;
    for (let d = 4; d < range; d += 4)
        if (blocksPoint(s.map, x + cos(p.aim) * d, y + sin(p.aim) * d)) {
            reach = d;
            break;
        }
    const inCone = (ax, ay, r) => { const d = hypot(ax - x, ay - y) - r; let da = atan2(ay - y, ax - x) - p.aim; da = atan2(sin(da), cos(da)); return d < reach && Math.abs(da) < half && lineOfSight(s.map, x, y, ax, ay); };
    for (const a of [...s.ai.aliens])
        if (!a.inVent && inCone(a.x, a.y, T.ai.types[a.type].r)) {
            damageAlien(s, a, dmg, 'fire', p.x, p.y, 0);
            s.stats.hits++;
        }
    for (const pu of s.inf.pupae)
        if (inCone(pu.x, pu.y, pupaRadius(pu)))
            ignite(s, Math.floor(pu.x / S), Math.floor(pu.y / S), true);
    for (const n of s.inf.nests)
        if (inCone(n.x, n.y, 11))
            damageNest(s, n, dmg);
    for (let d = 8; d < reach; d += S / 2)
        ignite(s, Math.floor((x + cos(p.aim) * d) / S), Math.floor((y + sin(p.aim) * d) / S));
    if (rnd(s) < C.flame.ignite)
        ignite(s, Math.floor((x + cos(p.aim) * (reach - 6)) / S), Math.floor((y + sin(p.aim) * (reach - 6)) / S), true);
    s.fx.push({ kind: 'flame', x, y, x1: x + cos(p.aim) * reach, y1: y + sin(p.aim) * reach, t: 0 });
}
function lob(s, kind, range = C.throwRange) {
    const p = s.player, dist = Math.min(range, hypot(s.aimX - p.x, s.aimY - p.y));
    let d = 0;
    for (; d < dist; d += 2)
        if (blocksPoint(s.map, p.x + cos(p.aim) * (d + 4), p.y + sin(p.aim) * (d + 4)))
            break;
    s.thrown.push({ tier: curTier || 4, kind, x0: p.x, y0: p.y, x1: p.x + cos(p.aim) * d, y1: p.y + sin(p.aim) * d, t: 0, dur: 0.25 + d / C.throwRange * 0.35 });
}
function land(s, th) {
    const G = C.grenade, x = th.x1, y = th.y1;
    if (th.kind === 'breach')
        return explode(s, x, y);
    if (th.kind === 'frag')
        return blast(s, x, y, G.frag.r, G.frag.dmg, G.frag.loud, 'your own grenade', th.tier ?? 4);
    if (th.kind === 'incendiary') {
        blast(s, x, y, G.incendiary.r, G.incendiary.dmg, G.incendiary.loud, 'your own incendiary', 4);
        const tx = Math.floor(x / S), ty = Math.floor(y / S), R = Math.ceil(G.incendiary.fireR);
        for (let yy = ty - R; yy <= ty + R; yy++)
            for (let xx = tx - R; xx <= tx + R; xx++)
                if (hypot(xx - tx, yy - ty) <= G.incendiary.fireR && lineOfSight(s.map, x, y, (xx + 0.5) * S, (yy + 0.5) * S))
                    ignite(s, xx, yy, true);
        return;
    }
    if (th.kind === 'sporekill') {
        const R = G.sporekill.r;
        s.inf.clouds = s.inf.clouds.filter(c => hypot(c.x - x, c.y - y) > R + c.r * 0.5);
        for (const pu of [...s.inf.pupae])
            if (hypot(pu.x - x, pu.y - y) < R && lineOfSight(s.map, x, y, pu.x, pu.y)) {
                s.inf.pupae.splice(s.inf.pupae.indexOf(pu), 1);
                s.debris.push({ x: pu.x, y: pu.y, v: 0, k: 'fx/scorch' });
            }
        for (const n of [...s.inf.nests])
            if (hypot(n.x - x, n.y - y) < R)
                damageNest(s, n, G.sporekill.nestDmg);
        if (hypot(s.player.x - x, s.player.y - y) < R)
            s.player.spores = 0;
        emit(s.ai, x, y, 'sound', G.sporekill.loud[0], G.sporekill.loud[1], s.tick);
        s.fx.push({ kind: 'spray', x, y, rot: 0, t: 0, c: 9 });
        return;
    }
    s.ground.push({ kind: th.kind, x, y, t: th.kind === 'flare' ? C.flareTime : C.noiseTime, pulse: 0 });
}
function reload(s, it) {
    const p = s.player, g = ITEMS[it.id].gun;
    if (p.jam) {
        p.reloadT = C.jamClear;
        p.reloadKind = 'jam';
        emit(s.ai, p.x, p.y, 'sound', C.jamLoud[0], C.jamLoud[1], s.tick);
        return;
    }
    if (g.caliber === 'none' || it.mag >= g.mag || (!s.infiniteAmmo && s.inv.ammo[g.caliber] <= 0))
        return;
    p.reloadT = g.reload * s.mods.reload;
    p.reloadKind = 'reload';
}
function finishReload(s, it) {
    const p = s.player, g = ITEMS[it.id].gun;
    if (p.reloadKind === 'jam') {
        p.jam = false;
        s.msg = '';
        return;
    }
    const want = g.mag - it.mag, take = s.infiniteAmmo ? want : Math.min(want, s.inv.ammo[g.caliber]);
    it.mag += take;
    if (!s.infiniteAmmo)
        s.inv.ammo[g.caliber] -= take;
}
function useQuick(s, i) {
    const p = s.player, it = s.inv.quick[i];
    if (!it)
        return;
    const u = ITEMS[it.id].use;
    if (u.time) {
        if (p.health >= T.player.maxHealth + s.mods.maxHealth) {
            s.msg = 'health full';
            return;
        }
        p.channel = { kind: 'use', t: 0, dur: u.time, ref: i };
        return;
    }
    if (u.throw) {
        lob(s, u.throw);
        consume(s, i);
        return;
    }
    if (u.shield) {
        if (!s.inv.shieldMax) {
            s.msg = 'no shield belt to charge';
            return;
        }
        if (s.inv.shield >= s.inv.shieldMax) {
            s.msg = 'shield full';
            return;
        }
        s.inv.shield = Math.min(s.inv.shieldMax, s.inv.shield + u.shield);
        consume(s, i);
        return;
    }
    if (u.adren) {
        p.adrenT = u.adren;
        p.stamina = T.player.stamina.max + s.mods.stamina;
        p.lockout = 0;
        consume(s, i);
        return;
    }
    if (u.antifungal) {
        p.spores = 0;
        p.antiT = u.antifungal;
        consume(s, i);
        return;
    }
    if (u.mine) {
        s.mines.push({ x: p.x, y: p.y, arm: C.mine.arm });
        consume(s, i);
        s.msg = 'mine set — it arms in a second';
        return;
    }
    if (u.spray) {
        spray(s);
        if (--it.charges <= 0)
            consume(s, i);
        return;
    }
    if (u.nav) {
        s.navT = C.navTime;
        if (--it.charges <= 0)
            consume(s, i);
        return;
    }
    applyUse(s, i);
}
function applyUse(s, i) {
    const p = s.player, it = s.inv.quick[i];
    if (!it)
        return;
    const u = ITEMS[it.id].use;
    if (u.heal)
        p.health = Math.min(T.player.maxHealth + s.mods.maxHealth, p.health + u.heal);
    if (u.buff)
        p.buffT = Math.max(p.buffT, u.buff);
    consume(s, i);
}
const consume = (s, i) => { const it = s.inv.quick[i]; if (--it.n <= 0)
    s.inv.quick[i] = null; };
export function interactLoot(s) {
    const p = s.player, [tx, ty] = [Math.floor((p.x + cos(p.aim) * S * 0.9) / S), Math.floor((p.y + sin(p.aim) * S * 0.9) / S)];
    const am = s.ambush.findIndex(a => a.x === tx && a.y === ty && a.kind === 'crate');
    if (am >= 0) {
        burst(s, am);
        return true;
    }
    let ci = s.containers.findIndex(c => c.x === tx && c.y === ty && !c.opened);
    if (ci < 0)
        ci = s.containers.findIndex(c => c.body && !c.opened && hypot((c.x + 0.5) * S - p.x, (c.y + 0.5) * S - p.y) < S * 1.2);
    if (ci >= 0 && s.containers[ci].locked && !s.inv.keys.includes(s.containers[ci].locked)) {
        s.msg = `locked — needs the ${s.containers[ci].locked} key`;
        return true;
    }
    if (ci >= 0) {
        p.channel = { kind: 'container', t: 0, dur: Math.min(C.containerTime[2], C.containerTime[0] + C.containerTime[1] * s.containers[ci].items.length) * s.mods.loot, ref: ci };
        return true;
    }
    if (tileAt(s.map, tx, ty) === enumTile.locker) {
        hide(s, tx, ty);
        return true;
    }
    const near = nearestItem(s);
    if (near >= 0) {
        p.channel = { kind: 'item', t: 0, dur: C.pickupTime * s.mods.loot, ref: near };
        return true;
    }
    if (s.containers.some(c => c.x === tx && c.y === ty)) {
        s.msg = 'empty';
        return true;
    }
    return false;
}
function hide(s, tx, ty) {
    const p = s.player;
    p.hidden = true;
    p.hideTile = ty * s.map.w + tx;
    p.lightWas = s.light.on;
    s.light.on = false;
    p.channel = null;
    p.reloadT = 0;
    emit(s.ai, p.x, p.y, 'sound', C.lockerSound[0], C.lockerSound[1], s.tick);
    s.msg = 'hiding — E to get out';
}
export function unhide(s) { const p = s.player; p.hidden = false; s.light.on = p.lightWas; emit(s.ai, p.x, p.y, 'sound', C.lockerSound[0], C.lockerSound[1], s.tick); s.msg = ''; }
export function nearestItem(s) {
    const p = s.player;
    let best = -1, bd = C.pickupReach;
    s.items.forEach((w, i) => { const d = hypot(w.x - p.x, w.y - p.y); if (d < bd) {
        bd = d;
        best = i;
    } });
    return best;
}
function finishChannel(s) {
    const p = s.player, ch = p.channel;
    p.channel = null;
    if (ch.kind === 'use') {
        applyUse(s, ch.ref);
        return;
    }
    if (ch.kind === 'item') {
        const w = s.items[ch.ref];
        if (!w)
            return;
        const rest = give(s.inv, w.it);
        if (rest) {
            s.msg = 'no room';
            return;
        }
        s.items.splice(ch.ref, 1);
        s.msg = `+ ${ITEMS[w.it.id].name}${w.it.n > 1 ? ' ×' + w.it.n : ''}`;
        emit(s.ai, p.x, p.y, 'sound', T.stim.src.pickup[0], T.stim.src.pickup[1], s.tick);
        return;
    }
    const c = s.containers[ch.ref];
    c.opened = true;
    if (!c.body)
        emit(s.ai, (c.x + 0.5) * S, (c.y + 0.5) * S, 'sound', T.stim.src.container[0], T.stim.src.container[1], s.tick);
    if (c.alarm)
        s.alarmT = T.deck.alarm.time;
    const got = [];
    let k = 0;
    for (const it of c.items) {
        const name = ITEMS[it.id].name + (it.n > 1 ? ' ×' + it.n : '');
        const rest = give(s.inv, it);
        if (rest) {
            const ang = p.aim + Math.PI + (k++ - 1) * 0.6;
            s.items.push({ x: p.x + cos(ang) * 8, y: p.y + sin(ang) * 8, it: rest });
            got.push(name + ' (dropped)');
        }
        else
            got.push(name);
    }
    c.items = [];
    s.msg = (c.alarm ? 'ALARM! ' : '') + (got.length ? '+ ' + got.join(', ') : c.body ? 'nothing on them' : 'empty');
}
export const dropFromBag = (s, i) => dropSlot(s, { where: 'bag', i });
export function dismantleSlot(s, slot) {
    const it = getSlot(s.inv, slot);
    if (!it)
        return;
    if (s.player.moving && !s.player.hidden) {
        s.msg = 'stand still (or hide) to take it apart';
        return;
    }
    if (ITEMS[it.id].cat === 'part') {
        s.msg = 'parts go in a workbench shredder';
        return;
    }
    const y = yieldOf(it), name = ITEMS[it.id].name, r = dismantle(s.inv, slot);
    if (r) {
        s.msg = r;
        return;
    }
    s.msg = `${name} → ${yieldText(y)}`;
    if (slot.where === 'weapon' && slot.i === s.inv.active) {
        s.player.jam = false;
        s.player.reloadT = 0;
    }
    emit(s.ai, s.player.x, s.player.y, 'sound', T.stim.src.pickup[0], T.stim.src.pickup[1], s.tick);
}
export function dropSlot(s, slot) { const it = getSlot(s.inv, slot); if (!it)
    return; if (slot.where === 'bag')
    s.inv.bag[slot.i] = null;
else if (slot.where === 'weapon') {
    s.inv.weapons[slot.i] = null;
    if (slot.i === s.inv.active) {
        s.player.jam = false;
        s.player.reloadT = 0;
    }
}
else if (slot.where === 'quick')
    s.inv.quick[slot.i] = null;
else
    setSlot(s.inv, slot, null); const p = s.player; s.items.push({ x: p.x + cos(p.aim + 2.5) * 8, y: p.y + sin(p.aim + 2.5) * 8, it }); emit(s.ai, p.x, p.y, 'sound', T.stim.src.pickup[0], T.stim.src.pickup[1], s.tick); }
export function dropActive(s) {
    const inv = s.inv, it = inv.weapons[inv.active];
    if (!it)
        return;
    inv.weapons[inv.active] = null;
    const p = s.player;
    s.items.push({ x: p.x + cos(p.aim) * 10, y: p.y + sin(p.aim) * 10, it });
    p.jam = false;
    p.reloadT = 0;
}
export function stepCombat(s, inp, dt) {
    const p = s.player, inv = s.inv, it = active(s);
    if (p.weaponT > 0)
        p.weaponT -= dt;
    if (p.swingT > 0)
        p.swingT -= dt;
    if (p.flashT > 0)
        p.flashT -= dt;
    p.kick = Math.max(0, p.kick - C.recoil.decay * dt * p.kick - dt);
    p.bloom = Math.max(0, p.bloom - C.recoil.bloomDecay * dt);
    s.shake = Math.max(0, s.shake - s.shake * dt / C.shake.decay - dt);
    if (p.buffT > 0)
        p.buffT -= dt;
    if (s.navT > 0)
        s.navT -= dt;
    if (p.reloadT > 0) {
        p.reloadT -= dt;
        if (p.reloadT <= 0 && it?.mag !== undefined)
            finishReload(s, it);
    }
    if (p.channel) {
        const ch = p.channel;
        if (ch.kind === 'use' ? p.sprinting : p.moving && ch.kind !== 'container') {
            p.channel = null;
            s.msg = 'cancelled';
        }
        else {
            ch.t += dt;
            if (ch.t >= ch.dur)
                finishChannel(s);
        }
    }
    const edge = s.tick - p.lastAction > 6;
    if (inp.swap && edge) {
        inv.active = inv.weapons[1 - inv.active] || !inv.weapons[inv.active] ? 1 - inv.active : inv.active;
        p.jam = false;
        p.reloadT = 0;
        p.lastAction = s.tick;
    }
    if (inp.drop && edge) {
        dropActive(s);
        p.lastAction = s.tick;
    }
    if (inp.quick >= 0 && edge && canAct(s)) {
        useQuick(s, inp.quick);
        p.lastAction = s.tick;
    }
    if (inp.reload && edge && it?.mag !== undefined && canAct(s)) {
        reload(s, it);
        p.lastAction = s.tick;
    }
    const mini = it && ITEMS[it.id].gun?.kind === 'minigun';
    p.spin = mini && inp.fire && canAct(s) ? Math.min(C.minigun.spin, p.spin + dt) : Math.max(0, p.spin - dt * 2);
    if (inp.fire && it && p.weaponT <= 0 && canAct(s) && !p.crouching && (!mini || p.spin >= C.minigun.spin)) {
        curTier = ITEMS[it.id].tier;
        if (ITEMS[it.id].melee)
            swing(s, it);
        else
            shoot(s, it);
        curTier = 0;
    }
    if (p.iframeT > 0)
        p.iframeT -= dt;
    if (p.adrenT > 0)
        p.adrenT -= dt;
    if (p.antiT > 0)
        p.antiT -= dt;
}
export function stepCombatWorld(s, dt, after) {
    if (!after) {
        forSeats(s, () => stepAmbush(s));
        for (const a of s.ai.aliens) {
            if (a.hitT > 0)
                a.hitT -= dt;
            if (a.kv) {
                const [vx, vy, t] = a.kv, k = t / C.knock.time;
                [a.x, a.y] = moveCircle(s.map, a.x, a.y, vx * k * dt, vy * k * dt, T.ai.types[a.type].r);
                if (t - dt <= 0)
                    a.kv = undefined;
                else
                    a.kv[2] = t - dt;
            }
        }
        return;
    }
    for (let i = s.thrown.length - 1; i >= 0; i--) {
        const th = s.thrown[i];
        th.t += dt;
        if (th.t >= th.dur) {
            s.thrown.splice(i, 1);
            land(s, th);
        }
    }
    for (const mn of [...s.mines]) {
        if (mn.arm > 0) {
            mn.arm -= dt;
            continue;
        }
        if (s.ai.aliens.some(a => !a.inVent && hypot(a.x - mn.x, a.y - mn.y) < C.mine.trigger + T.ai.types[a.type].r)) {
            s.mines.splice(s.mines.indexOf(mn), 1);
            blast(s, mn.x, mn.y, C.mine.r, C.mine.dmg, C.mine.loud, 'your own mine', 5);
        }
    }
    for (let i = s.ground.length - 1; i >= 0; i--) {
        const g = s.ground[i];
        g.t -= dt;
        g.pulse -= dt;
        if (g.t <= 0) {
            s.ground.splice(i, 1);
            continue;
        }
        if (g.pulse <= 0) {
            g.pulse = C.pulseEvery;
            if (g.kind === 'flare')
                emit(s.ai, g.x, g.y, 'light', C.flareLight[0], C.flareLight[1], s.tick);
            else {
                emit(s.ai, g.x, g.y, 'sound', C.noiseStim[0], C.noiseStim[1], s.tick);
                for (const a of s.ai.aliens)
                    if (!a.inVent && (a.lureT ?? 0) <= 0 && a.calmAt === undefined && s.tick - a.lastSeen > 60 && hypot(a.x - g.x, a.y - g.y) < T.ai.lure.r && a.type !== 'hivemind' && a.type !== 'sentinel') {
                        a.lureX = g.x;
                        a.lureY = g.y;
                        a.lureT = g.t + 2;
                        if (a.cue !== 'aggro') {
                            a.cue = 'aggro';
                            a.cueT = T.ai.cueTime;
                        }
                        a.repathAt = 0;
                    }
            }
        }
    }
    for (let i = s.fx.length - 1; i >= 0; i--) {
        const f = s.fx[i];
        f.t += dt;
        if (f.kind === 'chip' && f.t < 0.3) {
            const k = 1 - f.t / 0.3;
            f.x += f.vx * dt * k;
            f.y += f.vy * dt * k;
            f.rot += 20 * dt;
        }
        if (f.kind === 'drop') {
            if (f.t < 0.2) {
                const k = 1 - f.t / 0.2;
                f.x += f.vx * dt * k;
                f.y += f.vy * dt * k;
            }
            else {
                decal(s, f.x, f.y, `fx/drop-${FLUIDS[f.c ?? 0]}.${(f.rot * 10 | 0) & 3}`, f.rot, f.n, 0.95);
                s.fx.splice(i, 1);
                continue;
            }
        }
        if (f.kind === 'smoke') {
            f.x += f.vx * dt;
            f.y += f.vy * dt;
            f.vx *= 0.99;
            f.vy *= 0.99;
        }
        if (f.kind === 'casing' && f.t < 0.3) {
            const k = 1 - f.t / 0.3;
            f.x += f.vx * dt * k;
            f.y += f.vy * dt * k;
            f.rot += 25 * dt * k;
        }
        if (f.t > (f.kind === 'smoke' ? f.n : f.kind === 'ring' ? 0.45 : f.kind === 'chip' ? 0.35 : f.kind === 'dmg' ? 0.8 : f.kind === 'hit' ? 0.25 : f.kind === 'casing' ? C.casingLife : f.kind === 'spray' ? 0.5 : f.kind === 'flame' ? 0.12 : f.kind === 'tracer' && f.c ? 0.18 : 0.1))
            s.fx.splice(i, 1);
    }
}
export const armorReduce = (s) => ['vest', 'helmet', 'mask'].reduce((a, k) => a + (s.inv[k] ? ITEMS[s.inv[k].id].armor.reduce : 0), 0);
export function dynamicLights(s, lensX, lensY) {
    const out = [];
    for (const g of s.ground)
        if (g.kind === 'flare')
            out.push({ x: g.x, y: g.y, r: C.flareRadius * Math.min(1, g.t / 3), color: [1.25, 0.66, 0.55], fire: true });
    for (const th of s.thrown)
        if (th.kind === 'flare') {
            const k = th.t / th.dur;
            out.push({ x: th.x0 + (th.x1 - th.x0) * k, y: th.y0 + (th.y1 - th.y0) * k, r: 2 * S, color: [1, 0.35, 0.25] });
        }
    for (const f of s.fires)
        out.push({ x: (f.i % s.map.w + 0.5) * S, y: (Math.floor(f.i / s.map.w) + 0.5) * S, r: T.fire.lightR * S * (f.kind === 'barrel' ? 0.6 : 1), color: T.fire.light, fire: true });
    const w = s.inv.weapons[s.inv.active];
    if (w && ITEMS[w.id].melee?.kind === 'esword')
        out.push({ x: s.player.x, y: s.player.y, r: C.esword.light * S, color: [0.3, 0.85, 1] });
    for (const f of s.fx)
        if (f.kind === 'flame')
            out.push({ x: f.x1, y: f.y1, r: 3 * S, color: [1, 0.5, 0.15], fire: true });
    if (s.player.flashT > 0) {
        const k = s.player.flashT / C.flashTime;
        out.push({ x: lensX, y: lensY, r: C.flashLight * S * (0.5 + 0.5 * k), color: [1.3 * k + 0.2, 1.05 * k + 0.15, 0.7 * k + 0.1] });
    }
    return out;
}
