import { T } from "./tuning.js";
import { lineOfSight } from "./ai.js";
import { ITEMS } from "./items.js";
import { enumTile, tileAt } from "./tilemap.js";
import { FLOOR } from "./themes.js";
const S = T.TILE, VOICES = 24;
const fam = (t) => t === 'mite' ? 'mite' : t === 'brute' || t === 'broodwarden' || t === 'sentinel' || t === 'hivemind' ? 'brute' : 'crawler';
const armoured = (t) => t === 'brute' || t === 'broodwarden' || t === 'sentinel' || t === 'hivemind';
const same = (st, k) => st.loud === k[0] && st.radius === k[1];
export const MUSIC = { title: ['title-loop'], early: ['deck-early-01', 'deck-early-02'], mid: ['deck-mid-01'], late: ['deck-late-01'] };
export const deckMusic = (layer) => layer <= 3 ? 'early' : layer <= 7 ? 'mid' : 'late';
const XF = 4;
export class Audio {
    ctx = null;
    master;
    sfx;
    amb;
    mus;
    lastTick = -1;
    manifest = {};
    bufs = new Map();
    base = 'assets/audio/';
    last = new Map();
    voices = 0;
    loops = new Map();
    constructor() {
        fetch(this.base + 'manifest.json').then(r => r.ok ? r.json() : {}).then(m => { this.manifest = m; if (this.ctx)
            this.decode(); }).catch(() => { });
        const ev = ['keydown', 'mousedown', 'pointerup', 'touchend'], start = () => { if (!this.ctx)
            this.init();
        else if (this.ctx.state !== 'running')
            this.ctx.resume(); if (this.ctx?.state === 'running')
            ev.forEach(e => removeEventListener(e, start)); };
        ev.forEach(e => addEventListener(e, start));
    }
    init() {
        const ctx = this.ctx = new AudioContext();
        this.master = ctx.createGain();
        this.master.gain.value = 0.6;
        this.master.connect(ctx.destination);
        [this.sfx, this.amb, this.mus] = [0, 1, 2].map(() => { const g = ctx.createGain(); g.connect(this.master); return g; });
        document.addEventListener('visibilitychange', () => { document.hidden ? ctx.suspend() : ctx.resume(); });
        this.decode();
    }
    mix(o) { if (!this.ctx)
        return; this.master.gain.value = o.volume; this.mus.gain.value = o.music; this.sfx.gain.value = o.sfx; this.amb.gain.value = o.amb; }
    song = null;
    music(pool) {
        const ctx = this.ctx, cur = this.song;
        if (!ctx || (!cur && !pool))
            return;
        if (cur && cur.pool === pool && !(cur.el.duration - cur.el.currentTime < XF))
            return;
        const t = ctx.currentTime;
        if (cur) {
            cur.g.gain.setTargetAtTime(0, t, XF / 4);
            const el = cur.el;
            setTimeout(() => { el.pause(); el.removeAttribute('src'); el.load(); }, XF * 1000 + 500);
            this.song = null;
        }
        if (!pool)
            return;
        const names = MUSIC[pool], rest = names.filter(n => n !== cur?.name), name = rest.length ? rest[Math.floor(Math.random() * rest.length)] : names[0];
        const el = document.createElement('audio'), g = ctx.createGain();
        el.src = `${this.base}music/${name}.ogg`;
        el.preload = 'auto';
        ctx.createMediaElementSource(el).connect(g);
        g.connect(this.mus);
        g.gain.value = 0;
        g.gain.setTargetAtTime(1, t, XF / 4);
        el.play().catch(() => { });
        this.song = { pool, name, el, g };
    }
    decode() {
        const files = new Set(Object.values(this.manifest).flatMap(e => e.files));
        let left = [...files].filter(f => !this.bufs.has(f)).length, bad = 0;
        const done = () => { if (--left === 0)
            console.info(`[audio] ${this.bufs.size} recorded files ready${bad ? `, ${bad} failed to load or decode` : ''}`); };
        for (const f of files)
            if (!this.bufs.has(f))
                fetch(this.base + f).then(r => { if (!r.ok)
                    throw new Error(f); return r.arrayBuffer(); }).then(b => this.ctx.decodeAudioData(b)).then(d => { this.bufs.set(f, d); }).catch(() => { bad++; }).finally(done);
    }
    has(ev) { const e = this.manifest[ev]; return !!e && e.files.some(f => this.bufs.has(f)); }
    pick(ev) {
        const e = this.manifest[ev], ok = e.files.filter(f => this.bufs.has(f));
        if (!ok.length)
            return null;
        let i = Math.floor(Math.random() * ok.length);
        if (ok.length > 1 && ok[i] === this.last.get(ev))
            i = (i + 1) % ok.length;
        this.last.set(ev, ok[i]);
        return this.bufs.get(ok[i]);
    }
    chain(s, x, y, radius, loud, occludable = true) {
        const ctx = this.ctx, p = s.player, d = Math.hypot(x - p.x, y - p.y), fall = Math.max(0, 1 - d / Math.max(radius, 1));
        if (fall <= 0)
            return null;
        const blocked = occludable && d > 2 && !lineOfSight(s.map, p.x, p.y, x, y);
        const g = ctx.createGain();
        g.gain.value = Math.min(1, loud / 60) * fall * fall * (blocked ? 0.5 : 1);
        const pan = ctx.createStereoPanner();
        pan.pan.value = Math.max(-1, Math.min(1, (x - p.x) / 160));
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = blocked ? 500 : 18000;
        g.connect(pan);
        pan.connect(f);
        f.connect(this.sfx);
        return g;
    }
    play(ev, s, x, y, radius = 240, vol = 1, rate = 1, force = false) {
        if (!this.ctx || !this.has(ev) || (!force && this.voices >= VOICES))
            return false;
        const e = this.manifest[ev], buf = this.pick(ev), ctx = this.ctx;
        let dest = this.sfx;
        if (s && x !== undefined && y !== undefined && e.pos) {
            const g = this.chain(s, x, y, radius, 60);
            if (!g)
                return true;
            dest = g;
        }
        const src = ctx.createBufferSource(), g = ctx.createGain();
        src.buffer = buf;
        src.playbackRate.value = rate * (1 + (Math.random() * 2 - 1) * e.jitter);
        g.gain.value = e.gain * vol;
        src.connect(g);
        g.connect(dest);
        src.start();
        this.voices++;
        src.onended = () => { this.voices--; };
        return true;
    }
    want(key, ev, vol, s, x, y, radius = 200) {
        if (!this.ctx || !this.has(ev))
            return;
        const ctx = this.ctx, t = ctx.currentTime, e = this.manifest[ev];
        let l = this.loops.get(key);
        if (!l) {
            const src = ctx.createBufferSource(), g = ctx.createGain(), pan = ctx.createStereoPanner(), f = ctx.createBiquadFilter();
            src.buffer = this.pick(ev);
            src.loop = true;
            f.type = 'lowpass';
            f.frequency.value = 18000;
            g.gain.value = 0;
            src.connect(g);
            g.connect(pan);
            pan.connect(f);
            f.connect(ev.startsWith('amb/') ? this.amb : this.sfx);
            src.start(t, Math.random() * src.buffer.duration);
            l = { src, g, pan, f, seen: true };
            this.loops.set(key, l);
        }
        let v = e.gain * vol;
        if (s && x !== undefined && y !== undefined && e.pos) {
            const p = s.player, d = Math.hypot(x - p.x, y - p.y), fall = Math.max(0, 1 - d / radius), blocked = d > 2 && !lineOfSight(s.map, p.x, p.y, x, y);
            v *= fall * fall * (blocked ? 0.5 : 1);
            l.pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, (x - p.x) / 160)), t, 0.05);
            l.f.frequency.setTargetAtTime(blocked ? 500 : 18000, t, 0.05);
        }
        l.g.gain.setTargetAtTime(v, t, 0.25);
        l.seen = true;
    }
    endFrame() {
        const t = this.ctx.currentTime;
        for (const [k, l] of this.loops) {
            if (l.seen) {
                l.seen = false;
                continue;
            }
            l.g.gain.setTargetAtTime(0, t, 0.15);
            l.src.stop(t + 0.8);
            this.loops.delete(k);
        }
    }
    idle() { if (this.ctx)
        this.endFrame(); }
    tone(dest, t, f0, f1, dur, type, vol) {
        const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(f0, t);
        o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.connect(g);
        g.connect(dest);
        o.start(t);
        o.stop(t + dur + 0.05);
    }
    cue(kind, dest) {
        const t = this.ctx.currentTime;
        if (kind === 'search')
            this.tone(dest, t, 300, 520, 0.18, 'sine', 0.35);
        else {
            this.tone(dest, t, 700, 1100, 0.12, 'square', 0.4);
            this.tone(dest, t + 0.1, 1100, 250, 0.4, 'sawtooth', 0.5);
        }
    }
    noiseBuf = null;
    crackle = null;
    lastAt = 0;
    noise(dest, t, dur, type, f0, f1, vol, q = 0.8) {
        const ctx = this.ctx;
        if (!this.noiseBuf) {
            const b = this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = b.getChannelData(0);
            for (let i = 0; i < d.length; i++)
                d[i] = Math.random() * 2 - 1;
        }
        const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
        src.buffer = this.noiseBuf;
        src.loop = true;
        f.type = type;
        f.Q.value = q;
        f.frequency.setValueAtTime(f0, t);
        f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        src.connect(f);
        f.connect(g);
        g.connect(dest);
        src.start(t, Math.random() * 0.5);
        src.stop(t + dur + 0.05);
    }
    seen = new WeakSet();
    prev = { shots: 0, kills: 0, hp: 0, swing: 0, stepT: 0, crouchT: 0, hidden: false, bag: false, food: 0, heavy: 0, all: 0, msg: '', tipped: new WeakMap(), wind: new Map(), hpA: new Map(),
        voice: new Map(), stepA: new Map(), pupae: new Map(), siren: 0, beat: 0, click: 0, ambT: 8, breaking: new Map(), map: null };
    surface(s) {
        const p = s.player, tx = Math.floor(p.x / S), ty = Math.floor(p.y / S);
        if (tileAt(s.map, tx, ty) === enumTile.creep)
            return 'creep';
        const d = s.map;
        if (FLOOR[s.theme] === 'industrial' || (d.rooms && !d.rooms.some(r => tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h)))
            return 'grate';
        return 'metal';
    }
    step(s, kind) {
        const surf = this.surface(s), p = s.player, vol = surf === 'creep' ? 0.8 : 1;
        for (const ev of [`player/step-${kind}-${surf}`, `player/step-walk-${surf}`, `player/step-${kind}-metal`])
            if (this.has(ev)) {
                this.play(ev, s, p.x, p.y, 400, ev.includes(`-${kind}-`) ? vol : vol * (kind === 'sprint' ? 1.6 : kind === 'crouch' ? 0.35 : 1));
                return;
            }
    }
    carried(s) { const I = s.inv, heavy = [...I.weapons, I.vest, I.helmet, I.mask].filter(Boolean).length; return { heavy, all: heavy + [...I.bag, ...I.quick].filter(Boolean).length }; }
    food(s) { let n = 0; for (const it of [...s.inv.bag, ...s.inv.quick])
        if (it && ITEMS[it.id]?.sprite === 'item/food')
            n += it.n; return n; }
    update(s, sirens = [], dread = 0, chatter = [], bag = false) {
        if (!this.ctx || s.tick === this.lastTick)
            return;
        this.lastTick = s.tick;
        const t = this.ctx.currentTime, p = s.player, P = this.prev, me = this.sfx, w = s.inv.weapons[s.inv.active], fdt = Math.min(0.1, t - this.lastAt);
        this.lastAt = t;
        if (P.map !== s.map) {
            P.map = s.map;
            P.pupae.clear();
            P.hpA.clear();
            P.voice.clear();
            P.stepA.clear();
            P.wind.clear();
            P.food = this.food(s);
            P.msg = s.msg;
            P.breaking.clear();
            ({ heavy: P.heavy, all: P.all } = this.carried(s));
        }
        const moving = p.alive && p.moving && !p.hidden && !p.vault;
        if (moving && !p.crouching && p.stepT > P.stepT + 1e-6)
            this.step(s, p.sprinting ? 'sprint' : 'walk');
        P.stepT = p.stepT;
        if (moving && p.crouching) {
            P.crouchT -= fdt;
            if (P.crouchT <= 0) {
                this.step(s, 'crouch');
                P.crouchT = T.stim.walkStepEvery * 1.4;
            }
        }
        else
            P.crouchT = 0.2;
        if (p.swingT > P.swing + 0.05) {
            const id = w ? w.id : '';
            if (!this.play(`melee/${id}/swing`) && !this.play('melee/whiff'))
                this.noise(me, t, 0.2, 'bandpass', 500, 2200, 0.35, 1.5);
        }
        if (bag !== P.bag)
            this.play(bag ? 'player/inventory-open' : 'player/inventory-close');
        P.bag = bag;
        const dropped = s.ai.lastStimuli.some(st => same(st, T.stim.src.pickup)), food = this.food(s);
        if (food < P.food && !dropped)
            this.play('player/eat');
        P.food = food;
        if (s.msg !== P.msg && s.msg.startsWith('locked'))
            this.play('door/locked', s, p.x, p.y);
        P.msg = s.msg;
        const ch = p.channel;
        if (ch && ch.kind === 'container') {
            const c = s.containers[ch.ref];
            this.want('rummage', c?.body ? 'prop/corpse-search-loop' : 'prop/rummage-loop', 1);
        }
        if (p.alive && tileAt(s.map, Math.floor(p.x / S), Math.floor(p.y / S)) === enumTile.creep)
            this.want('creep', 'hive/creep-loop', 1);
        const SR = T.stim.src;
        for (const st of s.ai.lastStimuli) {
            const a = st.src !== undefined ? s.ai.aliens.find(q => q.id === st.src) : undefined;
            if (same(st, SR.doorOpen))
                this.play('door/open', s, st.x, st.y, st.radius * 1.5);
            else if (st.radius === SR.doorClose[1] && st.loud === SR.doorClose[0])
                this.play('door/close', s, st.x, st.y, st.radius * 1.5);
            else if (st.radius === SR.doorClose[1] && st.loud > SR.doorClose[0])
                this.play('door/slam', s, st.x, st.y, st.radius * 1.5);
            else if (same(st, SR.doorBreak))
                this.play(a && armoured(a.type) ? 'door/bang-brute' : 'door/bang', s, st.x, st.y, st.radius * 1.5, 1, 1, true);
            else if (same(st, SR.container))
                this.play('prop/crate-open', s, st.x, st.y, st.radius);
            else if (!a && same(st, SR.pickup) && !(p.swingT > P.swing + 0.05)) {
                const k = this.carried(s);
                this.play(k.heavy > P.heavy ? 'player/pickup-heavy' : k.all < P.all ? 'player/drop' : 'player/pickup', s, st.x, st.y, 200);
            }
            else if (same(st, T.combat.lockerSound))
                this.play(p.hidden ? 'prop/locker-close' : 'prop/locker-open', s, st.x, st.y, 200);
            else if (same(st, T.combat.crateSmash) || same(st, T.deck.tip.loud))
                this.play('prop/fall', s, st.x, st.y, st.radius * 1.5);
            else if (same(st, T.ai.ventRattle))
                this.play('prop/vent-cover', s, st.x, st.y, st.radius * 1.5);
            else if (same(st, SR.elevator))
                this.play('prop/elevator-call', s, st.x, st.y, 2000);
            else if (same(st, T.deck.venting.loud))
                this.play('env/steam-burst', s, st.x, st.y, st.radius);
            else if (a && same(st, SR.meleeHit))
                this.play(this.has(`alien/${a.type}/bite`) ? `alien/${a.type}/bite` : `alien/${fam(a.type)}/bite`, s, st.x, st.y, 300, 1, 1, true);
            else if (a && same(st, SR.meleeSwing))
                this.play('melee/whiff', s, st.x, st.y, 200);
        }
        for (const a of s.ai.aliens) {
            const was = P.breaking.get(a.id);
            if (a.behave === 'breakdoor')
                P.breaking.set(a.id, [a.doorX, a.doorY]);
            else if (was) {
                P.breaking.delete(a.id);
                if (tileAt(s.map, was[0], was[1]) === enumTile.doorOpen)
                    this.play('door/break', s, (was[0] + 0.5) * S, (was[1] + 0.5) * S, 600, 1, 1, true);
            }
        }
        for (const a of s.ai.aliens) {
            const f = fam(a.type);
            if (a.cue && a.cueT >= T.ai.cueTime - 1.5 / T.SIM_HZ) {
                const kind = a.cue === 'aggro' ? 'aggro' : 'search';
                if (!this.play(`alien/${f}/cue-${kind}`, s, a.x, a.y, 320, 1, 1, true)) {
                    const g = this.chain(s, a.x, a.y, 260, 55);
                    if (g)
                        this.cue(kind, g);
                }
            }
            const was = P.wind.get(a.id) ?? 0, now = a.windT ?? 0;
            P.wind.set(a.id, now);
            if (now > 0 && was <= 0 && !this.play(`alien/${f}/attack`, s, a.x, a.y, 260, 1, 1, true)) {
                const g = this.chain(s, a.x, a.y, 220, 55);
                if (g) {
                    this.noise(g, t, (T.ai.wind[a.type] ?? 0.4) * 0.9, 'highpass', 900, 4000, 0.45);
                    this.tone(g, t, 60 + T.ai.types[a.type].r * 3, 45, (T.ai.wind[a.type] ?? 0.4), 'sawtooth', 0.12);
                }
            }
            const hp0 = P.hpA.get(a.id) ?? a.hp;
            if (a.hp < hp0 - 0.5 && a.hp > 0 && Math.random() < 0.7)
                this.play(`alien/${f}/hurt`, s, a.x, a.y, 260);
            P.hpA.set(a.id, a.hp);
            if (a.inVent)
                continue;
            if (a.chewT > 0)
                this.want(`chew${a.id}`, 'alien/crawler/chew-loop', 1, s, a.x, a.y, 220);
            if (a.behave === 'feed')
                this.want(`feed${a.id}`, 'alien/crawler/feed-loop', 1, s, a.x, a.y, 260);
            if (a.behave === 'investigate' && f === 'crawler')
                this.want(`search${a.id}`, 'alien/crawler/search-loop', 1, s, a.x, a.y, 200);
            if (a.moving && (f === 'brute' || a.type === 'mite')) {
                const every = f === 'brute' ? 0.55 : 0.11, nt = (P.stepA.get(a.id) ?? 0) - fdt;
                if (nt <= 0) {
                    this.play(`alien/${a.type === 'mite' ? 'mite' : 'brute'}/step`, s, a.x, a.y, f === 'brute' ? 320 : 120);
                    P.stepA.set(a.id, every * (0.85 + Math.random() * 0.3));
                }
                else
                    P.stepA.set(a.id, nt);
            }
            const vt = (P.voice.get(a.id) ?? 2 + Math.random() * 6) - fdt;
            if (vt <= 0) {
                const searching = a.behave === 'investigate' || a.behave === 'wander';
                if (a.behave !== 'chase' && a.behave !== 'feed')
                    this.play(`alien/${f}/idle`, s, a.x, a.y, 260);
                P.voice.set(a.id, (searching ? 2.5 : 5) + Math.random() * 5);
            }
            else
                P.voice.set(a.id, vt);
        }
        for (const c of s.ai.corpses)
            if (!this.seen.has(c)) {
                this.seen.add(c);
                if (c.t < 0.5)
                    this.play(c.type === 'mite' ? 'alien/mite/pop' : `alien/${fam(c.type)}/death`, s, c.x, c.y, 300, 1, 1, true);
            }
        const live = new Set();
        for (const pu of s.inf.pupae) {
            live.add(pu.id);
            if (!P.pupae.has(pu.id) && pu.age < 1)
                this.play('hive/pupa-grow', s, pu.x, pu.y, 200);
            P.pupae.set(pu.id, { x: pu.x, y: pu.y, full: pu.age >= T.inf.pupa.growth });
        }
        for (const [id, pu] of P.pupae)
            if (!live.has(id)) {
                this.play(pu.full ? 'hive/pupa-burst' : 'hive/pupa-shot', s, pu.x, pu.y, 320, 1, 1, true);
                P.pupae.delete(id);
            }
        const t0 = t;
        if (s.stats.shots > P.shots) {
            const g = w && ITEMS[w.id].gun, k = g?.loud === 'gun3' ? 1 : g?.loud === 'gun2' ? 0.8 : 0.6;
            this.noise(me, t0, 0.05, 'highpass', 3000, 1500, 0.5 * k);
            this.noise(me, t0, 0.28 * k + 0.05, 'lowpass', 2400, 260, 0.9 * k);
            this.tone(me, t0, 140, 38, 0.2, 'sine', 0.9 * k);
        }
        for (const f of s.fx) {
            if (this.seen.has(f))
                continue;
            this.seen.add(f);
            if (f.kind === 'dmg' && f.n) {
                const near = s.ai.aliens.reduce((b, a) => Math.hypot(a.x - f.x, a.y - f.y) < Math.hypot(b.x - f.x, b.y - f.y) ? a : b, { x: 1e9, y: 1e9, type: '' });
                if (!this.play(armoured(near.type) ? 'gun/impact-chitin' : 'gun/impact-flesh', s, f.x, f.y, 220)) {
                    const g = this.chain(s, f.x, f.y, 200, 60);
                    if (g) {
                        this.noise(g, t0, 0.12, 'lowpass', 900, 200, 0.8);
                        this.tone(g, t0, 110, 50, 0.12, 'sine', 0.6);
                    }
                }
            }
            if (f.kind === 'hit' && p.swingT > 0 && Math.hypot(f.x - p.x, f.y - p.y) < 48 && !s.fx.some(o => o.kind === 'dmg' && Math.hypot(o.x - f.x, o.y - f.y) < 24)) {
                const id = w ? w.id : '';
                if (!this.play(`melee/${id}/hit-metal`, s, f.x, f.y, 200))
                    this.play('melee/pipe/hit-metal', s, f.x, f.y, 200);
            }
            if (f.kind === 'tracer' && f.x1 !== undefined && f.y1 !== undefined && !s.fx.some(o => o.kind === 'dmg' && Math.hypot(o.x - f.x1, o.y - f.y1) < 24))
                this.play('gun/impact-metal', s, f.x1, f.y1, 200);
        }
        for (const g of s.inf.spit)
            if (!this.seen.has(g)) {
                this.seen.add(g);
                const c = this.chain(s, g.x, g.y, 260, 50);
                if (c) {
                    this.noise(c, t0, 0.22, 'bandpass', 1400, 500, 0.7, 2);
                    this.tone(c, t0, 420, 120, 0.18, 'triangle', 0.25);
                }
            }
        if (s.stats.kills > P.kills && !this.has('alien/crawler/death')) {
            this.noise(me, t0, 0.35, 'lowpass', 1200, 90, 0.9);
            this.tone(me, t0, 90, 30, 0.35, 'sine', 0.8);
        }
        if (p.health < P.hp - 0.5 && p.hurtT > 0.25) {
            this.tone(me, t0, 70, 35, 0.25, 'sine', 1);
            this.noise(me, t0, 0.18, 'lowpass', 700, 120, 0.7);
        }
        const d = s.map;
        for (const k of Object.keys(s.tipped ?? {}))
            if (!P.tipped.has(d) || !P.tipped.get(d).has(k)) {
                if (!P.tipped.has(d))
                    P.tipped.set(d, new Set());
                P.tipped.get(d).add(k);
                const pr = d.decor[+k], x = (pr.x + pr.w / 2) * S, y = (pr.y + pr.h / 2) * S;
                if (!this.has('prop/fall')) {
                    const g = this.chain(s, x, y, 420, 70);
                    if (g) {
                        this.noise(g, t0 + 0.05, 0.7, 'lowpass', 2500, 120, 1);
                        this.tone(g, t0 + 0.05, 260, 180, 0.6, 'square', 0.12);
                        this.tone(g, t0 + 0.07, 395, 300, 0.5, 'square', 0.08);
                    }
                }
            }
        if (sirens.length && t - P.siren > 1.4) {
            P.siren = t;
            for (const sr of sirens) {
                const g = this.chain(s, sr.x, sr.y, 400, 35);
                if (g) {
                    this.tone(g, t, 520, 880, 0.7, 'sawtooth', 0.12);
                    this.tone(g, t + 0.7, 880, 520, 0.7, 'sawtooth', 0.12);
                }
            }
        }
        let near = 0, fx = 0, fy = 0;
        for (const f of s.fires) {
            const x = (f.i % s.map.w + 0.5) * S, y = (Math.floor(f.i / s.map.w) + 0.5) * S, v = Math.max(0, 1 - Math.hypot(x - p.x, y - p.y) / 170);
            if (v > near) {
                near = v;
                fx = x;
                fy = y;
            }
        }
        if (!this.crackle) {
            const ctx = this.ctx, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
            this.noise(g, t, 0.01, 'lowpass', 100, 100, 0.0001);
            src.buffer = this.noiseBuf;
            src.loop = true;
            f.type = 'bandpass';
            f.frequency.value = 1700;
            f.Q.value = 0.6;
            g.gain.value = 0;
            src.connect(f);
            f.connect(g);
            g.connect(me);
            src.start();
            this.crackle = g;
        }
        this.crackle.gain.setTargetAtTime(0.22 * near * near, t, 0.2);
        if (near > 0 && Math.random() < fdt * 16 * near) {
            const g = this.chain(s, fx, fy, 170, 45);
            if (g)
                this.noise(g, t, 0.02 + Math.random() * 0.04, 'highpass', 2000 + Math.random() * 4000, 1200, 0.5 + Math.random() * 0.5);
        }
        if (dread > 0.15 && t - P.beat > 1 / (T.alien.dread.beat * (0.8 + 0.6 * dread))) {
            P.beat = t;
            const v = 0.35 + 0.6 * dread;
            this.tone(me, t, 62, 40, 0.16, 'sine', v);
            this.tone(me, t + 0.22, 55, 38, 0.14, 'sine', v * 0.7);
        }
        if (chatter.length && t - P.click > 1 / T.alien.chatterHz) {
            P.click = t;
            for (const a of chatter.slice(0, 3)) {
                const g = this.chain(s, a.x, a.y, 200, 40);
                if (g)
                    this.noise(g, t, 0.018, 'highpass', 4500, 3000, 0.5);
            }
        }
        const th = s.theme, bed = th === 'engine' || th === 'engineering' || th === 'shield' ? 'engine-room' : th === 'loading' || th === 'landing' || th === 'armoury' || th === 'merchant' ? 'loading-dock' : 'crew-quarters';
        this.want('bed', `amb/${this.has(`amb/${bed}-loop`) ? bed : 'crew-quarters'}-loop`, 1);
        const searching = s.ai.aliens.filter(a => a.behave === 'investigate' && Math.hypot(a.x - p.x, a.y - p.y) < 15 * S).length, sv = Math.min(1, searching * 0.5), av = Math.min(1, dread * 1.3);
        this.want('drone-calm', 'amb/drone-calm-loop', 1 - 0.6 * Math.max(sv, av));
        this.want('drone-search', 'amb/drone-search-loop', sv * (1 - av));
        this.want('drone-aggro', 'amb/drone-aggro-loop', av);
        P.ambT -= fdt;
        if (P.ambT <= 0 && p.alive) {
            P.ambT = 12 + Math.random() * 22;
            const ang = Math.random() * Math.PI * 2, r = 120 + Math.random() * 220, ev = ['env/hull-creak', 'env/hull-creak', 'env/pipe-knock', 'env/distant-bang'][Math.floor(Math.random() * 4)];
            this.play(ev, s, p.x + Math.cos(ang) * r, p.y + Math.sin(ang) * r, 600);
        }
        this.endFrame();
        P.shots = s.stats.shots;
        P.kills = s.stats.kills;
        P.hp = p.health;
        P.swing = p.swingT;
        ({ heavy: P.heavy, all: P.all } = this.carried(s));
    }
}
