import { T } from "./tuning.js";
import { astar } from "./astar.js";
import { enumTile, tileAt, setTile, solidAt, opaqueAt, LOW, SOLID, doorGroup, doorKey } from "./tilemap.js";
import { next32 } from "./rng.js";
import { atan2, cos, hypot, sin } from "./dmath.js";
export const band = (a) => a.alert >= T.ai.bands.aggressive ? 'aggressive' : a.alert >= T.ai.bands.searching ? 'searching' : 'passive';
const S = T.TILE, A = T.ai;
const dist = (ax, ay, bx, by) => hypot(bx - ax, by - ay);
export function createAi() { return { aliens: [], stimuli: [], lastStimuli: [], hive: { lastPlayerX: 0, lastPlayerY: 0, lastPlayerT: -999, doorsSeenClosing: new Map(), doorHP: new Map() }, nextId: 1, log: [], corpses: [], regions: null, vents: null, goo: null, hot: {} }; }
export function spawnAlien(ai, type, x, y) {
    const a = { id: ai.nextId++, type, x, y, px: x, py: y, facing: 0, hp: A.types[type].hp, alert: 0, target: null, lastSeen: -999, los: 99, stimX: x, stimY: y, stimT: -999, homeX: x, homeY: y, path: [], pathI: 0, repathAt: 0, behave: 'idle', behaveT: 1, attackT: 0, chewT: 0, cue: null, cueT: 0, anim: 0, moving: false, infightWith: null, doorX: -1, doorY: -1, hitT: 0, hitDir: 0, vault: null, inVent: false, ventT: 0, ventIn: -1, ventOut: -1, destX: x, destY: y, emergeT: 0, look: 0, fed: false, feedX: 0, feedY: 0, goo: -1, pupated: false };
    ai.aliens.push(a);
    return a;
}
export function emit(ai, x, y, kind, loud, radius, tick, src, tell = false) { ai.stimuli.push({ x, y, loud, radius, kind, t: tick, src, tell }); }
export function lineOfSight(m, x0, y0, x1, y1) {
    const steps = Math.ceil(dist(x0, y0, x1, y1) / (S / 2)) || 1, ex = Math.floor(x1 / S), ey = Math.floor(y1 / S);
    for (let i = 1; i < steps; i++) {
        const t = i / steps, tx = Math.floor((x0 + (x1 - x0) * t) / S), ty = Math.floor((y0 + (y1 - y0) * t) / S);
        if ((tx !== ex || ty !== ey) && opaqueAt(m, tx, ty))
            return false;
    }
    return true;
}
const doorBetween = (m, x0, y0, x1, y1) => {
    const steps = Math.ceil(dist(x0, y0, x1, y1) / (S / 2)) || 1;
    for (let i = 1; i < steps; i++) {
        const t = i / steps, tt = tileAt(m, Math.floor((x0 + (x1 - x0) * t) / S), Math.floor((y0 + (y1 - y0) * t) / S));
        if (tt === enumTile.door || tt === enumTile.doorLocked)
            return true;
    }
    return false;
};
function walkable(m, x, y, canVault = true) { const t = tileAt(m, x, y); return !solidAt(m, x, y) || (canVault && LOW.has(t)) || t === enumTile.door; }
function flankGoal(m, a, p, gx, gy) {
    const F = A.flank, v = hypot(p.vx, p.vy);
    if (v > 5) {
        const lead = Math.min(F.lead, dist(a.x, a.y, p.x, p.y) / 80);
        for (let k = 1; k >= 0.25; k -= 0.25) {
            const x = p.x + p.vx * lead * k, y = p.y + p.vy * lead * k;
            if (walkable(m, Math.floor(x / S), Math.floor(y / S), false) && lineOfSight(m, p.x, p.y, x, y))
                return [x, y];
        }
        return [gx, gy];
    }
    const px = Math.floor(p.x / S), py = Math.floor(p.y / S);
    let best = null, bd = Infinity;
    for (let y = py - F.doorScan; y <= py + F.doorScan; y++)
        for (let x = px - F.doorScan; x <= px + F.doorScan; x++) {
            const t = tileAt(m, x, y);
            if (t !== enumTile.door && t !== enumTile.doorOpen)
                continue;
            const dd = hypot(x - px, y - py);
            if (dd < bd) {
                bd = dd;
                best = [x, y];
            }
        }
    if (!best || bd < 1.5)
        return [gx, gy];
    const k = 1 / bd, x = (best[0] + 0.5 + (px - best[0]) * k) * S, y = (best[1] + 0.5 + (py - best[1]) * k) * S;
    return walkable(m, Math.floor(x / S), Math.floor(y / S), false) ? [x, y] : [gx, gy];
}
let hot = {};
function repath(m, a, tx, ty, doorsOk = false) {
    const sx = Math.floor(a.x / S), sy = Math.floor(a.y / S), gx = Math.floor(tx / S), gy = Math.floor(ty / S);
    const p = astar(m.w, m.h, (x, y) => { const t = tileAt(m, x, y); if (!walkable(m, x, y))
        return Infinity; if (t === enumTile.door)
        return doorsOk ? A.doorPathCost : Infinity; return hot[y * m.w + x] ? 12 : LOW.has(t) ? 4 : t === enumTile.creep ? 0.9 : 1; }, sx, sy, gx, gy, 6000);
    a.path = p ?? [];
    a.pathI = p && p.length > 2 ? 2 : 0;
}
function clearLine(m, x0, y0, x1, y1, r) {
    const d = dist(x0, y0, x1, y1), n = Math.ceil(d / 4), nx = -(y1 - y0) / (d || 1), ny = (x1 - x0) / (d || 1);
    for (let i = 1; i <= n; i++) {
        const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
        for (const o of [-r, 0, r]) {
            const tt = tileAt(m, Math.floor((x + nx * o) / S), Math.floor((y + ny * o) / S));
            if (SOLID.has(tt) || LOW.has(tt))
                return false;
        }
    }
    return true;
}
function follow(m, a, speed, dt, onDoor) {
    if (a.vault) {
        const v = a.vault;
        v.t += dt / T.player.vaultTime;
        const k = Math.min(1, v.t);
        a.x = v.x0 + (v.x1 - v.x0) * k;
        a.y = v.y0 + (v.y1 - v.y0) * k;
        if (k >= 1)
            a.vault = null;
        a.moving = true;
        return false;
    }
    if (a.pathI >= a.path.length) {
        a.moving = false;
        return true;
    }
    for (let k = 0; k < 6 && a.pathI + 2 < a.path.length && clearLine(m, a.x, a.y, (a.path[a.pathI + 2] + 0.5) * S, (a.path[a.pathI + 3] + 0.5) * S, A.types[a.type].r); k++)
        a.pathI += 2;
    const tx = (a.path[a.pathI] + 0.5) * S, ty = (a.path[a.pathI + 1] + 0.5) * S, d = dist(a.x, a.y, tx, ty);
    const tile = tileAt(m, a.path[a.pathI], a.path[a.pathI + 1]);
    if (tile === enumTile.door || tile === enumTile.doorLocked) {
        if (!onDoor(a.path[a.pathI], a.path[a.pathI + 1])) {
            a.moving = false;
            if (a.behave !== 'breakdoor')
                a.path = [];
            return false;
        }
    }
    if (LOW.has(tile)) {
        const nx = a.path[a.pathI + 2] ?? a.path[a.pathI], ny = a.path[a.pathI + 3] ?? a.path[a.pathI + 1];
        a.vault = { t: 0, x0: a.x, y0: a.y, x1: (nx + 0.5) * S, y1: (ny + 0.5) * S };
        a.pathI += 4;
        a.facing = atan2(ty - a.y, tx - a.x);
        return false;
    }
    const step = Math.min(d, speed * dt);
    if (d > 0.01) {
        a.facing = a.look = atan2(ty - a.y, tx - a.x);
        a.x += (tx - a.x) / d * step;
        a.y += (ty - a.y) / d * step;
        a.anim += step;
    }
    if (d <= Math.max(1, speed * dt))
        a.pathI += 2;
    a.moving = true;
    return false;
}
const passable = (m, x, y) => { const t = tileAt(m, x, y); return !SOLID.has(t) || LOW.has(t); };
export function regionsOf(ai, m) {
    if (ai.regions instanceof Int32Array && ai.regions.length === m.w * m.h)
        return ai.regions;
    const R = new Int32Array(m.w * m.h).fill(-1), q = [];
    let id = 0;
    for (let i = 0; i < R.length; i++) {
        if (R[i] >= 0 || !passable(m, i % m.w, (i / m.w) | 0))
            continue;
        R[i] = id;
        q.push(i);
        while (q.length) {
            const j = q.pop(), x = j % m.w, y = (j / m.w) | 0;
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const nx = x + dx, ny = y + dy, k = ny * m.w + nx;
                if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h || R[k] >= 0 || !passable(m, nx, ny))
                    continue;
                R[k] = id;
                q.push(k);
            }
        }
        id++;
    }
    return ai.regions = R;
}
export const gooOf = (ai, m) => ai.goo ?? (ai.goo = Array.from(m.tiles.keys()).filter(i => m.tiles[i] === enumTile.creep));
const ventsOf = (ai, m) => ai.vents ?? (ai.vents = Array.from(m.tiles.keys()).filter(i => m.tiles[i] === enumTile.vent));
const tileOf = (m, x, y) => Math.floor(y / S) * m.w + Math.floor(x / S);
const centre = (m, i) => [((i % m.w) + 0.5) * S, (Math.floor(i / m.w) + 0.5) * S];
function walkGoal(ai, m, a, gx, gy) {
    const R = regionsOf(ai, m), ra = R[tileOf(m, a.x, a.y)], g = tileOf(m, gx, gy);
    if (gx < 0 || gy < 0 || gx >= m.w * S || gy >= m.h * S)
        return null;
    if (ra >= 0 && R[g] === ra)
        return [gx, gy];
    if (R[g] < 0)
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const n = g + dy * m.w + dx;
            if (R[n] === ra)
                return centre(m, n);
        }
    return null;
}
function ventRoute(ai, m, a, gx, gy) {
    if (!A.types[a.type].vent || gx < 0 || gy < 0 || gx >= m.w * S || gy >= m.h * S)
        return null;
    const R = regionsOf(ai, m), ra = R[tileOf(m, a.x, a.y)], g = tileOf(m, gx, gy);
    let rg = R[g];
    if (rg < 0)
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const n = g + dy * m.w + dx;
            if (R[n] >= 0 && R[n] !== ra) {
                rg = R[n];
                break;
            }
        }
    if (ra < 0 || rg < 0 || ra === rg)
        return null;
    let entry = -1, exit = -1, de = Infinity, dx = Infinity;
    for (const v of ventsOf(ai, m)) {
        const [vx, vy] = centre(m, v);
        if (R[v] === ra) {
            const d = dist(a.x, a.y, vx, vy);
            if (d < de) {
                de = d;
                entry = v;
            }
        }
        else if (R[v] === rg) {
            const d = dist(gx, gy, vx, vy);
            if (d < dx) {
                dx = d;
                exit = v;
            }
        }
    }
    return entry >= 0 && exit >= 0 ? [entry, exit] : null;
}
function startVent(m, a, route, destX, destY) {
    a.ventIn = route[0];
    a.ventOut = route[1];
    a.destX = destX;
    a.destY = destY;
    a.behave = 'toVent';
    const [vx, vy] = centre(m, route[0]);
    repath(m, a, vx, vy);
    if (!a.path.length && tileOf(m, a.x, a.y) !== route[0])
        a.behave = 'idle';
}
const rnd = (env) => { const [v, n] = next32(env.rng.v); env.rng.v = n; return v; };
const inCone = (a, tx, ty, coneDeg) => { const ang = atan2(ty - a.y, tx - a.x); let d = Math.abs(ang - a.facing); if (d > Math.PI)
    d = 2 * Math.PI - d; return d <= coneDeg / 2 * Math.PI / 180; };
export function stepAi(ai, env, dt) {
    hot = ai.hot ?? {};
    const m = env.map, ps = env.players, tick = env.tick, now = tick / T.SIM_HZ;
    const preyOf = (a) => { if (a.prey !== undefined && ps[a.prey]?.alive)
        return a.prey; let best = 0, bd = Infinity; ps.forEach((q, i) => { const d = dist(a.x, a.y, q.x, q.y); if (q.alive && d < bd) {
        bd = d;
        best = i;
    } }); return best; };
    const wardens = ai.aliens.filter(w => w.type === 'broodwarden'), boost = (a) => wardens.some(w => w !== a && dist(a.x, a.y, w.x, w.y) < A.brood.buffR) ? A.brood.buff : 1;
    const wasAggr = new Set(ai.aliens.filter(a => band(a) === 'aggressive'));
    for (const st of ai.stimuli)
        for (const a of ai.aliens) {
            if (st.src === a.id || st.tell)
                continue;
            const d = dist(a.x, a.y, st.x, st.y);
            if (d > st.radius)
                continue;
            let gain = st.loud * (1 - d / st.radius) * T.stim.typeWeight[st.kind];
            if (st.kind === 'sound' && doorBetween(m, a.x, a.y, st.x, st.y))
                gain *= T.stim.door;
            if (st.kind === 'light' && !lineOfSight(m, a.x, a.y, st.x, st.y))
                continue;
            if (tileAt(m, Math.floor(a.x / S), Math.floor(a.y / S)) === enumTile.creep)
                gain *= T.stim.creep;
            if (a.behave === 'feed')
                gain *= T.stim.feeding;
            gain *= boost(a);
            if (gain <= 0)
                continue;
            const cap = (st.kind === 'sound' || st.kind === 'light') ? A.bands.aggressive - 1 : 100;
            const before = band(a);
            a.alert = Math.min(Math.max(a.alert, cap), a.alert + gain);
            if (gain >= (a.stimT >= 0 ? st.loud * 0.3 : 0) || now - a.stimT > 2) {
                a.stimX = st.x;
                a.stimY = st.y;
                a.stimT = now;
            }
            if (st.kind === 'damage' && st.src === undefined) {
                a.target = 0;
                a.lastSeen = tick;
            }
            if (band(a) !== before && band(a) !== 'passive' && a.behave !== 'chase') {
                a.behave = 'investigate';
                a.repathAt = 0;
                if (band(a) === 'searching') {
                    a.cue = 'search';
                    a.cueT = A.cueTime;
                    ai.log.push(`${tick} #${a.id} searching`);
                }
            }
        }
    ai.lastStimuli.push(...ai.stimuli);
    ai.stimuli = [];
    if (ai.lastStimuli.length > 200)
        ai.lastStimuli.splice(0, ai.lastStimuli.length - 200);
    const before = new Map(ai.aliens.map(a => [a, a.facing]));
    for (const a of ai.aliens) {
        a.px = a.x;
        a.py = a.y;
        const ty = A.types[a.type], b = band(a), aggressiveBefore = wasAggr.has(a);
        if (a.inVent) {
            a.moving = false;
            a.ventT -= dt;
            a.cueT -= dt;
            const [ix, iy] = centre(m, a.ventIn), [ox, oy] = centre(m, a.ventOut), total = dist(ix, iy, ox, oy) / A.ventSpeed + 0.3, k = Math.max(0, Math.min(1, 1 - a.ventT / total));
            if (Math.floor(a.ventT / A.ventSkitterEvery) !== Math.floor((a.ventT + dt) / A.ventSkitterEvery))
                emit(ai, ix + (ox - ix) * k, iy + (oy - iy) * k, 'sound', A.ventSkitter[0], A.ventSkitter[1], tick, a.id, true);
            if (a.ventT <= 0) {
                a.inVent = false;
                a.x = a.px = ox;
                a.y = a.py = oy;
                a.emergeT = A.emergeTime;
                a.path = [];
                a.repathAt = 0;
                emit(ai, ox, oy, 'sound', A.ventRattle[0], A.ventRattle[1], tick, a.id, true);
                const nb0 = band(a);
                if (nb0 === 'passive') {
                    a.homeX = a.destX;
                    a.homeY = a.destY;
                    repath(m, a, a.destX, a.destY);
                    a.behave = a.path.length ? 'wander' : 'idle';
                    a.behaveT = 1;
                }
                else
                    a.behave = nb0 === 'aggressive' ? 'chase' : 'investigate';
                ai.log.push(`${tick} #${a.id} out of a vent`);
            }
            continue;
        }
        let sees = false, who = preyOf(a), p = ps[who];
        for (let k = 0; k < ps.length && !sees; k++) {
            const qi = (who + k) % ps.length, q = ps[qi];
            if (q.alive && !q.hidden && !q.veiled) {
                const d = dist(a.x, a.y, q.x, q.y), range = q.lit ? ty.range[0] : ty.range[1];
                if (d <= range && inCone(a, q.x, q.y, ty.cone) && lineOfSight(m, a.x, a.y, q.x, q.y)) {
                    sees = true;
                    who = qi;
                    p = q;
                    if (ps.length > 1)
                        a.prey = qi;
                    a.alert = Math.min(100, a.alert + (p.lit ? T.stim.sightLit : T.stim.sightDark) * boost(a) * dt);
                    a.target = 0;
                    a.lastSeen = tick;
                    a.los = 0;
                    ai.hive.lastPlayerX = p.x;
                    ai.hive.lastPlayerY = p.y;
                    ai.hive.lastPlayerT = now;
                    if (band(a) !== 'passive') {
                        a.stimX = p.x;
                        a.stimY = p.y;
                        a.stimT = now;
                        a.facing = atan2(p.y - a.y, p.x - a.x);
                    }
                }
            }
        }
        if (!sees && p.alive && !p.hidden) {
            const d = dist(a.x, a.y, p.x, p.y);
            if (d < T.stim.sense + ty.r) {
                a.alert = Math.min(100, a.alert + T.stim.senseGain * (p.lit ? 1 : 0.5) * dt);
                a.facing = atan2(p.y - a.y, p.x - a.x);
                a.stimX = p.x;
                a.stimY = p.y;
                a.stimT = now;
            }
        }
        if (!sees)
            a.los += dt;
        if (sees && b === 'passive' && band(a) === 'searching') {
            a.cue = 'search';
            a.cueT = A.cueTime;
            ai.log.push(`${tick} #${a.id} searching (saw)`);
        }
        const nb = band(a);
        if (nb === 'passive')
            a.alert = Math.max(0, a.alert - A.decay.passive * dt);
        else if (nb === 'searching') {
            if (now - a.stimT > A.decay.investigatePause)
                a.alert = Math.max(0, a.alert - A.decay.searching * dt);
        }
        else if (!sees && a.los >= A.aggroTimeout && a.behave !== 'breakdoor') {
            a.alert = A.aggroDropTo;
            a.stimX = ai.hive.lastPlayerX;
            a.stimY = ai.hive.lastPlayerY;
            a.stimT = now;
            a.behave = 'investigate';
            a.repathAt = 0;
            ai.log.push(`${tick} #${a.id} lost target → searching`);
        }
        if (!aggressiveBefore && band(a) === 'aggressive') {
            a.cue = 'aggro';
            a.cueT = A.cueTime;
            emit(ai, a.x, a.y, 'pheromone', T.stim.src.scream[0], T.stim.src.scream[1], tick, a.id);
            a.behave = 'chase';
            a.repathAt = 0;
            ai.log.push(`${tick} #${a.id} AGGRESSIVE`);
        }
        if (nb !== 'passive' && band(a) === 'passive' && a.behave !== 'infight' && a.behave !== 'frustrated' && a.type !== 'mite' && a.type !== 'hivemind') {
            const other = ai.aliens.find(o => o !== a && !o.inVent && o.type !== 'hivemind' && dist(a.x, a.y, o.x, o.y) < 160 && inCone(a, o.x, o.y, ty.cone) && lineOfSight(m, a.x, a.y, o.x, o.y));
            if (other) {
                a.behave = 'infight';
                a.infightWith = other.id;
                a.behaveT = A.infight.duration;
                ai.log.push(`${tick} #${a.id} infight #${other.id}`);
            }
            else {
                a.behave = 'frustrated';
                a.behaveT = A.frustrated;
                ai.log.push(`${tick} #${a.id} frustrated`);
            }
        }
        const cur = band(a);
        a.aggroT = cur === 'aggressive' ? (a.aggroT ?? 0) + dt : 0;
        const r0 = Math.min(1, a.aggroT / A.chaseRamp), rampK = r0 * r0;
        let spd = cur === 'aggressive' ? ty.spd[1] + (ty.spd[3] - ty.spd[1]) * rampK : cur === 'searching' ? ty.spd[1] + (ty.spd[2] - ty.spd[1]) * (a.alert - A.bands.searching) / (A.bands.aggressive - A.bands.searching) : ty.spd[0];
        if (a.chewT > 0)
            spd *= 1 - A.chew;
        a.moving = false;
        a.behaveT -= dt;
        a.attackT -= dt;
        a.chewT -= dt;
        a.cueT -= dt;
        if (cur !== 'aggressive')
            a.windT = 0;
        const onDoor = (dx, dy) => {
            const t = tileAt(m, dx, dy);
            if (t === enumTile.doorLocked)
                return false;
            if (t !== enumTile.door)
                return true;
            if (cur === 'aggressive' && ty.door > 0) {
                if (a.behave !== 'breakdoor') {
                    a.behave = 'breakdoor';
                    a.doorX = dx;
                    a.doorY = dy;
                    ai.log.push(`${tick} #${a.id} breaking door`);
                }
                return false;
            }
            if (cur === 'searching') {
                a.stimX = a.x;
                a.stimY = a.y;
                a.facing = atan2((dy + 0.5) * S - a.y, (dx + 0.5) * S - a.x);
                emit(ai, (dx + 0.5) * S, (dy + 0.5) * S, 'sound', A.scratch[0], A.scratch[1], tick, a.id, true);
            }
            return false;
        };
        if (a.emergeT > 0) {
            a.emergeT -= dt;
            continue;
        }
        if (a.behave === 'toVent') {
            if (cur === 'aggressive' && sees) {
                a.behave = 'chase';
                a.repathAt = 0;
            }
            else {
                if (follow(m, a, spd, dt, onDoor)) {
                    const [vx, vy] = centre(m, a.ventIn);
                    a.x = vx;
                    a.y = vy;
                    a.inVent = true;
                    a.ventT = dist(vx, vy, ...centre(m, a.ventOut)) / A.ventSpeed + 0.3;
                    emit(ai, vx, vy, 'sound', A.ventRattle[0], A.ventRattle[1], tick, a.id, true);
                    ai.log.push(`${tick} #${a.id} into a vent`);
                }
                else if (!a.path.length) {
                    a.behave = 'idle';
                    a.behaveT = 1;
                }
                continue;
            }
        }
        if (a.behave === 'breakdoor') {
            const key = doorKey(m, a.doorX, a.doorY), t = tileAt(m, a.doorX, a.doorY);
            if (t !== enumTile.door) {
                a.behave = 'chase';
                a.repathAt = 0;
                continue;
            }
            const near = doorGroup(m, a.doorX, a.doorY).reduce((b, [gx, gy]) => Math.min(b, dist(a.x, a.y, (gx + 0.5) * S, (gy + 0.5) * S)), Infinity);
            if (near > S * 1.3) {
                if (a.repathAt <= now) {
                    a.repathAt = now + 0.5;
                    repath(m, a, (a.doorX + 0.5) * S, (a.doorY + 0.5) * S, true);
                }
                follow(m, a, ty.spd[3], dt, () => false);
                continue;
            }
            const hp = (ai.hive.doorHP.get(key) ?? A.doorBreakHP) - (ty.door > 0 ? A.doorBreakHP / ty.door * dt : 0);
            ai.hive.doorHP.set(key, hp);
            a.facing = atan2((a.doorY + 0.5) * S - a.y, (a.doorX + 0.5) * S - a.x);
            if (tick % 30 === 0)
                emit(ai, (a.doorX + 0.5) * S, (a.doorY + 0.5) * S, 'sound', T.stim.src.doorBreak[0], T.stim.src.doorBreak[1], tick, a.id);
            if (hp <= 0) {
                for (const [gx, gy] of doorGroup(m, a.doorX, a.doorY))
                    setTile(m, gx, gy, enumTile.doorOpen);
                ai.regions = null;
                ai.hive.doorHP.delete(key);
                ai.hive.doorsSeenClosing.delete(key);
                env.onDoorChanged();
                a.behave = 'chase';
                a.repathAt = 0;
                ai.log.push(`${tick} #${a.id} door broken`);
            }
            if (ty.door === 0) {
                a.behave = 'investigate';
                a.alert = Math.min(a.alert, A.aggroDropTo);
            }
            continue;
        }
        if (a.behave === 'infight') {
            const o = ai.aliens.find(o => o.id === a.infightWith);
            if (!o || a.behaveT <= 0) {
                a.behave = 'idle';
                a.behaveT = 1;
                a.infightWith = null;
                continue;
            }
            a.facing = atan2(o.y - a.y, o.x - a.x);
            if (dist(a.x, a.y, o.x, o.y) > ty.r + A.types[o.type].r + 4) {
                if (a.repathAt <= now) {
                    repath(m, a, o.x, o.y);
                    a.repathAt = now + 0.5;
                }
                follow(m, a, ty.spd[1], dt, () => false);
            }
            else if (a.attackT <= 0) {
                o.hp -= A.infight.damage;
                a.attackT = 1 / A.infight.rate;
                emit(ai, a.x, a.y, 'sound', T.stim.src.infight[0], T.stim.src.infight[1], tick, a.id);
            }
            continue;
        }
        if (a.behave === 'frustrated') {
            if (a.behaveT <= 0) {
                a.behave = 'idle';
                a.behaveT = 1;
            }
            continue;
        }
        if (cur !== 'aggressive')
            a.leapt = false;
        if ((a.lureT ?? 0) > 0 && !a.inVent) {
            a.lureT -= dt;
            if (tick - a.lastSeen < 30)
                a.lureT = 0;
            else if (dist(a.x, a.y, a.lureX, a.lureY) > A.lure.near) {
                a.alert = Math.max(a.alert, A.bands.aggressive + 5);
                if (a.repathAt <= now) {
                    a.repathAt = now + 0.5;
                    repath(m, a, a.lureX, a.lureY);
                }
                follow(m, a, ty.spd[3], dt, onDoor);
                continue;
            }
            else {
                a.lureT = 0;
                a.alert = (A.bands.searching + A.bands.aggressive) / 2;
                a.stimX = a.lureX;
                a.stimY = a.lureY;
                a.stimT = now;
                a.calmAt = now + A.lure.search;
                a.behave = 'investigate';
                a.behaveT = 0;
                a.cue = 'search';
                a.cueT = A.cueTime;
            }
        }
        if (a.calmAt !== undefined && now > a.calmAt) {
            a.calmAt = undefined;
            if (tick - a.lastSeen > 60)
                a.alert = Math.min(a.alert, A.bands.searching - 10);
        }
        const strikeHit = () => {
            const K = A.strike, reach = ty.r + T.player.radius + A.attackReach;
            let da = atan2(p.y - a.y, p.x - a.x) - a.facing;
            da = Math.abs(atan2(sin(da), cos(da)));
            const lands = p.alive && !p.hidden && dist(a.x, a.y, p.x, p.y) <= reach + K.slack && da <= K.arc / 2 * Math.PI / 180 && lineOfSight(m, a.x, a.y, p.x, p.y);
            if (!lands) {
                emit(ai, a.x, a.y, 'sound', T.stim.src.meleeSwing[0], T.stim.src.meleeSwing[1], tick, a.id, true);
                a.attackT = Math.max(a.attackT, 0.5);
                return;
            }
            if (ty.grapple) {
                if (p.grappledBy < 0) {
                    env.onGrapple(a, who);
                    a.attackT = A.grapple.time + A.grapple.stun;
                }
                return;
            }
            env.onPlayerHit(ty.dmg, a.x, a.y, a.type, who);
            a.chewT = A.chewTime;
            emit(ai, a.x, a.y, 'sound', T.stim.src.meleeHit[0], T.stim.src.meleeHit[1], tick, a.id);
        };
        if ((a.hopT ?? 0) > 0) {
            a.hopT -= dt;
            const nx = a.x + a.hopVx * dt, ny = a.y + a.hopVy * dt;
            const stop = hypot(p.x - nx, p.y - ny) < ty.r + T.player.radius;
            if (!stop && clearLine(m, a.x, a.y, nx, ny, ty.r)) {
                a.x = nx;
                a.y = ny;
                a.moving = true;
                a.anim += hypot(a.hopVx, a.hopVy) * dt;
            }
            else
                a.hopT = 0;
            if (a.hopT <= 0 && a.lunging) {
                a.lunging = false;
                a.hopT = 0;
                strikeHit();
            }
            continue;
        }
        if (cur === 'aggressive' && p.alive) {
            let gx = a.lastSeen === tick ? p.x : ai.hive.lastPlayerX, gy = a.lastSeen === tick ? p.y : ai.hive.lastPlayerY;
            const d = dist(a.x, a.y, p.x, p.y);
            if (a.type === 'stalker' && d > A.flank.from && now - ai.hive.lastPlayerT < 3)
                [gx, gy] = flankGoal(m, a, p, gx, gy);
            if (p.grappledBy === a.id) {
                a.facing = atan2(p.y - a.y, p.x - a.x);
                continue;
            }
            const reach = ty.r + T.player.radius + A.attackReach, wind = A.wind[a.type] ?? 0.4;
            if ((a.windT ?? 0) > 0) {
                a.windT -= dt;
                if (a.windT > 0)
                    continue;
                a.windT = 0;
                a.strikeAt = tick;
                a.attackT = 1 / ty.rate;
                if (ty.ranged && !a.windMelee) {
                    env.onSpit(a, atan2(p.y - a.y, p.x - a.x));
                    continue;
                }
                const K = A.strike, gap = Math.max(0, dist(a.x, a.y, p.x, p.y) - ty.r - T.player.radius);
                if (gap > 1 && rnd(env) < K.lungeChance) {
                    const lu = Math.min(K.lunge, gap);
                    a.hopVx = cos(a.facing) * lu / K.lungeTime;
                    a.hopVy = sin(a.facing) * lu / K.lungeTime;
                    a.hopT = K.lungeTime;
                    a.lunging = true;
                    continue;
                }
                strikeHit();
                continue;
            }
            const reachOf = (x) => A.types[x.type].r + T.player.radius + A.attackReach;
            const hop = (ang, dd, time) => { a.hopVx = cos(ang) * dd / time; a.hopVy = sin(ang) * dd / time; a.hopT = time; a.path = []; };
            const toP = atan2(p.y - a.y, p.x - a.x), H = A.hop;
            if (a.type === 'stalker' && tick - a.lastSeen < 30 && d < H.stalker.range && d > reachOf(a) && (a.windT ?? 0) <= 0) {
                a.hopCd = (a.hopCd ?? H.stalker.every * 0.3) - dt;
                if (a.hopCd <= 0) {
                    a.hopSide = -(a.hopSide ?? 1);
                    a.hopCd = H.stalker.every * (0.7 + 0.6 * rnd(env));
                    a.facing = toP;
                    hop(toP + a.hopSide * Math.PI * 0.42, H.stalker.dist, H.stalker.time);
                    continue;
                }
            }
            if (ty.ranged && tick - a.lastSeen < 30 && !a.leapt) {
                a.leapt = true;
                a.facing = toP;
                a.hopCd = H.reposition[0] + rnd(env) * (H.reposition[1] - H.reposition[0]);
                hop(toP + Math.PI, H.leap.dist, H.leap.time);
                continue;
            }
            if (ty.ranged && sees && (a.windT ?? 0) <= 0) {
                a.hopCd = (a.hopCd ?? 4) - dt;
                if (a.hopCd <= 0) {
                    a.hopCd = H.reposition[0] + rnd(env) * (H.reposition[1] - H.reposition[0]);
                    hop(toP + Math.PI + (rnd(env) < 0.5 ? -1 : 1) * (0.9 + 0.6 * rnd(env)), H.leap.dist * 0.7, H.leap.time);
                    continue;
                }
            }
            const start = (melee) => { a.windT = wind; a.windMelee = melee; a.facing = atan2(p.y - a.y, p.x - a.x); a.path = []; };
            if (ty.ranged && sees && d <= ty.ranged.max) {
                a.facing = atan2(p.y - a.y, p.x - a.x);
                a.path = [];
                let cornered = false;
                if (d < ty.ranged.min) {
                    cornered = true;
                    for (const off of [0, 0.7, -0.7, 1.4, -1.4]) {
                        const q = a.facing + Math.PI + off, ax = a.x + cos(q) * spd * dt, ay = a.y + sin(q) * spd * dt;
                        if (clearLine(m, a.x, a.y, ax, ay, ty.r)) {
                            a.x = ax;
                            a.y = ay;
                            a.moving = true;
                            a.anim += spd * dt;
                            cornered = false;
                            break;
                        }
                    }
                }
                if (cornered && d <= reach) {
                    if (a.attackT <= 0)
                        start(true);
                    continue;
                }
                if (a.attackT <= 0 && d >= ty.ranged.min * 0.5)
                    start(false);
                continue;
            }
            if (d <= reach && sees) {
                a.facing = atan2(p.y - a.y, p.x - a.x);
                if (ty.grapple && p.grappledBy >= 0)
                    continue;
                if (a.attackT <= 0)
                    start(true);
            }
            else {
                if (a.repathAt <= now) {
                    a.repathAt = now + 0.35;
                    const g = walkGoal(ai, m, a, gx, gy);
                    if (g)
                        repath(m, a, g[0], g[1]);
                    else if (ty.door > 0)
                        repath(m, a, gx, gy, true);
                    else {
                        const v = ventRoute(ai, m, a, gx, gy);
                        if (v) {
                            startVent(m, a, v, gx, gy);
                            continue;
                        }
                        a.path = [];
                    }
                }
                if (follow(m, a, spd, dt, onDoor) && !sees && ty.door > 0) {
                    for (const key of ai.hive.doorsSeenClosing.keys()) {
                        const dx = key % m.w, dy = Math.floor(key / m.w);
                        if (tileAt(m, dx, dy) === enumTile.door && doorGroup(m, dx, dy).some(([x, y]) => dist(a.x, a.y, (x + 0.5) * S, (y + 0.5) * S) < 4 * S)) {
                            a.behave = 'breakdoor';
                            a.doorX = dx;
                            a.doorY = dy;
                            ai.log.push(`${tick} #${a.id} breaking the door it saw close`);
                            break;
                        }
                    }
                }
            }
            continue;
        }
        if (cur === 'searching') {
            if (a.behave !== 'investigate') {
                a.behave = 'investigate';
                a.behaveT = 0;
                a.repathAt = 0;
            }
            const d = dist(a.x, a.y, a.stimX, a.stimY);
            if (d > S) {
                if (a.repathAt <= now) {
                    a.repathAt = now + 0.6;
                    a.behaveT = A.decay.investigatePause;
                    const g = walkGoal(ai, m, a, a.stimX, a.stimY);
                    if (g)
                        repath(m, a, g[0], g[1]);
                    else {
                        const v = ventRoute(ai, m, a, a.stimX, a.stimY);
                        if (v) {
                            startVent(m, a, v, a.stimX, a.stimY);
                            continue;
                        }
                        repath(m, a, a.stimX, a.stimY, true);
                    }
                    if (!a.path.length) {
                        a.stimX = a.x;
                        a.stimY = a.y;
                    }
                }
                if (follow(m, a, spd, dt, onDoor))
                    a.behaveT = Math.min(a.behaveT, A.decay.investigatePause);
            }
            else {
                if (a.behaveT <= -1) {
                    a.behaveT = 0;
                    a.repathAt = 0;
                    for (let k = 0; k < 6; k++) {
                        const sx = Math.floor(a.x / S + (rnd(env) - 0.5) * 4), sy = Math.floor(a.y / S + (rnd(env) - 0.5) * 4);
                        if (sx > 0 && sy > 0 && sx < m.w - 1 && sy < m.h - 1 && !solidAt(m, sx, sy)) {
                            a.stimX = (sx + 0.5) * S;
                            a.stimY = (sy + 0.5) * S;
                            break;
                        }
                    }
                }
                if (!sees)
                    a.facing = a.look + sin(now * 1.7 + a.id) * 1.2;
            }
            continue;
        }
        if (a.behave === 'feed') {
            const c = ai.corpses.find(c => c.meat > 0 && !c.burn && Math.abs(c.x - a.feedX) < 1 && Math.abs(c.y - a.feedY) < 1);
            if (!c) {
                a.behave = 'idle';
                a.behaveT = 1;
                continue;
            }
            if (dist(a.x, a.y, c.x, c.y) > ty.r + 4) {
                if (a.repathAt <= now) {
                    repath(m, a, c.x, c.y);
                    a.repathAt = now + 1;
                    if (!a.path.length) {
                        a.behave = 'idle';
                        a.behaveT = 2;
                        continue;
                    }
                }
                follow(m, a, spd, dt, onDoor);
                continue;
            }
            a.facing = atan2(c.y - a.y, c.x - a.x);
            a.anim += dt * 6;
            c.meat -= dt / A.feedTime;
            if (c.meat <= 0) {
                c.meat = 0;
                a.fed = true;
                a.behave = 'idle';
                a.behaveT = 0.5;
                ai.log.push(`${tick} #${a.id} fed`);
            }
            continue;
        }
        if (a.behave === 'toGoo') {
            if (tileOf(m, a.x, a.y) === a.goo || follow(m, a, spd, dt, onDoor)) {
                if (tileAt(m, a.goo % m.w, Math.floor(a.goo / m.w)) === enumTile.creep && dist(a.x, a.y, ...centre(m, a.goo)) < S) {
                    env.onPupate(a);
                    a.pupated = true;
                    a.hp = 0;
                    ai.log.push(`${tick} #${a.id} pupated`);
                    continue;
                }
            }
            if (!a.path.length) {
                a.behave = 'idle';
                a.behaveT = A.fedRetry;
            }
            continue;
        }
        if (a.behave === 'idle' && a.behaveT <= 0 && ty.feeds && !a.fed) {
            const c = ai.corpses.find(c => c.meat > 0 && !c.burn && dist(a.x, a.y, c.x, c.y) < A.corpseSee && lineOfSight(m, a.x, a.y, c.x, c.y));
            if (c && !ai.aliens.some(o => o !== a && o.behave === 'feed' && o.feedX === c.x && o.feedY === c.y)) {
                a.behave = 'feed';
                a.feedX = c.x;
                a.feedY = c.y;
                a.repathAt = 0;
                ai.log.push(`${tick} #${a.id} going to feed`);
                continue;
            }
        }
        if (a.behave === 'idle' && a.behaveT <= 0 && a.fed && ty.pupates) {
            const R = regionsOf(ai, m), ra = R[tileOf(m, a.x, a.y)];
            let best = -1, bd = Infinity, viaVent = -1, vd = Infinity;
            for (const g of gooOf(ai, m)) {
                const [gx, gy] = centre(m, g), d0 = dist(a.x, a.y, gx, gy);
                if (R[g] === ra) {
                    if (d0 < bd) {
                        bd = d0;
                        best = g;
                    }
                }
                else if (d0 < vd) {
                    vd = d0;
                    viaVent = g;
                }
            }
            if (best >= 0) {
                a.goo = best;
                repath(m, a, ...centre(m, best));
                if (a.path.length || tileOf(m, a.x, a.y) === best) {
                    a.behave = 'toGoo';
                    continue;
                }
            }
            else if (viaVent >= 0) {
                const [gx, gy] = centre(m, viaVent), v = ventRoute(ai, m, a, gx, gy);
                if (v) {
                    startVent(m, a, v, gx, gy);
                    if (a.behave === 'toVent')
                        continue;
                }
            }
            a.behaveT = A.fedRetry;
        }
        if (a.behave === 'idle' && rnd(env) < dt / A.lookEvery)
            a.look = a.facing + (rnd(env) - 0.5) * 2.8;
        if (a.behave === 'idle')
            a.facing = a.look;
        if (a.behave === 'idle' && a.patrol?.length && a.behaveT <= 0) {
            const k = a.patrolI = ((a.patrolI ?? -1) + 1) % (a.patrol.length / 2);
            repath(m, a, a.patrol[k * 2], a.patrol[k * 2 + 1]);
            a.homeX = a.patrol[k * 2];
            a.homeY = a.patrol[k * 2 + 1];
            a.behave = 'wander';
            continue;
        }
        if (a.behave === 'idle') {
            if (a.behaveT <= 0) {
                a.behave = 'wander';
                a.repathAt = 0;
                const rooms = m.rooms;
                if (rooms?.length && rnd(env) < A.roamChance) {
                    const rm = rooms[Math.floor(rnd(env) * rooms.length)], rx = rm.x + Math.floor(rnd(env) * rm.w), ry = rm.y + Math.floor(rnd(env) * rm.h), [cx, cy] = [(rx + 0.5) * S, (ry + 0.5) * S];
                    if (!solidAt(m, rx, ry)) {
                        const g = walkGoal(ai, m, a, cx, cy);
                        if (g) {
                            repath(m, a, cx, cy);
                            if (a.path.length) {
                                a.homeX = cx;
                                a.homeY = cy;
                                continue;
                            }
                        }
                        else {
                            const v = ventRoute(ai, m, a, cx, cy);
                            if (v) {
                                startVent(m, a, v, cx, cy);
                                if (a.behave === 'toVent')
                                    continue;
                                a.behave = 'wander';
                            }
                        }
                    }
                }
                let gx = a.homeX + (rnd(env) - 0.5) * 2 * A.leash * S, gy = a.homeY + (rnd(env) - 0.5) * 2 * A.leash * S;
                if (rnd(env) < A.driftChance) {
                    const o = ai.aliens.filter(o => o !== a && dist(a.x, a.y, o.x, o.y) < 12 * S);
                    if (o.length) {
                        const k = o[Math.floor(rnd(env) * o.length)];
                        gx = k.x + (rnd(env) - 0.5) * 2 * S;
                        gy = k.y + (rnd(env) - 0.5) * 2 * S;
                    }
                }
                const tx = Math.max(1, Math.min(m.w - 2, Math.floor(gx / S))), tyy = Math.max(1, Math.min(m.h - 2, Math.floor(gy / S)));
                if (walkable(m, tx, tyy, false))
                    repath(m, a, (tx + 0.5) * S, (tyy + 0.5) * S, false);
                else
                    a.path = [];
                if (!a.path.length) {
                    a.behave = 'idle';
                    a.behaveT = A.wanderPause[0] + rnd(env) * (A.wanderPause[1] - A.wanderPause[0]);
                }
            }
            continue;
        }
        if (a.behave === 'wander' || a.behave === 'investigate') {
            if (follow(m, a, spd, dt, onDoor) || !a.path.length) {
                a.behave = 'idle';
                a.behaveT = A.wanderPause[0] + rnd(env) * (A.wanderPause[1] - A.wanderPause[0]);
            }
            continue;
        }
        a.behave = 'idle';
        a.behaveT = 1;
    }
    for (const [a, f0] of before) {
        if (a.inVent)
            continue;
        const rate = A.turn[band(a)] * dt;
        let d = a.facing - f0;
        d = atan2(sin(d), cos(d));
        const f = f0 + Math.max(-rate, Math.min(rate, d));
        a.facing = atan2(sin(f), cos(f));
    }
    for (let i = ai.aliens.length - 1; i >= 0; i--)
        if (ai.aliens[i].hp <= 0) {
            const a = ai.aliens[i];
            if (a.pupated) {
                ai.aliens.splice(i, 1);
                continue;
            }
            ai.log.push(`${tick} #${a.id} died`);
            ai.corpses.push({ type: a.type, x: a.x, y: a.y, facing: a.facing, t: 0, meat: a.type === 'mite' ? 0.25 : 1, spores: 0 });
            ai.aliens.splice(i, 1);
        }
    if (ai.log.length > 200)
        ai.log.splice(0, ai.log.length - 200);
}
export function noteDoorClosed(ai, m, dx, dy, tick) {
    const key = doorKey(m, dx, dy), cx = (dx + 0.5) * S, cy = (dy + 0.5) * S;
    for (const a of ai.aliens)
        if (dist(a.x, a.y, cx, cy) < A.types[a.type].range[0] * 1.5 && lineOfSight(m, a.x, a.y, cx, cy)) {
            ai.hive.doorsSeenClosing.set(key, tick);
            return;
        }
}
export function ejectFromDoor(m, e, dx, dy, r) {
    const inTile = e.x + r > dx * S && e.x - r < (dx + 1) * S && e.y + r > dy * S && e.y - r < (dy + 1) * S;
    if (!inTile)
        return false;
    const opts = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([ox, oy]) => !solidAt(m, dx + ox, dy + oy)).map(([ox, oy]) => ({ x: (dx + ox + 0.5) * S, y: (dy + oy + 0.5) * S }));
    if (!opts.length)
        return false;
    opts.sort((p, q) => dist(p.x, p.y, e.x, e.y) - dist(q.x, q.y, e.x, e.y));
    e.x = opts[0].x;
    e.y = opts[0].y;
    return true;
}
