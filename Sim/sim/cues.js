import { T } from "./tuning.js";
import { Audio } from "./audio.js";
import { lineOfSight, band } from "./ai.js";
import { THINGS } from "./story.js";
const S = T.TILE, r1 = (v) => Math.round(v * 10) / 10, r2 = (v) => Math.round(v * 100) / 100;
const mid = (x, y) => [(x + 0.5) * S, (y + 0.5) * S];
export const EXTRA = { hurt: 'placeholder/hurt.wav', beat: 'placeholder/heartbeat.wav', fire: 'placeholder/fire-loop.wav', noise: 'placeholder/noisemaker-loop.wav' };
const MUSIC = 'music/deck-early-01.ogg', MUSIC_GAIN = 0.6;
export class Cues {
    dread = 0;
    a;
    shots = [];
    loops = [];
    fire = 0;
    beatAt = 0;
    hp = 0;
    last = new Map();
    manifest;
    constructor(manifest) {
        this.manifest = manifest;
        globalThis.addEventListener ??= () => { };
        const a = this.a = new Audio();
        a.manifest = manifest;
        a.ctx = { currentTime: 0 };
        a.sfx = null;
        a.has = (ev) => !!manifest[ev];
        a.play = (ev, s, x, y, radius = 240, vol = 1, rate = 1) => {
            const e = manifest[ev];
            if (!e)
                return false;
            let g = e.gain * vol, at = [null, null, 0];
            if (s && x !== undefined && y !== undefined && e.pos) {
                const pl = this.place(s, x, y, radius);
                if (!pl)
                    return true;
                g *= pl[0];
                at = [r1(x), r1(y), pl[1]];
            }
            this.shots.push([this.pick(ev), r2(g), ...at, r2(rate * (1 + (Math.random() * 2 - 1) * e.jitter))]);
            return true;
        };
        a.want = (key, ev, vol, s, x, y, radius = 200) => {
            const e = manifest[ev];
            if (!e)
                return;
            if (s && x !== undefined && y !== undefined && e.pos)
                this.loopAt(s, key, e.files[0], e.gain * vol, x, y, radius);
            else if (e.gain * vol >= 0.005)
                this.loops.push([key, e.files[0], r2(e.gain * vol), null, null, 0]);
        };
        a.chain = () => null;
        a.tone = a.noise = a.cue = a.endFrame = () => { };
        a.crackle = { gain: { setTargetAtTime: (v) => { this.fire = v; } } };
    }
    pick(ev) { const f = this.manifest[ev].files; let i = Math.floor(Math.random() * f.length); if (f.length > 1 && f[i] === this.last.get(ev))
        i = (i + 1) % f.length; this.last.set(ev, f[i]); return f[i]; }
    place(s, x, y, radius) {
        const p = s.player, d = Math.hypot(x - p.x, y - p.y), fall = Math.max(0, 1 - d / Math.max(radius, 1));
        if (fall <= 0)
            return null;
        const blocked = d > 2 && !lineOfSight(s.map, p.x, p.y, x, y);
        return [fall * fall * (blocked ? 0.5 : 1), blocked ? 1 : 0];
    }
    loopAt(s, key, file, gain, x, y, radius) { const pl = this.place(s, x, y, radius); if (pl && gain * pl[0] >= 0.005)
        this.loops.push([key, file, r2(gain * pl[0]), r1(x), r1(y), pl[1]]); }
    tick(s) {
        const a = this.a, p = s.player, t = s.tick / T.SIM_HZ, D = T.alien.dread;
        this.shots = [];
        this.loops = [];
        let want = 0;
        if (p.alive)
            for (const al of s.ai.aliens) {
                if (al.inVent)
                    continue;
                const b = band(al), k = b === 'aggressive' ? 1 : b === 'searching' ? D.searching : 0;
                if (k)
                    want = Math.max(want, k * Math.max(0, 1 - Math.hypot(al.x - p.x, al.y - p.y) / (D.tiles * S)));
            }
        this.dread += (want - this.dread) * Math.min(1, (want > this.dread ? D.ease : D.ease * 0.35) / T.SIM_HZ);
        a.ctx.currentTime = t;
        a.update(s, [], this.dread, [], false);
        for (const e of s.story?.ev ?? []) {
            const k = e[0], at = () => mid(+e[1], +e[2]);
            if (k === 'slam')
                a.play('door/slam', s, ...at(), 600);
            else if (k === 'vent')
                a.play('prop/vent-cover', s, ...at(), 600);
            else if (k === 'burn')
                a.play('env/steam-burst', s, ...at(), 500);
            else if (k === 'power')
                a.play('prop/elevator-call', s, ...this.thing('generator'), 2000);
            else if (k === 'cell')
                a.play('player/pickup-heavy', s, p.x, p.y, 200);
            else if (k === 'note' || k === 'view')
                a.play('player/inventory-open');
        }
        if (s.story?.power)
            this.loopAt(s, 'generator', this.manifest['amb/engine-room-loop']?.files[0] ?? '', 0.6, ...this.thing('generator'), 16 * S);
        s.ground.forEach((g, i) => { if (g.kind === 'noise')
            this.loopAt(s, `noise${i}`, EXTRA.noise, 0.8, g.x, g.y, 20 * S); });
        if (this.fire > 0.004)
            this.loops.push(['fire', EXTRA.fire, r2(Math.min(1, this.fire / 0.22) * 0.6), null, null, 0]);
        if (p.health < this.hp - 0.5 && p.hurtT > 0.25)
            this.shots.push([EXTRA.hurt, 0.8, null, null, 0, 1]);
        this.hp = p.health;
        if (this.dread > 0.15 && t - this.beatAt > 1 / (D.beat * (0.8 + 0.6 * this.dread))) {
            this.beatAt = t;
            this.shots.push([EXTRA.beat, r2(0.35 + 0.6 * this.dread), null, null, 0, 1]);
        }
        if (p.alive)
            this.loops.push(['music', MUSIC, MUSIC_GAIN, null, null, 0]);
        this.loops = this.loops.filter(l => l[1]);
        s.ai.lastStimuli.length = 0;
        return { shots: this.shots, loops: this.loops };
    }
    thing(k) { const t = THINGS.find(q => q[0] === k); return mid(t[1], t[2]); }
}
