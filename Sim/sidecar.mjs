// The Kestrel Vane sim beside Unreal: steps the TypeScript sim (./sim, built by `npm run sim:unreal` in apps/x-stranded) at 60 Hz
// and talks JSON lines over local TCP. Unreal starts it and it quits when Unreal leaves, so no stale sim outlives a play session.
//   out: the level once (and again after a restart), then one snapshot per tick        (sim/snapshot.js: levelData, snapshot)
//        a snapshot also carries what sounds: "snd" the sounds that start this tick, "lp" the loops to keep running, sent
//        when that list changes (sim/cues.js; the files are under ../Audio)
//   in : {"x","y","ax","ay","b","q","pause","restart","bot"} per frame, all integers   (sim/snapshot.js: inputOf)
//        "bot":1 hands the controls to bot.mjs, which plays the section by itself and cannot be hurt (the demo run)
// shortcut: a separate process and JSON text. The same level/snapshot values move in-process once the sim is embedded in Unreal.
import net from 'node:net';
import { readFileSync } from 'node:fs';
import { storyState, stepStory } from './sim/story.js';
import { levelData, snapshot, inputOf } from './sim/snapshot.js';
import { Cues } from './sim/cues.js';
import { play } from './bot.mjs';

const PORT = Number(process.argv[2] ?? 47800), STEP = 1000 / 60;
const HELD = 0b0000000111, EDGE = 0b1111111000; // input.ts's BITS: sprint, crouch, fire are held; light, interact, vault, reload, swap, drop, bag are presses
const MANIFEST = (() => { try { return JSON.parse(readFileSync(new URL('../Audio/manifest.json', import.meta.url), 'utf8')); } catch { return {}; } })(); // no sound library: a silent game, not a dead one
let s = null, seen = null, cues = null, loops = '';

const server = net.createServer(sock => {
  server.close(); // one renderer
  sock.setNoDelay(true); sock.setEncoding('utf8');
  let held = [0, 0, 0, 0, 0], edges = 0, quick = -1, paused = false, botOn = false, bot = null, buf = '', last = performance.now(), acc = 0;
  const send = o => sock.write(JSON.stringify(o) + '\n');
  const start = () => { s = storyState(1); seen = Uint8Array.from(s.map.tiles); cues = new Cues(MANIFEST); loops = ''; edges = 0; quick = -1; bot = null; send(levelData(s)); };
  start();
  sock.on('data', d => {
    buf += d; if (buf.length > 65536) buf = ''; // nothing sane is this long
    for (let i; (i = buf.indexOf('\n')) >= 0;) {
      let m; try { m = JSON.parse(buf.slice(0, i)); } catch { m = null; } buf = buf.slice(i + 1);
      if (!m || typeof m !== 'object') continue;
      if (m.restart) start();
      held = [m.x | 0, m.y | 0, m.ax | 0, m.ay | 0, (m.b | 0) & HELD]; edges |= (m.b | 0) & EDGE; if (m.q >= 0 && m.q < 4) quick = m.q | 0; paused = !!m.pause; botOn = !!m.bot;
    }
  });
  const timer = setInterval(() => {
    const now = performance.now(); acc = Math.min(acc + now - last, 250); last = now; // a stall is not caught up beyond a quarter second
    for (; acc >= STEP; acc -= STEP) {
      if (paused) continue;
      if (botOn && !bot) { s.god = true; bot = play(s); }
      stepStory(s, botOn ? bot.next().value : inputOf(held[0], held[1], held[2], held[3], held[4] | edges, quick)); edges = 0; quick = -1; // a press counts for one tick
      const snap = snapshot(s, seen), heard = cues.tick(s), lp = JSON.stringify(heard.loops);
      if (heard.shots.length) snap.snd = heard.shots;
      if (lp !== loops) { snap.lp = heard.loops; loops = lp; }
      send(snap);
    }
  }, 4);
  const bye = () => { clearInterval(timer); process.exit(0); };
  sock.on('close', bye); sock.on('error', bye);
});
server.on('error', e => { console.error(`kestrel vane sim: ${e.message}`); process.exit(1); });
server.listen(PORT, '127.0.0.1', () => console.log(`kestrel vane sim on 127.0.0.1:${PORT}`));
setTimeout(() => { if (!s) process.exit(0); }, 60000); // nobody came
