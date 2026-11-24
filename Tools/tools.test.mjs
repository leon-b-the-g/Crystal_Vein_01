// The two tools checked against small made-up projects: node --test Tools/tools.test.mjs   (about five seconds, no Unreal, no loop needed)
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, existsSync, renameSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { kinds, lintKit, lintBrief } from './preflight.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CPP = `enum ECVKind { KFloor, KTable, KScreen, KCreep, KAlien, KCell, KCount, KTileKinds = KCreep + 1 };
const TCHAR* const CVKindNames[KCount] = { TEXT("Floor"), TEXT("Table"), TEXT("Screen"), TEXT("Creep"), TEXT("Alien"), TEXT("Cell"), };
const int32 CVKitKinds[] = { KFloor, KTable, KCell };
const TCHAR* const CVPlaceNames[] = { TEXT("WallFace"), TEXT("Crust") };`;

test('the pieces are read from the code that reads Kit.txt', () => {
  assert.deepEqual(kinds(CPP), { names: ['Floor', 'Table', 'Screen', 'Creep', 'Alien', 'Cell'], places: ['WallFace', 'Crust'], plain: ['Floor', 'Table', 'Cell'], tiles: ['Floor', 'Table', 'Screen', 'Creep'] });
  assert.throws(() => kinds('nothing of the kind'), /bring Tools\/preflight.mjs up to date/);
});

test('Kit.txt: what the game would skip in silence is said out loud', () => {
  const ctx = { kinds: kinds(CPP), rooms: new Set(['Workshop', "Loadmaster's office"]), aliens: new Set(['mite']), has: p => p.includes('/Gone/') ? 'nopack' : p.endsWith('Typo') ? 'no' : 'yes' };
  const lint = src => lintKit(src, ctx).out.map(r => `${r.level} ${r.at} ${r.msg}`);
  assert.deepEqual(lint([
    '# a comment', '',
    'Floor = /Game/Kit/SM_Floor',
    'Table @ Workshop = /Game/Kit/SM_Bench scale=1.5 yaw=90   # a bench',
    "Table @ Loadmaster's office + /Game/Kit/SM_Monitor z=1 glow=cold",
    'Table + none',
    'WallFace + /Game/Kit/SM_Panel',
    'Crust + /Game/Kit/SM_Crust',
    "Floor + /Script/Engine.StaticMesh'/Game/Kit/SM_Paper.SM_Paper'",
    'mite = /Game/Own/SM_Mite yaw=-90',
  ].join('\r\n')), [], 'every good kind of line passes');
  const bad = lint(['Table @ Work shop = /Game/Kit/SM_Bench', 'Table + /Game/Kit/SM_Lamp glow=red', 'Shelf + /Game/Kit/SM_Shelf', 'Screen = /Game/Kit/SM_Screen', 'Alien + /Game/Kit/SM_Hat',
    'Cell @ Workshop = /Game/Kit/SM_Cell', 'Floor = /Game/Kit/SM_Typo', 'Floor = /Game/Gone/SM_Floor', 'Table = none', 'Table /Game/Kit/SM_Bench', 'ghoul = /Game/Own/SM_Ghoul', 'Floor = SM_Floor'].join('\n'));
  for (const [at, part] of [[1, 'no room is called "Work shop"'], [2, '"glow=red"'], [3, 'no piece is called "Shelf"'], [4, 'nothing to do with "Screen ="'], [5, 'nothing to do with "Alien +"'],
    [6, 'is ignored for Cell'], [7, 'this asset is not'], [9, 'needs a room'], [10, 'cannot be read'], [12, 'an asset is /Game/Folder/Name']])
    assert(bad.some(l => l.startsWith(`fail kit:${at} `) && l.includes(part)), `line ${at}: ${part}\n${bad.join('\n')}`);
  assert(bad.some(l => l.startsWith('warn kit:11 ') && l.includes('neither a piece nor')), 'an unknown alien is a warning');
  assert(bad.some(l => l === 'warn kit Content/Gone is not on this machine: 1 line falls back to grey boxes (packs are not in git, G-24)'), 'a missing pack is a warning, once');
  assert.equal(bad.filter(l => l.startsWith('fail')).length, 10, bad.join('\n'));
});

test('a brief: its sections, its status, and the two gates', () => {
  const brief = (front, body = ['Why', 'What the player gets', 'Scope', 'Changes', 'Cost', 'Done when', 'Gate B', 'Log'].map(h => `## ${h}\n\ntext\n`).join('\n')) => `---\n${front}\n---\n\n# T\n\n${body}`;
  const lint = (name, src) => lintBrief(name, src, ['levels', 'core']).out.map(r => r.msg);
  assert.deepEqual(lint('L-001-a.md', brief('id: L-001\nlane: levels\ntitle: A\nstatus: proposed')), []);
  assert.deepEqual(lint('L-001-a.md', brief('id: L-001\nlane: levels\ntitle: A\nstatus: accepted\napproved: 2026-11-24, Leon: "go"\naccepted: 2026-11-30, Leon: "good"')), []);
  assert.match(lint('L-001-a.md', brief('id: L-001\nlane: levels\ntitle: A\nstatus: building'))[0], /Gate A is Leon's/);
  assert.match(lint('L-001-a.md', brief('id: L-001\nlane: levels\ntitle: A\nstatus: accepted\napproved: x'))[0], /Gate B is Leon's/);
  assert.deepEqual(lint('L-001-a.md', brief('id: L-001\nlane: levels\ntitle: A\nstatus: dropped')), [], 'a dropped brief needs no gate');
  assert.match(lint('X-9-a.md', brief('id: L-001\nlane: music\ntitle: A\nstatus: done')).join('|'), /does not start with its id.*no lane "music".*status "done"/);
  assert.match(lint('L-001-a.md', brief('id: L-001\nlane: levels\ntitle: A\nstatus: proposed', '## Why\n'))[0], /no section "## What the player gets"/);
  assert.match(lint('L-001-a.md', 'no front matter here')[0], /no front matter/);
});

// --- loop.mjs against a stand-in for DevLoop.bat: it beats, takes a request by renaming it, deletes the old result, writes a new one
const project = () => { const root = mkdtempSync(join(tmpdir(), 'kv-')); mkdirSync(join(root, 'Saved', 'DevLoop'), { recursive: true }); mkdirSync(join(root, '.git')); return root; };
const standIn = (root, id, { result = '0', takes = true } = {}) => {
  const dir = join(root, 'Saved', 'DevLoop');
  let n = 0, busy = false;
  const timer = setInterval(() => {
    if (busy) return;
    writeFileSync(join(dir, `loop.${id}.alive`), String(n++));
    const req = takes && readdirSync(dir).find(f => f.endsWith('.request'));
    if (!req) return;
    const job = req.slice(0, -8);
    try { renameSync(join(dir, req), join(dir, `${job}.taking`)); } catch { return; }
    rmSync(join(dir, `${job}.taking`)); rmSync(join(dir, `${job}.result`), { force: true });
    busy = true;
    setTimeout(() => { if (job === 'commit') writeFileSync(join(dir, 'git.log'), '[main abc1234] a commit\n'); writeFileSync(join(dir, `${job}.result`), `${result}\r\n`); busy = false; }, 350);
  }, 60);
  return () => clearInterval(timer);
};
const loop = (root, ...args) => new Promise(done => {
  const child = spawn(process.execPath, [join(HERE, 'loop.mjs'), ...args, '--root', root], { env: { ...process.env, LOOP_WATCH_MS: '300', LOOP_POLL_MS: '40', LOOP_UNTAKEN_MS: '500' } });
  let out = ''; child.stdout.on('data', d => out += d); child.stderr.on('data', d => out += d);
  child.on('close', code => done({ code, out }));
});

test('loop.mjs: one waiting loop does the job; none, two, or a commit without its trailer are refused', async () => {
  const root = project(), dir = join(root, 'Saved', 'DevLoop');
  let r = await loop(root, 'build');
  assert.equal(r.code, 1); assert.match(r.out, /refused: no work loop is waiting/);
  assert(!existsSync(join(dir, 'build.request')), 'a refused request is never written');

  const stop = standIn(root, 'a');
  writeFileSync(join(dir, 'build.result'), '1\r\n'); // an old result must not be taken for the new one
  r = await loop(root, 'build');
  assert.equal(r.code, 0, r.out); assert.match(r.out, /build: result 0/);

  r = await loop(root, 'commit');
  assert.match(r.out, /refused: Saved\/DevLoop\/commit.txt is missing or empty/);
  writeFileSync(join(dir, 'commit.txt'), 'A change\n');
  r = await loop(root, 'commit');
  assert.match(r.out, /refused: commit.txt has no Co-Authored-By trailer/);
  writeFileSync(join(dir, 'commit.txt'), 'A change\n\nCo-Authored-By: Claude <noreply@anthropic.com>\n');
  writeFileSync(join(root, '.git', 'index.lock'), '');
  r = await loop(root, 'commit');
  assert.match(r.out, /refused: \.git holds index\.lock/);
  rmSync(join(root, '.git', 'index.lock'));
  r = await loop(root, 'commit');
  assert.equal(r.code, 0, r.out); assert.match(r.out, /commit: result 0\n\[main abc1234\] a commit/);

  const stopSecond = standIn(root, 'b');
  r = await loop(root, 'run');
  assert.equal(r.code, 1); assert.match(r.out, /refused: 2 work loops are open/);
  stopSecond(); stop();
  r = await loop(root, 'status');
  assert.match(r.out, /work loops waiting: 0\nasked for last: commit, result 0\nrequests lying: none\ngit locks: none\na run now would be a demo/);
  rmSync(root, { recursive: true });
});

test('loop.mjs: a failed job is exit 1 with the errors; a request nobody takes is renamed away, not left lying', async () => {
  const root = project(), dir = join(root, 'Saved', 'DevLoop');
  const stop = standIn(root, 'a', { result: '6' });
  writeFileSync(join(dir, 'build.log'), 'Compiling\r\nCVPawn.cpp(12): error C2065: undeclared identifier\r\nwarning: unused\r\n');
  let r = await loop(root, 'build');
  assert.equal(r.code, 1); assert.match(r.out, /build: result 6\nCVPawn.cpp\(12\): error C2065/); assert.doesNotMatch(r.out, /unused/);
  stop();

  const deaf = standIn(root, 'c', { takes: false }); // it beats, and never takes the request: a loop closed just after we looked
  r = await loop(root, 'push');
  deaf();
  assert.equal(r.code, 1); assert.match(r.out, /nobody took the push request/);
  assert(!existsSync(join(dir, 'push.request')) && readdirSync(dir).some(f => f.startsWith('push.request.not-taken-')), readdirSync(dir).join(' '));

  writeFileSync(join(dir, 'tour.txt'), '5 4\n');
  writeFileSync(join(dir, 'run.request'), '');
  r = await loop(root, 'build');
  assert.match(r.out, /refused: a request nobody took is lying in Saved\/DevLoop \(run.request\)/);
  assert.match((await loop(root, 'status')).out, /a run now would be a tour/);
  assert.equal(JSON.parse(readFileSync(join(dir, 'asked.json'), 'utf8')).job, 'push');
  rmSync(root, { recursive: true });
});
