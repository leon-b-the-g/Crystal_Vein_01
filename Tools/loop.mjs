// Asks DevLoop.bat for one job and waits for it. Every agent uses this instead of writing request files by hand, so the
// rules of the loop are kept by a program and not by memory (Docs/GUARDRAILS.md G-31, G-32, G-36; Docs/RUNBOOK.md).
//
//   node Tools/loop.mjs status
//   node Tools/loop.mjs build | run | editor | commit | push   [--wait 100]
//   node Tools/loop.mjs wait [--wait 100]      go on waiting for the job asked for last
//
// exit 0: the job ended with result 0 · 1: it ended with another result, or the request was refused · 2: still running, call wait
// Needs Node 18. It runs wherever the project folder is: on the PC, or in a shell that has the folder mounted. No clock is
// compared with a file's time anywhere in here: a shell that mounts the PC's disk may have a clock of its own.
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, renameSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const JOBS = ['build', 'run', 'editor', 'commit', 'push'];
const WATCH = Number(process.env.LOOP_WATCH_MS ?? 4000); // a waiting loop rewrites its loop.NNN.alive every two seconds
const POLL = Number(process.env.LOOP_POLL_MS ?? 1000);
const UNTAKEN = Number(process.env.LOOP_UNTAKEN_MS ?? 15000);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const mtime = f => { try { return statSync(f).mtimeMs; } catch { return 0; } };
const text = f => { try { return readFileSync(f, 'utf8'); } catch { return ''; } };
const beats = dir => readdirSync(dir).filter(n => /^loop\..+\.alive$/.test(n)).map(n => [n, mtime(join(dir, n))]);

/** how many loops are waiting for a request: those whose heartbeat file moves while we watch */
export async function loopsWaiting(dir, ms = WATCH) {
  if (!existsSync(dir)) return 0;
  const before = new Map(beats(dir));
  await sleep(ms);
  return beats(dir).filter(([n, t]) => before.get(n) !== t).length;
}

/** what Saved/DevLoop says, without waiting */
export function look(root) {
  const dir = join(root, 'Saved', 'DevLoop');
  if (!existsSync(dir)) return { dir, missing: true, lying: [], locks: [], asked: null, kind: 'demo' };
  const names = readdirSync(dir), lying = names.filter(n => JOBS.some(j => n === `${j}.request`));
  const git = join(root, '.git'), locks = existsSync(git) ? readdirSync(git).filter(n => n.endsWith('.lock')) : [];
  let asked = null; try { asked = JSON.parse(text(join(dir, 'asked.json'))); } catch { /* nothing asked yet */ }
  if (asked) {
    // the loop deletes a job's result file when it starts the job and writes it when the job ends: a result that is not the one
    // that lay there when we asked is ours
    const result = join(dir, `${asked.job}.result`);
    asked.done = !lying.includes(`${asked.job}.request`) && existsSync(result) && mtime(result) !== asked.before;
    asked.result = asked.done ? text(result).trim() : null;
  }
  const kind = names.includes('gallery.txt') ? 'gallery' : names.includes('tour.txt') ? 'tour' : 'demo';
  return { dir, lying, locks, asked, kind };
}

/** why this job may not be asked for now; nothing when it may. loops: how many are waiting (loopsWaiting). */
export function refusal(job, st, loops) {
  if (st.missing) return `no ${st.dir}: DevLoop.bat has never run here. Leon starts it once.`;
  if (st.lying.length) return `a request nobody took is lying in Saved/DevLoop (${st.lying.join(', ')}). Rename it away: a loop started later would act on it.`;
  if (loops > 1) return `${loops} work loops are open. Stop and tell Leon to close all but one (G-31).`;
  if (loops < 1) return st.asked && !st.asked.done
    ? `the ${st.asked.job} asked for last is still running, or the loop was closed in the middle of it: node Tools/loop.mjs wait`
    : 'no work loop is waiting. Leon starts DevLoop.bat once and leaves the window open (it checks for six seconds before it waits).';
  if ((job === 'commit' || job === 'push') && st.locks.length) return `.git holds ${st.locks.join(', ')}: git would fail. See Docs/RUNBOOK.md, "Git".`;
  if (job === 'commit') {
    const msg = text(join(st.dir, 'commit.txt'));
    if (!msg.trim()) return 'Saved/DevLoop/commit.txt is missing or empty: write the commit message there first.';
    if (!/^Co-Authored-By: /m.test(msg)) return 'commit.txt has no Co-Authored-By trailer (G-34).';
  }
  return '';
}

/** what an agent has to read after a job, so that it need not remember which log to open */
function report(st) {
  const { dir } = st, job = st.asked.job, lines = f => text(join(dir, f)).split(/\r?\n/);
  const out = [`${job}: result ${st.asked.result}`];
  if (job === 'build' && st.asked.result !== '0') out.push(...lines('build.log').filter(l => /\berror\b/i.test(l)).slice(0, 30));
  if (job === 'run') {
    const log = lines('run.log'), bad = log.filter(l => /missing usage flag|Kit\.txt: .*(cannot read|not in this project|nothing to do)|LogCrystalVein: Error/.test(l));
    out.push(`run.log: ${log.length} lines, ${log.filter(l => l.includes('Warning:')).length} warnings, ${log.filter(l => l.includes('LogCrystalVein')).length} of the game's own`);
    out.push(...[...new Set(bad.map(l => l.replace(/^(\[[^\]]*\])+/, '')))].slice(0, 20));
    if (mtime(join(dir, 'run_2.log')) !== (st.asked.twin ?? 0)) out.push('run_2.log was written during this run: the game ran twice at once. Two loops (G-31).');
  }
  if (job === 'editor') out.push(...lines('editor_job.log').filter(l => /failed|^done/i.test(l)).slice(-10));
  if (job === 'commit') out.push(...lines('git.log').filter(l => /^\[|files? changed|nothing to commit|error|fatal/i.test(l)).slice(0, 10));
  if (job === 'push') out.push(...lines('git.log').filter(Boolean).slice(-8));
  return out.join('\n');
}

async function waitFor(root, seconds) {
  const sig = dir => JSON.stringify(beats(dir));
  // taken: the heartbeats as they stood two polls after our request was gone (a mounted disk may show a file's time late)
  let taken = null, gone = 0, since = Date.now();
  for (const end = Date.now() + seconds * 1000; ;) {
    const st = look(root);
    if (!st.asked) { console.log('nothing has been asked for'); return 1; }
    if (st.asked.done) { console.log(report(st)); return st.asked.result === '0' ? 0 : 1; }
    const request = join(st.dir, `${st.asked.job}.request`);
    if (existsSync(request)) {
      if (Date.now() - since > UNTAKEN) { // never leave a request lying (G-32)
        renameSync(request, `${request}.not-taken-${Date.now()}`);
        console.log(`nobody took the ${st.asked.job} request: no work loop is open. It was renamed away. Leon starts DevLoop.bat.`);
        return 1;
      }
    } else if (taken === null) { if (++gone > 2) taken = sig(st.dir); }
    else if (taken !== sig(st.dir)) { // a loop waits again, and it writes a job's result before it does
      await sleep(2 * POLL);
      const now = look(root);
      if (now.asked.done) { console.log(report(now)); return now.asked.result === '0' ? 0 : 1; }
      console.log(`the ${st.asked.job} has no result, yet a loop is waiting: the loop was closed in the middle of the job, or a second one was opened. node Tools/loop.mjs status`);
      return 1;
    }
    if (Date.now() >= end) { console.log(`${st.asked.job}: still running. node Tools/loop.mjs wait`); return 2; }
    await sleep(POLL);
  }
}

async function main(argv) {
  const opt = k => { const i = argv.indexOf(`--${k}`); return i < 0 ? undefined : argv.splice(i, 2)[1]; };
  const root = resolve(opt('root') ?? join(dirname(fileURLToPath(import.meta.url)), '..')), seconds = Number(opt('wait') ?? 100), [job] = argv;
  const st = look(root);
  if (job === 'status') {
    console.log(st.missing ? `no ${st.dir}` : [`work loops waiting: ${await loopsWaiting(st.dir)}`,
      `asked for last: ${st.asked ? `${st.asked.job}, ${st.asked.done ? `result ${st.asked.result}` : 'no result yet'}` : 'nothing'}`,
      `requests lying: ${st.lying.join(', ') || 'none'}`, `git locks: ${st.locks.join(', ') || 'none'}`, `a run now would be a ${st.kind}`].join('\n'));
    return 0;
  }
  if (job === 'wait') return waitFor(root, seconds);
  if (!JOBS.includes(job)) { console.log('usage: node Tools/loop.mjs status | wait | build | run | editor | commit | push  [--wait seconds]'); return 1; }
  const no = refusal(job, st, st.missing ? 0 : await loopsWaiting(st.dir));
  if (no) { console.log(`refused: ${no}`); return 1; }
  if (job === 'run') console.log(`this run is a ${st.kind}${st.kind === 'demo' ? ' (about five and a half minutes)' : ''}`);
  writeFileSync(join(st.dir, 'asked.json'), JSON.stringify({ job, before: mtime(join(st.dir, `${job}.result`)), twin: mtime(join(st.dir, 'run_2.log')) }));
  writeFileSync(join(st.dir, `${job}.request`), '');
  return waitFor(root, seconds);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(await main(process.argv.slice(2)));
