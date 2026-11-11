import { T } from "./tuning.js";
import { tileAt, setTile, enumTile, SOLID, doorGroup, doorKey, visionSegments } from "./tilemap.js";
import { damageAlien } from "./combat.js";
import { spawnAlien, emit, band, gooOf, lineOfSight } from "./ai.js";
import { ITEMS, make, rollItem, give, getSlot, setSlot } from "./items.js";
import { addPupa } from "./infection.js";
import { stream, next32 } from "./rng.js";
import { THEMES } from "./themes.js";
import { forSeats, players } from "./sim.js";
import { atan2, cos, hypot, sin } from "./dmath.js";
const S = T.TILE, D = T.deck;
export function setupDeck(s) {
    const d = s.map, r = stream(s.seed, `deck-extras${s.floor}`), ev = THEMES[s.theme].event;
    if (d.dock) {
        s.pod = { state: 'idle', t: 0 };
        s.ai.hive.doorHP.set(doorKey(d, ...d.dock.door[0]), T.dock.podDoorHP);
    }
    s.event = { id: ev, dark: false, hunter: -1, announced: false, x: -1, y: -1, used: false, spots: [], t: 0, burst: 0, emp: 0, lightWas: true };
    const bodies = s.ai.corpses.filter(c => c.type === 'crew');
    for (const c of bodies) {
        const tx = Math.floor(c.x / S), ty = Math.floor(c.y / S);
        if (s.containers.some(k => k.x === tx && k.y === ty))
            continue;
        const items = r.next() < D.bodyLoot ? [rollItem(r, s.floor, s.theme)] : [];
        s.containers.push({ x: tx, y: ty, items, opened: false, body: true });
    }
    const bodyBox = () => s.containers.filter(k => k.body)[0] ?? r.pick(s.containers);
    const open = (k) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const t = tileAt(d, k.x + dx, k.y + dy); return t === enumTile.floor || t === enumTile.creep; });
    const lockers = s.containers.filter(k => !k.body && open(k) && tileAt(d, k.x, k.y) === enumTile.locker), crates = s.containers.filter(k => !k.body && open(k) && tileAt(d, k.x, k.y) === enumTile.crate);
    if (ev === 'lockdown' && lockers.length) {
        const v = r.pick(lockers);
        v.locked = 'vault';
        v.alarm = true;
        v.items.push(make(r.pick(['semi-rifle', 'combat-shotgun', 'heavy-revolver']), 1, r), make('rifle-ammo'), make('shells'), make('pistol-ammo'), make(r.pick(['vest', 'helmet'])));
        const kb = bodyBox();
        if (kb && kb !== v)
            kb.items.push(make('vault-key'));
    }
    if (ev === 'manifest' && crates.length) {
        const c = r.pick(crates);
        c.locked = 'manifest';
        for (let i = 0; i < 3; i++)
            c.items.push(rollItem(r, 10, s.theme, 1.5));
        const kb = bodyBox();
        if (kb && kb !== c)
            kb.items.push(make('manifest-key'));
    }
    if (ev === 'bloom') {
        const goo = gooOf(s.ai, d), n = D.bloom.pupae[0] + Math.round(D.bloom.pupae[1] * s.floor / 10);
        for (let i = 0; i < n && goo.length; i++) {
            const g = r.pick(goo), x = ((g % d.w) + 0.5) * S, y = (Math.floor(g / d.w) + 0.5) * S;
            if (hypot(x - d.spawn[0], y - d.spawn[1]) < 10 * S)
                continue;
            addPupa(s, x, y);
        }
        for (const pu of s.inf.pupae)
            pu.age = T.inf.pupa.growth + T.inf.pupa.pulse - D.bloom.time;
    }
    if (ev === 'specimen') {
        const far = d.rooms.filter(rm => hypot((rm.cx + 0.5) * S - d.spawn[0], (rm.cy + 0.5) * S - d.spawn[1]) > 20 * S);
        const rm = far.length ? r.pick(far) : r.pick(d.rooms);
        const a = spawnAlien(s.ai, 'brute', (rm.cx + 0.5) * S, (rm.cy + 0.5) * S);
        a.hp *= D.specimen.hp;
        s.event.hunter = a.id;
    }
    const farRoom = () => { const far = d.rooms.filter(rm => rm.id !== d.spawnRoom && rm.id !== d.lootRoom && tileAt(d, rm.cx, rm.cy) !== enumTile.breach && hypot((rm.cx + 0.5) * S - d.spawn[0], (rm.cy + 0.5) * S - d.spawn[1]) > 15 * S); return far.length ? r.pick(far) : r.pick(d.rooms.filter(rm => rm.id !== d.spawnRoom)); };
    const floorIn = (rm) => { for (let k = 0; k < 30; k++) {
        const x = rm.x + r.int(rm.w), y = rm.y + r.int(rm.h);
        if (tileAt(d, x, y) === enumTile.floor)
            return [x, y];
    } return null; };
    if (ev === 'frenzy') {
        const F = D.frenzy, rm = farRoom();
        for (let i = 0; i < F.bodies; i++) {
            const f = floorIn(rm);
            if (f)
                s.ai.corpses.push({ type: i < 2 ? 'crew' : 'crawler', x: (f[0] + 0.3 + r.next() * 0.4) * S, y: (f[1] + 0.3 + r.next() * 0.4) * S, facing: r.next() * 6.28, t: 99, meat: 1, spores: 0 });
        }
        for (let i = 0; i < F.feeders; i++) {
            const f = floorIn(rm);
            if (f)
                spawnAlien(s.ai, 'crawler', (f[0] + 0.5) * S, (f[1] + 0.5) * S);
        }
        const f = floorIn(rm);
        if (f) {
            setTile(d, f[0], f[1], enumTile.crate);
            s.ai.regions = null;
            s.containers.push({ x: f[0], y: f[1], opened: false, items: Array.from({ length: F.loot }, () => rollItem(r, s.floor, s.theme, 1)) });
        }
    }
    if (ev === 'quarantine') {
        const rm = farRoom();
        s.inf.clouds.push({ x: (rm.cx + 0.5) * S, y: (rm.cy + 0.5) * S, r: (Math.max(rm.w, rm.h) / 2 + 1) * S, density: D.quarantine.density, life: 1e9, age: 0 });
        const f = floorIn(rm);
        if (f) {
            setTile(d, f[0], f[1], enumTile.locker);
            s.ai.regions = null;
            s.containers.push({ x: f[0], y: f[1], opened: false, items: [make('medkit', 2), make('antifungal'), make('mask'), rollItem(r, s.floor, 'medbay', 1)] });
        }
    }
    if (ev === 'venting')
        for (let i = 0, tries = 0; i < D.venting.spots && tries < 60; tries++) {
            const f = floorIn(farRoom());
            if (f) {
                s.event.spots.push(f[1] * d.w + f[0]);
                i++;
            }
        }
    if (ev === 'reroute' || ev === 'beacon') {
        const rm = farRoom(), f = floorIn(rm) ?? [rm.cx, rm.cy];
        setTile(d, f[0], f[1], enumTile.console);
        s.event.x = f[0];
        s.event.y = f[1];
        s.ai.regions = null;
    }
    const lr = d.rooms.find(rm => rm.id === d.lootRoom), inLoot = (x, y) => !!lr && x >= lr.x && x < lr.x + lr.w && y >= lr.y && y < lr.y + lr.h;
    if (lr) {
        const L = D.lootRoom, boxes = s.containers.filter(k => inLoot(k.x, k.y));
        for (let y = lr.y; y < lr.y + lr.h; y++)
            for (let x = lr.x; x < lr.x + lr.w; x++) {
                const t = tileAt(d, x, y);
                if ((t === enumTile.crate || t === enumTile.locker) && !boxes.some(k => k.x === x && k.y === y)) {
                    const k = { x, y, items: [], opened: false };
                    s.containers.push(k);
                    boxes.push(k);
                }
            }
        if (!boxes.length && tileAt(d, lr.cx, lr.cy) === enumTile.floor) {
            setTile(d, lr.cx, lr.cy, enumTile.crate);
            const k = { x: lr.cx, y: lr.cy, items: [], opened: false };
            s.containers.push(k);
            boxes.push(k);
            s.ai.regions = null;
        }
        for (const k of boxes) {
            k.items = [];
            for (let i = 0; i < 3; i++)
                k.items.push(rollItem(r, s.floor, s.theme, L.bias));
        }
        if (boxes.length && r.next() < L.gold)
            r.pick(boxes).items.push(rollItem(r, s.floor, s.theme, 0, 5));
        for (let i = 0, tries = 0; i < L.extra && tries < 30; tries++) {
            const x = lr.x + r.int(lr.w), y = lr.y + r.int(lr.h);
            if (tileAt(d, x, y) === enumTile.floor) {
                s.items.push({ x: (x + 0.5) * S, y: (y + 0.5) * S, it: rollItem(r, s.floor, s.theme, L.bias) });
                i++;
            }
        }
    }
    if (d.tiles.some((t, i) => t === enumTile.doorLocked && !(d.secret?.kind === 'door' && i === d.secret.ey * d.w + d.secret.ex) && !(d.vault && i === d.vault.ey * d.w + d.vault.ex))) {
        const pool = s.containers.filter(k => !inLoot(k.x, k.y)), kb = pool.find(k => k.body) ?? (pool.length ? r.pick(pool) : null);
        if (kb)
            kb.items.push(make('keycard'));
    }
    if (d.secret) {
        const sc = d.secret;
        setTile(d, sc.x, sc.y, enumTile.crate);
        s.ai.regions = null;
        s.containers.push({ x: sc.x, y: sc.y, opened: false, items: [rollItem(r, s.floor, s.theme, 0, r.next() < D.secret.gold ? 5 : 4), rollItem(r, s.floor, s.theme, 1)] });
    }
    if (d.vault) {
        const v = d.vault, V = D.vault, cells = [];
        for (let y = v.y - 1; y <= v.y + 1; y++)
            for (let x = v.x - 1; x <= v.x + 1; x++)
                cells.push([x, y]);
        cells.sort((p, q) => hypot(q[0] - v.ex, q[1] - v.ey) - hypot(p[0] - v.ex, p[1] - v.ey));
        const boxes = cells.slice(0, V.boxes).map(([x, y]) => { setTile(d, x, y, enumTile.crate); const k = { x, y, opened: false, items: Array.from({ length: V.rolls }, () => rollItem(r, s.floor, s.theme, V.bias)) }; s.containers.push(k); return k; });
        if (boxes.length && r.next() < V.purple)
            r.pick(boxes).items.push(rollItem(r, s.floor, s.theme, 0, 4));
        s.ai.regions = null;
    }
    if (s.theme === 'merchant') {
        const rm = [...d.rooms].sort((a, b) => b.w * b.h - a.w * a.h)[0];
        let tx = rm.cx, ty = rm.cy;
        for (let k = 0; k < 20 && SOLID.has(tileAt(d, tx, ty)) && tileAt(d, tx, ty) !== enumTile.console; k++) {
            tx = rm.x + r.int(rm.w);
            ty = rm.y + r.int(rm.h);
        }
        setTile(d, tx, ty, enumTile.console);
        s.segs = s.segs;
        s.ai.regions = null;
        const stock = [];
        const add = (it) => stock.push({ it, price: priceOf(it, r.next()) });
        add(make('bandage', 2));
        add(make('flare', 2));
        add(make(r.pick(['pistol-ammo', 'rifle-ammo', 'shells'])));
        add(make(r.pick(['pistol-ammo', 'rifle-ammo', 'shells'])));
        for (let i = 0; i < D.merchant.stock && stock.length < D.merchant.stock + 4; i++) {
            const it = rollItem(r, 6, 'armoury', 1);
            if (ITEMS[it.id].tier >= 2 && ITEMS[it.id].tier <= 3 && it.id !== 'scrap')
                add(it);
        }
        s.trader = { x: tx, y: ty, stock, angry: false };
    }
}
export function priceOf(it, jitter = 0.5) {
    const d = ITEMS[it.id];
    const base = d.price ?? (d.cat === 'ammo' ? 14 : d.cat === 'part' ? 8 : d.cat === 'use' ? 10 + 8 * d.tier : [0, 10, 25, 55, 120, 300][d.tier]);
    return Math.round(base * Math.max(1, it.n > 1 && d.stack ? it.n * 0.6 : 1) * (0.9 + 0.3 * jitter));
}
export const sellPrice = (it) => Math.max(1, Math.round(priceOf(it) * D.merchant.sell));
export function buy(s, i) {
    const w = s.trader?.stock[i];
    if (!w)
        return 'gone';
    if (s.inv.scrap < w.price)
        return `needs ${w.price} scrap`;
    const rest = give(s.inv, { ...w.it });
    if (rest)
        return 'no room';
    s.inv.scrap -= w.price;
    s.trader.stock.splice(i, 1);
    return null;
}
export function sell(s, slot) {
    const it = getSlot(s.inv, slot);
    if (!it)
        return 'nothing';
    const d = ITEMS[it.id];
    if (d.key)
        return "the trader won't take keys";
    s.inv.scrap += sellPrice(it);
    setSlot(s.inv, slot, null);
    return null;
}
export function angerTrader(s) { if (!s.trader || s.trader.angry)
    return; s.trader.angry = true; s.alarmT = D.alarm.time; s.msg = 'the trader screams for help — the deck is on alert'; }
export function useElevator(s) {
    const e = s.elev, p = s.player;
    if (s.map.dock) {
        s.msg = 'this lift only goes back up — the way out is the pod';
        return;
    }
    if (e.state === 'idle') {
        e.state = 'called';
        e.t = D.elevator.arrive;
        emit(s.ai, p.x, p.y, 'sound', T.stim.src.elevator[0], T.stim.src.elevator[1], s.tick);
        s.msg = `elevator called — ${D.elevator.arrive} s. the whole deck heard that.`;
        return;
    }
    if (e.state === 'called') {
        s.msg = `elevator arriving in ${Math.ceil(e.t)} s`;
        return;
    }
    s.escaped = true;
}
function ventSpawn(s, dt) {
    const every = T.run.ventSpawn[s.skulls - 1] ?? 0;
    if (!every || s.map.dock)
        return;
    const t = s.tick / T.SIM_HZ;
    if (Math.floor(t / every) === Math.floor((t - dt) / every))
        return;
    const m = s.map, far = T.run.ventFar * S, vents = [];
    for (let i = 0; i < m.tiles.length; i++)
        if (m.tiles[i] === enumTile.vent && players(s).every(q => hypot((i % m.w + 0.5) * S - q.x, (Math.floor(i / m.w) + 0.5) * S - q.y) > far))
            vents.push(i);
    if (!vents.length)
        return;
    const [r0, n0] = next32(s.rngFx), [r1, n1] = next32(n0);
    s.rngFx = n1;
    const v = vents[Math.floor(r0 * vents.length)], x = (v % m.w + 0.5) * S, y = (Math.floor(v / m.w) + 0.5) * S;
    const pool = s.skulls >= 4 ? ['crawler', 'brute', 'spitter', 'stalker'] : ['mite', 'crawler', 'crawler', 'spitter'], type = pool[Math.floor(r1 * pool.length)];
    const a = spawnAlien(s.ai, type, x, y);
    a.emergeT = T.ai.emergeTime;
    a.alert = 40;
    a.stimX = s.player.x;
    a.stimY = s.player.y;
    a.stimT = s.tick;
    emit(s.ai, x, y, 'sound', T.ai.ventRattle[0], T.ai.ventRattle[1], s.tick);
    s.ai.log.push(`${s.tick} #${a.id} vent spawn`);
}
export function stepDeck(s, dt) {
    const e = s.elev, ev = s.event, now = s.tick / T.SIM_HZ;
    stepDock(s, dt);
    if (s.tick % 6 === 0)
        stepTip(s);
    if (e.state === 'called') {
        e.t -= dt;
        if (e.t <= 0) {
            e.state = 'open';
            s.msg = 'the elevator is here — E to board';
            openVault(s);
            emit(s.ai, s.map.elevator ? (s.map.elevator[0] + 0.5) * S : s.player.x, s.map.elevator ? (s.map.elevator[1] + 0.5) * S : s.player.y, 'sound', D.elevator.ding[0], D.elevator.ding[1], s.tick);
        }
    }
    if (s.alarmT > 0) {
        const k = Math.floor(s.alarmT / D.alarm.every);
        if (k !== Math.floor((s.alarmT - dt) / D.alarm.every)) {
            const pl = s.map.dock?.patrol, src = pl ? [pl[(k % 4) * 2], pl[(k % 4) * 2 + 1]] : [s.player.x, s.player.y];
            emit(s.ai, src[0], src[1], 'sound', T.stim.src.alarm[0], T.stim.src.alarm[1], s.tick);
        }
        s.alarmT -= dt;
    }
    ventSpawn(s, dt);
    if (!ev)
        return;
    if (!ev.announced && s.tick > 30) {
        ev.announced = true;
        const say = { lightsOut: 'emergency power is failing on this deck', bloom: `BLOOM — every pupa on this deck bursts in ${D.bloom.time} s`, specimen: 'something on this deck is hunting you', lockdown: 'the armoury vault is sealed — find the key', manifest: 'a manifest crate is locked — the key is on a body',
            frenzy: 'you can hear feeding somewhere on this deck', quarantine: 'an isolation ward on this deck is full of spores', venting: 'the reactor is venting steam — mind the hissing vents', reroute: 'a power console could light this whole deck (and wake it)', emp: 'the shield generator pulses — your light will die every so often', beacon: 'a distress beacon on this deck could map the decks below (it will be loud)' };
        if (ev.id && say[ev.id]) {
            const said = say[ev.id];
            forSeats(s, () => { s.msg = said; });
        }
    }
    if (ev.id === 'venting') {
        const V = D.venting;
        ev.t += dt;
        if (ev.burst > 0)
            ev.burst -= dt;
        else if (ev.t >= V.every) {
            ev.t = 0;
            ev.burst = V.burst;
            for (const i of ev.spots)
                emit(s.ai, (i % s.map.w + 0.5) * S, (Math.floor(i / s.map.w) + 0.5) * S, 'sound', V.loud[0], V.loud[1], s.tick, -1, true);
        }
        if (ev.burst > 0)
            for (const i of ev.spots) {
                const x = (i % s.map.w + 0.5) * S, y = (Math.floor(i / s.map.w) + 0.5) * S;
                forSeats(s, p => { if (hypot(p.x - x, p.y - y) < V.r && p.alive && !s.god) {
                    p.health -= V.dps * dt;
                    s.stats.damageTaken += V.dps * dt;
                    p.hurtT = 0.2;
                    if (p.health <= 0) {
                        p.health = 0;
                        p.alive = false;
                        p.cause = 'scalded by reactor steam';
                    }
                } });
                for (const a of s.ai.aliens)
                    if (!a.inVent && hypot(a.x - x, a.y - y) < V.r)
                        a.hp -= V.dps * dt;
            }
    }
    if (ev.id === 'emp') {
        ev.t += dt;
        if (ev.t >= D.emp.every) {
            ev.t = 0;
            forSeats(s, () => { const L = s.light; if (L.on && !L.dead) {
                L.dead = true;
                L.diedAt = s.tick;
                L.intensity = 0;
                L.mash = 0;
                L.blinks = 0;
                s.msg = 'EMP — your light is dead — mash F';
            } });
        }
    }
    if (ev.id === 'lightsOut') {
        const dark = (now % D.lightsOut.period) > D.lightsOut.period - D.lightsOut.dark;
        if (dark !== ev.dark) {
            ev.dark = dark;
            forSeats(s, () => { s.msg = dark ? 'power down' : 'power restored'; });
        }
    }
    if (ev.id === 'specimen' && s.tick % 120 === 0) {
        const a = s.ai.aliens.find(a => a.id === ev.hunter);
        if (a && band(a) !== 'aggressive' && s.player.alive && !s.player.hidden) {
            a.alert = Math.max(a.alert, 60);
            a.stimX = s.player.x;
            a.stimY = s.player.y;
            a.stimT = now;
        }
    }
}
export function ventPuff(s, i) {
    const V = T.steam, t = s.tick / T.SIM_HZ + ((i * 2654435761) >>> 0) % 997 / 997 * (V.on + V.off), c = t % (V.on + V.off);
    return c >= V.on ? 0 : Math.min(1, c / V.ramp, (V.on - c) / V.ramp);
}
export function steamAt(s, x, y) {
    let best = 0;
    const w = s.map.w;
    for (const i of s.map.steam ?? []) {
        const d = hypot((i % w + 0.5) * S - x, (Math.floor(i / w) + 0.5) * S - y);
        if (d < T.steam.r)
            best = Math.max(best, ventPuff(s, i) * Math.min(1, 1.6 * (1 - d / T.steam.r)));
    }
    return best;
}
const tippable = new WeakMap();
const tipList = (d) => { let l = tippable.get(d); if (!l) {
    l = (d.decor ?? []).flatMap((p, i) => D.tip.props.includes(p.id) ? [i] : []);
    tippable.set(d, l);
} return l; };
const rectDist = (p, x, y) => hypot(Math.max(p.x * S - x, 0, x - (p.x + p.w) * S), Math.max(p.y * S - y, 0, y - (p.y + p.h) * S));
const centreOf = (p) => [(p.x + p.w / 2) * S, (p.y + p.h / 2) * S];
export function tip(s, i, fromX, fromY) {
    const tp = (s.tipped ??= {});
    if (tp[i])
        return;
    const p = s.map.decor[i], [x, y] = centreOf(p);
    tp[i] = [s.tick, atan2(y - fromY, x - fromX)];
    emit(s.ai, x, y, 'sound', D.tip.loud[0], D.tip.loud[1], s.tick);
    for (let k = 0; k < 3; k++)
        s.fx.push({ kind: 'smoke', x: x + (k - 1) * 4, y: y + (k - 1) * 3, vx: (k - 1) * 6, vy: -4, t: 0, n: 1.2, rot: i + k, c: 1 });
    forSeats(s, p => { if (hypot(p.x - x, p.y - y) < 6 * S)
        s.shake = Math.max(s.shake, 1.5); });
}
export function tipNear(s, x, y, r) { const d = s.map; for (const i of tipList(d))
    if (rectDist(d.decor[i], x, y) < r)
        tip(s, i, x, y); }
function stepTip(s) {
    const d = s.map, list = tipList(d);
    if (!list.length)
        return;
    const p = s.player, tp = (s.tipped ??= {});
    for (const i of list) {
        if (tp[i])
            continue;
        const pr = d.decor[i];
        const by = players(s).find(q => q.sprinting && q.moving && rectDist(pr, q.x, q.y) < T.player.radius + 1.5);
        if (by) {
            tip(s, i, by.x, by.y);
            continue;
        }
        for (const a of s.ai.aliens)
            if (!a.inVent && a.moving && band(a) === 'aggressive' && T.ai.types[a.type].r >= D.tip.alienR && rectDist(pr, a.x, a.y) < T.ai.types[a.type].r + 1) {
                tip(s, i, a.x, a.y);
                break;
            }
    }
    const [r0, ns] = next32(s.rngFx);
    s.rngFx = ns;
    if (r0 >= 6 / (T.SIM_HZ * D.tip.every))
        return;
    const far = list.filter(i => { if (tp[i])
        return false; const [x, y] = centreOf(d.decor[i]), dd = hypot(x - p.x, y - p.y); return dd > D.tip.near[0] * S && dd < D.tip.near[1] * S && !lineOfSight(d, p.x, p.y, x, y); });
    if (far.length) {
        const [r1, n2] = next32(s.rngFx);
        s.rngFx = n2;
        const i = far[Math.floor(r1 * far.length)], [x, y] = centreOf(d.decor[i]);
        tip(s, i, x + cos(r1 * 40), y + sin(r1 * 40));
    }
}
function openVault(s) {
    const v = s.map.vault;
    if (!v || tileAt(s.map, v.ex, v.ey) !== enumTile.doorLocked)
        return;
    setTile(s.map, v.ex, v.ey, enumTile.doorOpen);
    s.segs = visionSegments(s.map);
    s.ai.regions = null;
    s.msg = 'the elevator is here — and the lift vault is open';
}
export function tryUnlock(s, x, y) {
    const d = s.map, g = doorGroup(d, x, y);
    if (d.vault && g.some(([gx, gy]) => gx === d.vault.ex && gy === d.vault.ey)) {
        s.msg = 'a lift vault — it opens when the elevator arrives';
        return;
    }
    if (d.secret?.kind === 'door' && g.some(([gx, gy]) => gx === d.secret.ex && gy === d.secret.ey)) {
        s.msg = 'sealed shut — it will take a breach charge';
        return;
    }
    if (!s.inv.keys.includes('keycard')) {
        s.msg = 'locked — find the deck keycard';
        return;
    }
    for (const [gx, gy] of g)
        setTile(d, gx, gy, enumTile.doorOpen);
    s.segs = visionSegments(d);
    s.ai.regions = null;
    s.msg = 'unlocked';
    emit(s.ai, (x + 0.5) * S, (y + 0.5) * S, 'sound', T.stim.src.doorOpen[0], T.stim.src.doorOpen[1], s.tick);
}
export function damageCrack(s, x, y, dmg) {
    const key = y * s.map.w + x, hp = (s.crateHP[key] ?? D.secret.crackHP) - dmg;
    s.crateHP[key] = hp;
    s.fx.push({ kind: 'hit', x: (x + 0.5) * S, y: (y + 0.5) * S, t: 0 });
    if (hp > 0)
        return;
    setTile(s.map, x, y, enumTile.floor);
    s.segs = visionSegments(s.map);
    s.ai.regions = null;
    s.debris.push({ x: (x + 0.5) * S, y: (y + 0.5) * S, v: 0, k: 'fx/rubble' });
    emit(s.ai, (x + 0.5) * S, (y + 0.5) * S, 'sound', 50, 300, s.tick);
    s.shake = Math.max(s.shake, 2);
    s.msg = 'the wall gives way — a hidden room';
}
export function useConsole(s) {
    const ev = s.event;
    if (ev.used) {
        s.msg = ev.id === 'beacon' ? 'the beacon is already calling' : 'power is already rerouted';
        return;
    }
    ev.used = true;
    s.alarmT = D.alarm.time;
    s.msg = ev.id === 'beacon' ? 'BEACON ON — the decks below are mapped. Everything heard that.' : 'POWER REROUTED — the deck is lit. Everything is awake.';
}
export function usePod(s) {
    const pod = s.pod;
    if (pod.state === 'open') {
        s.msg = 'the pod is open — get in';
        return;
    }
    if (pod.state === 'counting') {
        s.msg = `pod launch prep: ${Math.ceil(pod.t)} s`;
        return;
    }
    const dk = s.map.dock, px = (dk.pod[0] + 0.5) * S, py = (dk.pod[1] + 0.5) * S;
    pod.state = 'counting';
    pod.t = T.dock.podTime;
    s.alarmT = T.dock.podTime;
    s.msg = `POD ARMED — ${T.dock.podTime} s. Everything heard that.`;
    emit(s.ai, px, py, 'sound', T.dock.arm[0], T.dock.arm[1], s.tick);
}
export function pullDrop(s, i) {
    const dr = s.map.dock.drops[i];
    if (dr.used) {
        s.msg = 'that rig is spent';
        return;
    }
    dr.used = true;
    dr.t = T.dock.drop.delay;
    s.msg = 'cargo released';
    emit(s.ai, (dr.cx + 0.5) * S, (dr.cy + 0.5) * S, 'sound', 30, 200, s.tick);
}
function stepDock(s, dt) {
    const dk = s.map.dock, pod = s.pod;
    if (!dk || !pod)
        return;
    if (pod.state === 'counting') {
        const G = T.dock.engines;
        if (Math.floor(pod.t / G.every) !== Math.floor((pod.t - dt) / G.every))
            emit(s.ai, (dk.pod[0] + 0.5) * S, (dk.pod[1] + 0.5) * S, 'sound', G.loud[0], G.loud[1], s.tick);
        pod.t -= dt;
        for (const a of s.ai.aliens)
            a.alert = Math.max(a.alert, T.dock.hold);
        if (pod.t <= 0) {
            pod.state = 'open';
            setTile(s.map, dk.pod[0], dk.pod[1], enumTile.podOpen);
            s.msg = 'THE POD IS OPEN — GET IN';
            emit(s.ai, (dk.pod[0] + 0.5) * S, (dk.pod[1] + 0.5) * S, 'sound', 60, 400, s.tick);
        }
    }
    if (pod.state === 'open' && players(s).some(q => Math.floor(q.x / S) === dk.pod[0] && Math.floor(q.y / S) === dk.pod[1] && q.alive))
        s.escaped = true;
    const D = T.dock.drop;
    for (const dr of dk.drops)
        if (dr.t > 0) {
            dr.t -= dt;
            if (dr.t > 0)
                continue;
            const x = (dr.zx + 0.5) * S, y = (dr.zy + 0.5) * S, R = D.r * S + 0.5 * S;
            for (const a of [...s.ai.aliens])
                if (!a.inVent && hypot(a.x - x, a.y - y) < R + T.ai.types[a.type].r * 0.5)
                    damageAlien(s, a, D.dmg, 'melee', x, y, 0, 0);
            forSeats(s, p => { if (hypot(p.x - x, p.y - y) < R && !s.god && p.alive) {
                p.health -= D.playerDmg;
                s.stats.damageTaken += D.playerDmg;
                p.hurtT = 0.3;
                if (p.health <= 0) {
                    p.health = 0;
                    p.alive = false;
                    p.cause = 'crushed by falling cargo';
                }
            } });
            emit(s.ai, x, y, 'sound', D.loud[0], D.loud[1], s.tick);
            forSeats(s, () => { s.shake = Math.max(s.shake, 5); });
            s.debris.push({ x, y, v: 0, k: 'fx/rubble' }, { x: x + 10, y: y - 6, v: 1 }, { x: x - 8, y: y + 8, v: 2 });
        }
}
