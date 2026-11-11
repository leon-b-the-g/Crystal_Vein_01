import { createGore, stepGore, bleed } from "./gore.js";
import { T } from "./tuning.js";
import { parseAscii, moveCircle, tileAt, setTile, enumTile, LOW, SOLID, visionSegments, doorGroup, doorKey, isDoor, M0_MAP } from "./tilemap.js";
import { generateDeck } from "./worldgen.js";
import { THEMES } from "./themes.js";
import { generateDock } from "./dock.js";
import { adoptDeckFires, stepFire } from "./fire.js";
import { setupDeck, stepDeck, steamAt, useElevator, tryUnlock, useConsole, usePod, pullDrop } from "./deck.js";
import { createAi, stepAi, spawnAlien, emit, noteDoorClosed, ejectFromDoor } from "./ai.js";
import { stream } from "./rng.js";
import { next32, hash } from "./rng.js";
import { encodeInput, decodeInput } from "./input.js";
import { createInventory, ITEMS } from "./items.js";
import { baseMods } from "./workbench.js";
import { createInfection, populateInfection, stepInfection, stepGrapple, spitAt, grapple, addPupa } from "./infection.js";
import { populateLoot, stepCombat, stepCombatWorld, interactLoot, armorReduce, unhide, hitImpact } from "./combat.js";
import { atan2, cos, hypot, ipow, sin } from "./dmath.js";
const SEAT = ['player', 'light', 'inv', 'mods', 'stats', 'aimX', 'aimY', 'msg', 'navT', 'shake', 'openTrade', 'openBench'];
const TRAIL = ['walk', 'wet', 'fluid', 'side', 'px', 'py'];
function save(s, st) { for (const k of SEAT)
    st[k] = s[k]; for (const k of TRAIL)
    st.trail[k] = s.gore[k]; }
export function bind(s, i) {
    const ss = s.seats;
    if (!ss)
        return;
    save(s, ss[s.seatI]);
    if (i === s.seatI)
        return;
    const st = ss[i];
    for (const k of SEAT)
        s[k] = st[k];
    for (const k of TRAIL)
        s.gore[k] = st.trail[k];
    s.seatI = i;
}
export function forSeats(s, fn) {
    const n = s.seats?.length ?? 1, was = s.seatI ?? 0;
    for (let i = 0; i < n; i++) {
        bind(s, i);
        fn(s.player, i);
    }
    bind(s, was);
}
export const players = (s) => s.seats ? s.seats.map(st => st.player) : [s.player];
const newPlayer = (x, y, health) => ({ x, y, px: 0, py: 0, aim: 0, health, hpWas: 0, calmT: 0, stamina: T.player.stamina.max, staminaWait: 0, lockout: 0, sprinting: false, crouching: false, moving: false, anim: 0, vault: null, lastAction: -99, stepT: 0, slow: 0, slowAmt: 0, slowHits: 0, hurtT: 0, alive: true, cause: '',
    weaponT: 0, swingT: 0, reloadT: 0, reloadKind: 'reload', jam: false, channel: null, buffT: 0, flashT: 0, kick: 0, bloom: 0, hidden: false, hideTile: -1, lightWas: true, spores: 0, acidT: 0, grapple: null, spin: 0, dashT: 0, iframeT: 0, adrenT: 0, antiT: 0, sprintT: 0, inSteam: false, veiled: false });
const newLight = () => ({ on: true, intensity: 1, nextFlicker: 20, blinks: 0, blinkT: 0, dead: false, mash: 0 });
export function addPlayer(s) {
    if (!s.seats) {
        s.seats = [{ trail: {} }];
        s.seatI = 0;
        save(s, s.seats[0]);
    }
    if (s.seats.length >= T.coop.maxPlayers)
        throw new Error('lobby full');
    const [sx, sy] = s.map.spawn, r = T.player.radius * 2.5, i = s.seats.length;
    let x = sx, y = sy;
    for (let k = 0; k < 8; k++) {
        const a = (i + k) * Math.PI / 4, tx = sx + cos(a) * r, ty = sy + sin(a) * r;
        if (!SOLID.has(tileAt(s.map, Math.floor(tx / T.TILE), Math.floor(ty / T.TILE)))) {
            x = tx;
            y = ty;
            break;
        }
    }
    s.seats.push({ player: newPlayer(x, y, T.player.startHealth), light: newLight(), inv: createInventory(), mods: baseMods(), stats: { kills: 0, shots: 0, hits: 0, misfires: 0, damageTaken: 0 },
        aimX: 0, aimY: 0, msg: '', navT: 0, shake: 0, openTrade: false, openBench: undefined, trail: { walk: 0, wet: 0, fluid: 'blood', side: 1, px: 0, py: 0 } });
    return i;
}
export function createState(seed, floor = 1, theme = 'crew', testMap = false, populate = true, carry) {
    const map = testMap ? parseAscii(M0_MAP, seed) : theme === 'landing' ? generateDock(seed) : generateDeck(seed, floor, theme), p = T.player;
    const s = {
        seed, floor, tick: 0, rngFx: hash('fx', seed), map, segs: visionSegments(map), msg: '', ai: createAi(), god: false,
        player: newPlayer(map.spawn[0], map.spawn[1], p.startHealth), light: newLight(),
        inv: createInventory(), items: [], containers: [], thrown: [], ground: [], fx: [], navT: 0, aimX: 0, aimY: 0, infiniteAmmo: false, stats: { kills: 0, shots: 0, hits: 0, misfires: 0, damageTaken: 0 }, escaped: false, shake: 0, mods: baseMods(), doorMarks: {}, crateHP: {}, ambush: [], debris: [], inf: createInfection(),
        fires: [], fireT: 0, mines: [], pod: null, gore: createGore(hash('gore', seed)),
        theme, skulls: carry?.skulls ?? 2, elev: { state: 'idle', t: 0 }, event: null, alarmT: 0, trader: null, openTrade: false,
    };
    if (carry) {
        s.inv = structuredClone(carry.inv);
        s.player.health = carry.health;
        s.mods = carry.mods;
        s.player.stamina = T.player.stamina.max + carry.mods.stamina;
    }
    adoptDeckFires(s);
    if (populate && !testMap) {
        populateAliens(s);
        populateLoot(s);
        populateInfection(s);
        setupDeck(s);
    }
    return s;
}
function populateAliens(s) {
    const dk = s.map.dock;
    if (dk) {
        const boss = spawnAlien(s.ai, 'hivemind', dk.patrol[0], dk.patrol[1]);
        boss.patrol = dk.patrol;
        boss.patrolI = 0;
    }
    const d = s.map, r = stream(s.seed, `aliens${s.floor}`), A = T.ai;
    const th = THEMES[s.theme], n = dk ? T.dock.aliens : Math.round((A.perDeck[0] + (A.perDeck[1] - A.perDeck[0]) * (s.floor - 1) / 9) * th.count * T.run.skullCount[s.skulls - 1]), hard = s.skulls >= 4 ? T.run.hard : 1;
    const types = Object.keys(A.mix).filter(t => (t !== 'brute' || s.floor >= A.bruteFrom) && (t !== 'spitter' || s.floor >= A.spitterFrom) && (t !== 'stalker' || s.floor >= A.stalkerFrom));
    const weights = types.map(t => A.mix[t] * (th.aliens[t] ?? 1) * (t === 'brute' || t === 'spitter' || t === 'stalker' ? hard : 1)), total = weights.reduce((a, b) => a + b, 0);
    const rooms = d.rooms.filter(rm => rm.id !== d.spawnRoom && tileAt(d, rm.cx, rm.cy) !== enumTile.breach && tileAt(d, rm.cx, rm.cy) !== enumTile.pod), bay = rooms.find(rm => rm.kind === 'signature');
    for (let i = 0; i < n && rooms.length; i++) {
        let v = r.next() * total, type = types[0];
        for (let k = 0; k < types.length; k++) {
            v -= weights[k];
            if (v <= 0) {
                type = types[k];
                break;
            }
        }
        const rm = dk && bay && r.next() < 0.7 ? bay : r.pick(rooms);
        for (let tries = 0; tries < 20; tries++) {
            const x = rm.x + r.int(rm.w), y = rm.y + r.int(rm.h);
            if (!SOLID.has(tileAt(d, x, y))) {
                spawnAlien(s.ai, type, (x + 0.5) * T.TILE, (y + 0.5) * T.TILE);
                break;
            }
        }
    }
    const B = A.brood, want = s.floor >= 8 ? B.chance[1] : s.floor >= B.from || (s.theme === 'research' && s.floor >= 4) ? B.chance[0] : 0;
    const er = d.rooms[d.elevatorRoom];
    if (!dk && s.theme !== 'merchant' && er) {
        const loop = [[er.x + 1, er.y + 1], [er.x + er.w - 2, er.y + 1], [er.x + er.w - 2, er.y + er.h - 2], [er.x + 1, er.y + er.h - 2]].filter(([x, y]) => !SOLID.has(tileAt(d, x, y)) && tileAt(d, x, y) !== enumTile.elevator);
        if (loop.length) {
            const [x, y] = loop[0], a = spawnAlien(s.ai, 'sentinel', (x + 0.5) * T.TILE, (y + 0.5) * T.TILE);
            a.hp = Math.round(a.hp * (1 + A.sentinel.hpPerDeck * (s.floor - 1)));
            a.patrol = loop.flatMap(([x, y]) => [(x + 0.5) * T.TILE, (y + 0.5) * T.TILE]);
            a.patrolI = 0;
        }
    }
    if (want && !dk && r.next() < want) {
        const far = rooms.filter(rm => hypot((rm.cx + 0.5) * T.TILE - d.spawn[0], (rm.cy + 0.5) * T.TILE - d.spawn[1]) > 25 * T.TILE), rm = far.length ? r.pick(far) : r.pick(rooms);
        if (rm && !SOLID.has(tileAt(d, rm.cx, rm.cy)))
            spawnAlien(s.ai, 'broodwarden', (rm.cx + 0.5) * T.TILE, (rm.cy + 0.5) * T.TILE);
    }
}
const markDoor = (s, x, y, who) => { const tx = Math.floor(x / T.TILE), ty = Math.floor(y / T.TILE); if (isDoor(tileAt(s.map, tx, ty)))
    s.doorMarks[doorKey(s.map, tx, ty)] = who; };
const rnd = (s) => { const [v, ns] = next32(s.rngFx); s.rngFx = ns; return v; };
function stepFlashlight(s, dt) {
    const L = s.light, F = T.flashlight;
    if (!L.on && !L.dead) {
        L.intensity = 0;
        return;
    }
    const w = s.inv.weapons[s.inv.active], away = s.player.swingT > 0 && !!(w && ITEMS[w.id].melee?.two);
    if (away) {
        L.intensity = 0;
        L.away = true;
        return;
    }
    if (L.away) {
        L.away = false;
        L.intensity = L.dead ? 0 : 1;
    }
    if (L.blinks > 0) {
        L.blinkT -= dt;
        if (L.blinkT <= 0) {
            L.blinks--;
            L.blinkT = 0.04 + rnd(s) * 0.12;
            L.intensity = L.intensity > 0.5 ? 0.05 : 1;
        }
        if (L.blinks === 0) {
            L.intensity = 1;
            if (rnd(s) < F.die && s.tick - (L.diedAt ?? -1e9) >= F.dieGap * T.SIM_HZ) {
                L.dead = true;
                L.diedAt = s.tick;
                L.intensity = 0;
                L.mash = 0;
                s.msg = 'your light dies — smack it: mash F';
            }
        }
        return;
    }
    if (L.dead) {
        L.blinkT += dt;
        if (L.blinkT > F.mashGap)
            L.mash = Math.max(0, L.mash - dt / F.mashForget);
        L.intensity = Math.max(0, L.intensity - dt * 8);
        return;
    }
    L.nextFlicker -= dt;
    if (L.nextFlicker <= 0) {
        L.blinks = 2 * (1 + Math.floor(rnd(s) * 3));
        L.blinkT = 0;
        L.intensity = 1;
        L.nextFlicker = F.flickerMin + rnd(s) * (F.flickerMax - F.flickerMin);
    }
}
const facingTile = (p, ang, dist) => [Math.floor((p.x + cos(ang) * dist) / T.TILE), Math.floor((p.y + sin(ang) * dist) / T.TILE)];
export function benchAt(s) {
    const p = s.player, d = s.map.decor;
    if (!d || p.hidden)
        return false;
    const tiles = [facingTile(p, p.aim, T.TILE * 0.9), facingTile(p, p.aim, T.TILE * 0.4)];
    return d.some(o => o.id === 'workbench' && tiles.some(([x, y]) => x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h));
}
function interact(s) {
    if (s.player.hidden) {
        unhide(s);
        return;
    }
    const p = s.player, [tx, ty] = facingTile(p, p.aim, T.TILE * 0.9), t = tileAt(s.map, tx, ty);
    const [ax, ay] = facingTile(p, p.aim, T.TILE * 0.4), t2 = tileAt(s.map, ax, ay);
    const [dx, dy, dt] = t === enumTile.door || t === enumTile.doorOpen || t === enumTile.doorLocked ? [tx, ty, t] : [ax, ay, t2];
    if (dt === enumTile.door) {
        for (const [gx, gy] of doorGroup(s.map, dx, dy))
            setTile(s.map, gx, gy, enumTile.doorOpen);
        s.msg = '';
        emit(s.ai, (dx + 0.5) * T.TILE, (dy + 0.5) * T.TILE, 'sound', T.stim.src.doorOpen[0], T.stim.src.doorOpen[1], s.tick);
    }
    else if (dt === enumTile.doorOpen) {
        for (const [gx, gy] of doorGroup(s.map, dx, dy)) {
            setTile(s.map, gx, gy, enumTile.door);
            ejectFromDoor(s.map, p, gx, gy, T.player.radius);
            for (const a of s.ai.aliens)
                if (ejectFromDoor(s.map, a, gx, gy, T.ai.types[a.type].r)) {
                    a.path = [];
                    a.repathAt = 0;
                }
        }
        const loud = p.sprinting ? T.stim.src.doorClose[0] * 2 : T.stim.src.doorClose[0];
        emit(s.ai, (dx + 0.5) * T.TILE, (dy + 0.5) * T.TILE, 'sound', loud, T.stim.src.doorClose[1], s.tick);
        noteDoorClosed(s.ai, s.map, dx, dy, s.tick);
    }
    else if (dt === enumTile.doorLocked) {
        tryUnlock(s, dx, dy);
        return;
    }
    else if (t === enumTile.elevator || t2 === enumTile.elevator) {
        useElevator(s);
        return;
    }
    else if (s.event && s.event.x >= 0 && ((tx === s.event.x && ty === s.event.y) || (ax === s.event.x && ay === s.event.y))) {
        useConsole(s);
        return;
    }
    else if (s.map.dock && [[tx, ty], [ax, ay]].some(([x, y]) => x === s.map.dock.console[0] && y === s.map.dock.console[1])) {
        usePod(s);
        return;
    }
    else if (s.map.dock?.drops.some(d => (d.cx === tx && d.cy === ty) || (d.cx === ax && d.cy === ay))) {
        const dk = s.map.dock;
        pullDrop(s, dk.drops.findIndex(d => (d.cx === tx && d.cy === ty) || (d.cx === ax && d.cy === ay)));
        return;
    }
    else if (s.trader && ((tx === s.trader.x && ty === s.trader.y) || (ax === s.trader.x && ay === s.trader.y))) {
        if (s.trader.angry)
            s.msg = 'the trader will not deal with you';
        else
            s.openTrade = true;
        return;
    }
    else if (benchAt(s)) {
        s.openBench = true;
        return;
    }
    else {
        interactLoot(s);
        return;
    }
    s.segs = visionSegments(s.map);
    s.ai.regions = null;
}
function tryVault(s, mx, my) {
    const p = s.player, P = T.player;
    if (!p.moving || p.stamina < P.stamina.vaultCost)
        return;
    const ang = atan2(my, mx), [tx, ty] = facingTile(p, ang, P.radius + 2);
    if (!LOW.has(tileAt(s.map, tx, ty)))
        return;
    const bx = tx + Math.round(mx), by = ty + Math.round(my);
    if (SOLID.has(tileAt(s.map, bx, by)))
        return;
    p.vault = { t: 0, x0: p.x, y0: p.y, x1: (bx + 0.5) * T.TILE, y1: (by + 0.5) * T.TILE };
    p.stamina -= P.stamina.vaultCost;
    emit(s.ai, p.x, p.y, 'sound', T.stim.src.vault[0], T.stim.src.vault[1], s.tick);
}
export const stepToward = (s, inp, x, y) => step(s, { ...inp, aimX: x - s.player.x, aimY: y - s.player.y });
function movePlayer(s, inp, dt) {
    const p = s.player, P = T.player;
    p.px = p.x;
    p.py = p.y;
    p.aim = atan2(inp.aimY, inp.aimX);
    s.aimX = p.x + inp.aimX;
    s.aimY = p.y + inp.aimY;
    const len = hypot(inp.x, inp.y) || 1, mx = inp.x / len, my = inp.y / len;
    p.moving = (inp.x !== 0 || inp.y !== 0) && !p.hidden && !p.grapple;
    p.crouching = inp.crouch;
    const canAct = s.tick - p.lastAction > 6;
    if (inp.light && canAct && !p.hidden) {
        const L = s.light, F = T.flashlight;
        p.lastAction = s.tick;
        if (L.dead) {
            L.on = true;
            L.mash++;
            L.blinkT = 0;
            L.intensity = 0.6;
            emit(s.ai, p.x, p.y, 'sound', F.smack[0], F.smack[1], s.tick);
            if (L.mash >= F.relight) {
                L.dead = false;
                L.intensity = 1;
                L.nextFlicker = F.flickerMin + rnd(s) * (F.flickerMax - F.flickerMin);
                s.msg = 'the light stutters back';
            }
        }
        else {
            L.on = !L.on;
            if (L.on)
                L.intensity = 1;
        }
    }
    if (inp.interact && canAct) {
        interact(s);
        p.lastAction = s.tick;
    }
    if (inp.vault && canAct && !p.vault && !p.hidden) {
        tryVault(s, mx, my);
        p.lastAction = s.tick;
    }
    if (p.vault) {
        const v = p.vault;
        v.t += dt / (P.vaultTime * s.mods.vault);
        const k = Math.min(1, v.t);
        p.x = v.x0 + (v.x1 - v.x0) * k;
        p.y = v.y0 + (v.y1 - v.y0) * k;
        if (k >= 1)
            p.vault = null;
    }
    else {
        const wantSprint = inp.sprint && p.moving && !inp.crouch && p.lockout <= 0 && p.stamina > 0 && p.spin <= 0;
        p.sprinting = wantSprint;
        p.sprintT = wantSprint ? p.sprintT + dt : 0;
        if (wantSprint && p.adrenT <= 0) {
            p.stamina = Math.max(0, p.stamina - P.stamina.drain * dt);
            p.staminaWait = P.stamina.regenDelay;
            if (p.stamina === 0)
                p.lockout = P.stamina.lockout;
        }
        else if (p.staminaWait > 0)
            p.staminaWait -= dt;
        else
            p.stamina = Math.min(P.stamina.max + s.mods.stamina, p.stamina + P.stamina.regen * s.mods.regen * (p.buffT > 0 ? T.combat.buffRegen : 1) * dt);
        if (p.lockout > 0)
            p.lockout -= dt;
        const w0 = Math.min(1, p.sprintT / P.speed.windUp), wind = w0 * w0;
        let speed = inp.crouch ? P.speed.crouch : p.health < P.limpBelow + s.mods.limp ? P.speed.limp : wantSprint ? P.speed.walk + (P.speed.sprint - P.speed.walk) * wind : P.speed.walk;
        const onCreep = tileAt(s.map, Math.floor(p.x / T.TILE), Math.floor(p.y / T.TILE)) === enumTile.creep;
        if (onCreep)
            speed *= 1 - P.creepSlow;
        if (p.slow > 0) {
            speed *= 1 - p.slowAmt;
            p.slow -= dt;
        }
        const w = s.inv.weapons[s.inv.active], gk = w ? ITEMS[w.id].gun?.kind : undefined, C = T.combat;
        speed *= (1 - (s.inv.vest ? ITEMS[s.inv.vest.id].armor.slow ?? 0 : 0)) * (p.adrenT > 0 ? C.adren.speed : 1) * (gk === 'hmg' && p.weaponT > 0 ? C.hmg.moveMul : gk === 'minigun' && p.spin > 0 ? C.minigun.moveMul : 1);
        if (p.dashT > 0) {
            p.dashT -= dt;
            [p.x, p.y] = moveCircle(s.map, p.x, p.y, cos(p.aim) * C.katana.dash / 0.15 * dt, sin(p.aim) * C.katana.dash / 0.15 * dt, P.radius);
        }
        if (p.slowHits > 0)
            p.slowHits = Math.max(0, p.slowHits - dt / T.ai.hitSlowForget);
        if (p.moving && p.alive) {
            [p.x, p.y] = moveCircle(s.map, p.x, p.y, mx * speed * dt, my * speed * dt, P.radius);
            p.anim += speed * dt;
            if (!inp.crouch) {
                p.stepT -= dt;
                if (p.stepT <= 0) {
                    const src = wantSprint ? T.stim.src.sprint : T.stim.src.walk;
                    emit(s.ai, p.x, p.y, 'sound', src[0] * (onCreep ? P.creepStep : 1), src[1], s.tick);
                    p.stepT = T.stim.walkStepEvery * (wantSprint ? 0.5 : 1);
                }
            }
        }
    }
    const inSteam = p.alive && !p.hidden && steamAt(s, p.x, p.y) >= T.steam.dense;
    if (inSteam && !p.inSteam)
        p.veiled = !s.ai.aliens.some(a => !a.inVent && s.tick - a.lastSeen < T.steam.seen * T.SIM_HZ);
    if (!inSteam)
        p.veiled = false;
    p.inSteam = inSteam;
    stepFlashlight(s, dt);
}
const IDLE = decodeInput(new Uint8Array(8));
export function step(s, raw) {
    const dt = 1 / T.SIM_HZ, P = T.player, ps = players(s), n = ps.length, was = s.seatI ?? 0;
    if (!ps.some(q => q.alive) || s.escaped) {
        s.tick++;
        return;
    }
    const ins = (Array.isArray(raw) ? raw : [raw]).map(r => decodeInput(encodeInput(r)));
    if ((s.slowT ?? 0) > 0)
        s.slowT -= dt;
    for (let i = 0; i < n; i++) {
        bind(s, i);
        if (s.player.alive)
            movePlayer(s, ins[i] ?? IDLE, dt);
    }
    stepCombatWorld(s, dt, false);
    for (let i = 0; i < n; i++) {
        bind(s, i);
        if (s.player.alive)
            stepCombat(s, ins[i] ?? IDLE, dt);
    }
    stepCombatWorld(s, dt, true);
    const seen = [];
    for (let i = 0; i < n; i++) {
        bind(s, i);
        const p = s.player;
        if (p.alive)
            markDoor(s, p.x, p.y, 1);
        if (p.hurtT > 0)
            p.hurtT -= dt;
        seen.push({ x: p.x, y: p.y, vx: (p.x - p.px) * T.SIM_HZ, vy: (p.y - p.py) * T.SIM_HZ, lit: s.light.on && s.light.intensity > 0.5 && !(ins[i] ?? IDLE).crouch && !p.hidden, alive: p.alive, hidden: p.hidden, veiled: p.veiled, grappledBy: p.grapple?.by ?? -1 });
    }
    bind(s, 0);
    stepAi(s.ai, {
        map: s.map, tick: s.tick, rng: { get v() { return s.rngFx; }, set v(n) { s.rngFx = n; } },
        players: seen,
        onSpit: (a, ang) => spitAt(s, a, ang), onGrapple: (a, who) => { bind(s, who); grapple(s, a); }, onPupate: (a) => { addPupa(s, a.x, a.y); s.ai.log.push(`${s.tick} a pupa forms`); },
        onDoorChanged: () => { s.segs = visionSegments(s.map); },
        onPlayerHit: (dmg, fx, fy, type, who) => {
            bind(s, who);
            const p = s.player;
            if (s.god || !p.alive || p.iframeT > 0)
                return;
            dmg = (type && s.tutDmg?.[type]) ?? dmg;
            dmg = Math.max(1, dmg - armorReduce(s));
            if (s.inv.shield > 0) {
                const k = Math.min(s.inv.shield, dmg);
                s.inv.shield -= k;
                dmg -= k;
                p.hurtT = 0.15;
                if (dmg <= 0)
                    return;
            }
            p.health -= dmg;
            s.stats.damageTaken += dmg;
            p.hurtT = 0.3;
            const PU = T.combat.punch;
            hitImpact(s, dmg >= PU.heavyBite, PU.hurtShake + dmg * PU.hurtShakePerDmg);
            bleed(s, p.x, p.y, atan2(p.y - fy, p.x - fx), dmg, 'blood', 5);
            p.slowAmt = T.ai.hitSlow * ipow(T.ai.hitSlowDim, p.slowHits);
            p.slowHits += 1;
            p.slow = T.ai.hitSlowTime;
            if (p.health <= 0) {
                p.health = 0;
                p.alive = false;
                p.cause = 'killed by the hive';
            }
        },
    }, dt);
    bind(s, 0);
    stepFire(s, dt);
    stepInfection(s, dt);
    for (let i = 0; i < n; i++) {
        bind(s, i);
        stepGrapple(s, dt, (ins[i] ?? IDLE).vault);
    }
    bind(s, 0);
    stepDeck(s, dt);
    stepGore(s);
    for (const a of s.ai.aliens)
        if (!a.inVent)
            markDoor(s, a.x, a.y, 2);
    for (let i = 0; i < n; i++) {
        bind(s, i);
        const p = s.player, R = P.recover, cap = (P.maxHealth + s.mods.maxHealth) * R.upTo;
        p.calmT = p.health < p.hpWas ? 0 : p.calmT + dt;
        if (p.alive && p.calmT >= R.after && p.health < cap)
            p.health = Math.min(cap, p.health + R.rate * (p.hidden ? R.hidden : p.moving ? 1 : R.still) * dt);
        p.hpWas = p.health;
    }
    s.tick++;
    bind(s, was);
}
