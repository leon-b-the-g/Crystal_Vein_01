// Checks the project against its own rules, before work starts and before every commit (Docs/GUARDRAILS.md, Docs/WORKFLOW.md).
//
//   node Tools/preflight.mjs              every check
//   node Tools/preflight.mjs kit briefs   only these. The checks: kit briefs docs art sim loop
//
// exit 0: nothing failed (warnings are printed) · 1: something failed
// Not checked here, because nothing on this side can see it: whether Sim/sim or Audio were edited by hand (G-11), and
// anything about how the game looks, sounds or plays (G-02).
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { look, loopsWaiting } from './loop.mjs';

const text = f => { try { return readFileSync(f, 'utf8'); } catch { return ''; } };
const walk = (dir, keep) => !existsSync(dir) ? [] : readdirSync(dir).flatMap(n => { const f = join(dir, n); return statSync(f).isDirectory() ? walk(f, keep) : keep(n) ? [f] : []; });
/** does this path exist under root, whatever the case of its letters (Unreal and Windows do not care, a mounted disk may) */
const under = (root, parts) => { let dir = root; for (const p of parts) { const hit = existsSync(dir) && statSync(dir).isDirectory() ? readdirSync(dir).find(n => n.toLowerCase() === p.toLowerCase()) : null; if (!hit) return false; dir = join(dir, hit); } return true; };

/** the pieces Kit.txt may name, read from the code that reads Kit.txt, so that this file cannot fall behind it */
export function kinds(cpp) {
  const list = (what, re, word) => { const m = cpp.match(re); if (!m) throw new Error(`cannot find ${what} in CVWorldView.cpp: bring Tools/preflight.mjs up to date with LoadKit`); return [...m[1].matchAll(word)].map(x => x[1]); };
  const names = list('CVKindNames', /CVKindNames\[KCount\]\s*=\s*\{([^}]*)\}/, /TEXT\("(\w+)"\)/g);
  const places = list('CVPlaceNames', /CVPlaceNames\[\]\s*=\s*\{([^}]*)\}/, /TEXT\("(\w+)"\)/g);
  const plain = list('CVKitKinds', /CVKitKinds\[\]\s*=\s*\{([^}]*)\}/, /\bK(\w+)/g);
  if (!/KTileKinds\s*=\s*KCreep\s*\+\s*1/.test(cpp) || !names.includes('Creep')) throw new Error('KTileKinds is no longer KCreep + 1: bring Tools/preflight.mjs up to date with LoadKit');
  return { names, places, plain, tiles: names.slice(0, names.indexOf('Creep') + 1) };
}

/**
 * Kit.txt, read the way ACVWorldView::LoadKit reads it. The game skips a line it cannot use and says so in a log nobody
 * is looking at; this says it before the game starts.
 * ctx: { kinds, rooms: Set of room names, aliens: Set of the sim's alien types, has: asset path => 'yes' | 'no' | 'nopack' }
 */
export function lintKit(source, ctx) {
  const out = [], { names, places, plain, tiles } = ctx.kinds, missing = new Map();
  let read = 0;
  source.split(/\r?\n/).forEach((raw, i) => {
    const say = (level, msg) => out.push({ level, at: `kit:${i + 1}`, msg });
    const line = raw.split('#')[0].trim();
    if (!line) return;
    read++;
    const piece = line.match(/^[A-Za-z0-9_]*/)[0];
    let rest = line.slice(piece.length).trimStart(), room = '';
    if (rest.startsWith('@')) {
      const signs = [rest.indexOf(' = '), rest.indexOf(' + ')].filter(k => k >= 0);
      if (signs.length) { const sign = Math.min(...signs); room = rest.slice(1, sign).trim(); rest = rest.slice(sign + 1); }
    }
    const words = rest.slice(1).trim().split(/\s+/).filter(Boolean);
    if (!piece || !words.length || !'=+'.includes(rest[0] ?? '?')) return say('fail', `cannot be read: ${line}`);
    const onTop = rest[0] === '+', [asset, ...options] = words;
    for (const o of options) if (!/^(scale|yaw|z)=-?\d+(\.\d+)?$/.test(o) && !/^glow=(cold|amber|off)$/.test(o))
      say('fail', `"${o}": the options are scale= yaw= z= and glow=cold|amber|off (G-20: no other colour)`);
    if (room && !ctx.rooms.has(room)) say('fail', `no room is called "${room}". The rooms: ${[...ctx.rooms].join(', ')}`);
    const known = names.includes(piece) || places.includes(piece), tile = tiles.includes(piece), flat = plain.includes(piece);
    if (known) {
      if (onTop ? !(tile || places.includes(piece)) : !flat) return say('fail', `the game has nothing to do with "${piece} ${rest[0]}": ${onTop ? 'only pieces laid by the tiles, and the places, carry things' : 'this piece is not a plain box a mesh can stand in for'}`);
      if (!onTop && room && !tile) say('fail', `"@ ${room}" is ignored for ${piece}: the line would change every room`);
    } else if (onTop) return say('fail', `no piece is called "${piece}". Pieces: ${[...names, ...places].join(' ')}`);
    else if (!ctx.aliens.has(piece)) say('warn', `"${piece}" is neither a piece nor one of the sim's aliens (${[...ctx.aliens].join(', ')}): the game takes it for an alien's body`);
    if (asset === 'none') { if (!onTop && !room) say('fail', '"= none" needs a room'); return; }
    const path = (asset.match(/'([^']+)'/)?.[1] ?? asset).split('.')[0];
    if (!path.startsWith('/Game/')) return say(path.startsWith('/Engine/') ? 'warn' : 'fail', `${path}: ${path.startsWith('/Engine/') ? 'an engine asset, not checked' : 'an asset is /Game/Folder/Name'}`);
    const has = ctx.has(path);
    if (has === 'nopack') missing.set(path.split('/')[2], (missing.get(path.split('/')[2]) ?? 0) + 1);
    else if (has === 'no') say('fail', `${path}: its pack is here, this asset is not (a mistyped name?)`);
  });
  for (const [pack, n] of missing) out.push({ level: 'warn', at: 'kit', msg: `Content/${pack} is not on this machine: ${n} line${n > 1 ? 's fall' : ' falls'} back to grey boxes (packs are not in git, G-24)` });
  return { out, read };
}

export const STATUSES = ['proposed', 'approved', 'building', 'built', 'accepted', 'returned', 'dropped'];
const HEADINGS = ['Why', 'What the player gets', 'Scope', 'Changes', 'Cost', 'Done when', 'Gate B', 'Log'];

/** one brief against Docs/briefs/TEMPLATE.md and the two gates (G-01, G-02) */
export function lintBrief(name, source, lanes) {
  const out = [], say = msg => out.push({ level: 'fail', at: `briefs:${name}`, msg });
  const front = source.match(/^---\r?\n([\s\S]*?)\r?\n---/), f = {};
  if (!front) { say('no front matter (the block between --- lines at the top)'); return { out, f }; }
  for (const l of front[1].split(/\r?\n/)) { const m = l.match(/^(\w+):\s*(.*)$/); if (m) f[m[1]] = m[2].replace(/^["']|["']$/g, '').trim(); }
  for (const k of ['id', 'lane', 'title', 'status']) if (!f[k]) say(`front matter has no ${k}`);
  if (f.id && !name.startsWith(`${f.id}-`)) say(`the file's name does not start with its id, ${f.id}-`);
  if (f.lane && !lanes.includes(f.lane)) say(`no lane "${f.lane}". Lanes: ${lanes.join(', ')}`);
  if (f.status && !STATUSES.includes(f.status)) say(`status "${f.status}" is none of ${STATUSES.join(', ')}`);
  const past = s => STATUSES.indexOf(f.status) >= STATUSES.indexOf(s) && f.status !== 'dropped';
  if (past('approved') && !f.approved) say(`status ${f.status} without "approved:": Gate A is Leon's, with the date and his words (G-01)`);
  if (f.status === 'accepted' && !f.accepted) say('status accepted without "accepted:": Gate B is Leon\'s, with the date and his words (G-02)');
  for (const h of HEADINGS) if (!new RegExp(`^## ${h}\\b`, 'm').test(source)) say(`no section "## ${h}"`);
  return { out, f };
}

const checks = {
  kit(root) {
    const kit = text(join(root, 'Kit.txt'));
    if (!kit) return [{ level: 'fail', at: 'kit', msg: 'no Kit.txt' }];
    return import(pathToFileURL(join(root, 'Sim', 'sim', 'story.js')).href).then(async story => {
      const { T } = await import(pathToFileURL(join(root, 'Sim', 'sim', 'tuning.js')).href);
      const has = p => { const parts = p.split('/').slice(2); return !under(join(root, 'Content'), [parts[0]]) ? 'nopack' : under(join(root, 'Content'), [...parts.slice(0, -1), `${parts.at(-1)}.uasset`]) ? 'yes' : 'no'; };
      const { out, read } = lintKit(kit, { kinds: kinds(text(join(root, 'Source', 'CrystalVein', 'CVWorldView.cpp'))), rooms: new Set(story.ROOMS.map(r => r[0])), aliens: new Set(Object.keys(T.ai.types)), has });
      return [...out, { level: 'ok', at: 'kit', msg: `${read} lines read against ${story.ROOMS.length} rooms` }];
    });
  },
  briefs(root) {
    const dir = join(root, 'Docs', 'briefs'), lanes = [...readdirSync(join(root, 'Docs', 'lanes')).filter(n => n.endsWith('.md')).map(n => n.slice(0, -3)), 'core'];
    const out = [], seen = [];
    for (const n of readdirSync(dir).filter(n => n.endsWith('.md') && n !== 'TEMPLATE.md').sort()) {
      const { out: o, f } = lintBrief(n, text(join(dir, n)), lanes);
      out.push(...o); seen.push(f);
    }
    const count = s => seen.filter(f => f.status === s).length, ids = seen.map(f => f.id);
    for (const id of new Set(ids.filter((v, i) => v && ids.indexOf(v) !== i))) out.push({ level: 'fail', at: 'briefs', msg: `two briefs are called ${id}` });
    if (count('building') > 1) out.push({ level: 'fail', at: 'briefs', msg: `${count('building')} briefs are building: one builder at a time (G-30)` });
    if (count('built') >= 2) out.push({ level: 'warn', at: 'briefs', msg: `${count('built')} briefs wait for Leon to play them: nothing new starts building until he has (G-07)` });
    out.push({ level: 'ok', at: 'briefs', msg: seen.map(f => `${f.id} ${f.status}`).join(', ') || 'none' });
    return out;
  },
  docs(root) {
    const files = [join(root, 'CLAUDE.md'), join(root, 'README.md'), ...walk(join(root, 'Docs'), n => n.endsWith('.md'))].filter(existsSync);
    const rules = new Set([...text(join(root, 'Docs', 'GUARDRAILS.md')).matchAll(/\*\*(G-\d\d)\*\*/g)].map(m => m[1])), out = [];
    for (const f of files) {
      const src = text(f), at = `docs:${relative(root, f).replaceAll('\\', '/')}`;
      for (const [, to] of src.matchAll(/\]\(([^)\s]+)\)/g)) {
        if (/^(https?:|mailto:|#)/.test(to)) continue;
        if (!existsSync(resolve(dirname(f), decodeURIComponent(to.split('#')[0])))) out.push({ level: 'fail', at, msg: `links to ${to}, which is not there` });
      }
      for (const g of new Set([...src.matchAll(/\bG-\d\d\b/g)].map(m => m[0]))) if (!rules.has(g)) out.push({ level: 'fail', at, msg: `names ${g}, which Docs/GUARDRAILS.md does not have` });
    }
    return [...out, { level: 'ok', at: 'docs', msg: `${files.length} files, ${rules.size} rules` }];
  },
  art(root) {
    const dir = join(root, 'SourceArt', 'Meshy'), log = text(join(root, 'SourceArt', 'PROVENANCE.md')), out = [];
    const models = walk(dir, n => n.endsWith('.glb')).map(f => relative(join(root, 'SourceArt'), f).replaceAll('\\', '/'));
    for (const m of models) if (!log.includes(m)) out.push({ level: 'fail', at: 'art', msg: `${m} has no row in SourceArt/PROVENANCE.md (G-25)` });
    for (const [, file] of text(join(root, 'Tools', 'editor_job.py')).matchAll(/^\s*\('([^']+\.glb)',/gm)) if (!existsSync(join(dir, file))) out.push({ level: 'fail', at: 'art', msg: `Tools/editor_job.py imports SourceArt/Meshy/${file}, which is not there` });
    return [...out, { level: 'ok', at: 'art', msg: `${models.length} generated models, each with its row` }];
  },
  sim(root) {
    const run = spawnSync(process.execPath, ['--test', join('Sim', 'story.test.mjs')], { cwd: root, encoding: 'utf8' });
    const pass = run.stdout?.match(/^# pass (\d+)/m)?.[1], fail = run.stdout?.match(/^# fail (\d+)/m)?.[1];
    return run.status === 0 ? [{ level: 'ok', at: 'sim', msg: `Sim/story.test.mjs: ${pass} pass` }]
      : [{ level: 'fail', at: 'sim', msg: `Sim/story.test.mjs: ${fail ?? '?'} fail. Run node --test Sim/story.test.mjs\n${(run.stdout ?? '').split('\n').filter(l => /^not ok|error:/i.test(l.trim())).slice(0, 8).join('\n')}` }];
  },
  async loop(root) {
    const st = look(root);
    if (st.missing) return [{ level: 'warn', at: 'loop', msg: 'no Saved/DevLoop: DevLoop.bat has never run here' }];
    const loops = await loopsWaiting(st.dir), out = [];
    if (loops > 1) out.push({ level: 'fail', at: 'loop', msg: `${loops} work loops are open: Leon closes all but one (G-31)` });
    if (st.lying.length) out.push({ level: 'fail', at: 'loop', msg: `${st.lying.join(', ')} is lying in Saved/DevLoop${loops ? '' : ' and no loop is open'}: rename it away (G-32)` });
    if (st.locks.length) out.push({ level: 'fail', at: 'loop', msg: `.git holds ${st.locks.join(', ')}: the next commit would fail (Docs/RUNBOOK.md, "Git")` });
    if (!loops) out.push({ level: 'warn', at: 'loop', msg: 'no work loop is waiting (none is open, or it is in the middle of a job): builds, runs and commits need Leon to start DevLoop.bat' });
    return [...out, { level: 'ok', at: 'loop', msg: `${loops} waiting; a run now would be a ${st.kind}` }];
  },
};

async function main(argv) {
  const i = argv.indexOf('--root'), root = resolve(i < 0 ? join(dirname(fileURLToPath(import.meta.url)), '..') : argv.splice(i, 2)[1]);
  const wanted = argv.length ? argv : Object.keys(checks);
  let failed = 0;
  for (const name of wanted) {
    if (!checks[name]) { console.log(`no check "${name}". The checks: ${Object.keys(checks).join(' ')}`); return 1; }
    let found;
    try { found = await checks[name](root); } catch (e) { found = [{ level: 'fail', at: name, msg: e.message }]; }
    for (const r of [...found].sort((a, b) => (a.level === 'ok') - (b.level === 'ok'))) { failed += r.level === 'fail'; console.log(`${{ fail: 'FAIL', warn: 'warn', ok: 'ok  ' }[r.level]} ${r.at.padEnd(10)} ${r.msg}`); }
  }
  console.log(failed ? `\n${failed} failed` : '\nnothing failed');
  return failed ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(await main(process.argv.slice(2)));
