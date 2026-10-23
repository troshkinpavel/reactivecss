// One shared scheduler for the whole page.
// - every(ms, sub) / unevery(ms, sub): periodic work, grouped by interval, one setTimeout.
// - dirty(job): queues a job for the next requestAnimationFrame flush, which first computes
//   every queued job (DOM reads) and then writes the changed ones (DOM writes).
// - frame(fn): run fn at the start of the next flush (event sources use it to coalesce).
// While the tab is hidden, periodic work stops; missed ticks are skipped, not replayed.
// Subscribers are objects with methods, not closures, to keep per-binding memory small.

import { dev, probes } from './log';

export interface Job {
  /** Set by the scheduler while the job is queued (dedupe without a Set lookup). */
  queued?: boolean;
  /** Read phase: return true when write() must run. */
  compute(): boolean;
  /** Write phase. */
  write(): void;
}

export interface Tickable { tick(): void }

interface Group { ms: number; next: number; subs: Set<Tickable> }

const groups = new Map<number, Group>();
let queue: Job[] = [];
/** Event-driven work (state changes from user input): never deferred by the frame budget. */
let urgent: Job[] = [];
let urgentDepth = 0;
/** New jobs waiting for their first value (see settle()). */
let fresh: Job[] = [];
/** Jobs that read computed style after this flush's writes (text:), so they see this frame's values. */
let lateJobs: Job[] = [];
/** Jobs read in the same task by urgently(), to read once more in the next frame (see there). */
const recheck = new Set<Job>();
const frameTasks = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | undefined;
let raf = 0;
if (dev) Object.assign(probes, {
  queued: () => queue.length + urgent.length + lateJobs.length + recheck.size, fresh: () => fresh.length, frameTasks: () => frameTasks.size,
  rafPending: () => +!!raf, timerPending: () => +(timer !== undefined),
});
export const counters = {
  flushes: 0, lastFlushMs: 0, totalFlushMs: 0, ticks: 0, tickMs: 0,
  /** Flush phases: event sources, evaluation (reads), DOM writes. */
  sourceMs: 0, computeMs: 0, writeMs: 0, jobs: 0, writes: 0,
  /** sync() runs that applied pending urgent work before an event. */
  syncs: 0,
  /** Late phases run at the end of event-driven work instead of in the frame (attr:). */
  prompt: 0,
};

const now = () => performance.now();
const hidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden';

function arm() {
  clearTimeout(timer);
  timer = undefined;
  if (hidden() || groups.size === 0) return;
  let next = Infinity;
  for (const g of groups.values()) next = Math.min(next, g.next);
  timer = setTimeout(tick, Math.max(0, next - now()));
}

function tick() {
  const t = now();
  for (const g of groups.values()) {
    if (g.next > t + 1) continue;
    counters.ticks++;
    for (const s of g.subs) s.tick();
    g.next += g.ms;
    // Throttled or long-blocked: skip missed ticks instead of firing a burst.
    if (g.next <= t) g.next = t + g.ms;
  }
  counters.tickMs += now() - t;
  arm();
}

export function every(ms: number, sub: Tickable): void {
  let g = groups.get(ms);
  if (!g) {
    g = { ms, next: now() + ms, subs: new Set() };
    groups.set(ms, g);
    arm();
  }
  g.subs.add(sub);
}

export function unevery(ms: number, sub: Tickable): void {
  const g = groups.get(ms);
  if (!g || !g.subs.delete(sub) || g.subs.size) return;
  groups.delete(ms);
  arm();
}

/**
 * Script time a frame flush aims to stay under. Bigger batches (e.g. 20,000 live() values
 * ticking together) continue in the next frame, oldest first, instead of dropping a frame.
 * The browser's style recalc for the written values comes on top of this.
 */
export const FRAME_BUDGET_MS = 4;
let costPerJob = 0.0005; // ms, running estimate of compute + write per job

function request() {
  if (!raf) raf = requestAnimationFrame(frameFlush);
}

function frameFlush() {
  raf = 0;
  flush(Math.max(256, Math.floor(FRAME_BUDGET_MS / costPerJob)));
}

export function dirty(job: Job): void {
  if (job.queued) return;
  job.queued = true;
  (urgentDepth ? urgent : queue).push(job);
  request();
}

/**
 * The user event being dispatched by an action or a bound control, while its state changes run
 * (null otherwise). focus: arms a transition only for trusted activation events (rfc-focus-declaration-0.6).
 */
export const activation: { event: Event | null } = { event: null };

/** Run after a late phase completes (same-task passes, frame flush), outside the queues (focus:). */
const afterLate = new Set<(sameTask: boolean) => void>();
export function onAfterLate(fn: (sameTask: boolean) => void): void { afterLate.add(fn); }

/** Late work queued by event-driven changes that must not wait for the frame (see urgently()). */
let soon = false;

/**
 * Queues a job for the late phase of the next flush: after every write of that flush.
 * `promptly`: when queued by event-driven work, the late phase runs as soon as that work ends,
 * in the same task (attr: — a `disabled` derived from a click is in place before the next click).
 */
export function late(job: Job, promptly = false): void {
  if (promptly && urgentDepth) soon = true;
  if (job.queued) return;
  job.queued = true;
  lateJobs.push(job);
  request();
}

/** Runs fn; every job it (indirectly) queues goes to the urgent lane of the next frame. */
export function urgently<T>(fn: () => T): T {
  urgentDepth++;
  try { return fn(); } finally {
    if (--urgentDepth === 0 && soon) {
      soon = false;
      sync(); // the state's own CSS first (cells, when() values, :when() markers)…
      const done = lateJobs.slice();
      // …then one style read for the late jobs. If that wrote anything, read once more: a written
      // attribute can change what applies to another binding (an ancestor's `hidden`, attribute
      // selectors), and WebKit (27.2) can return a stale value in the same task for an element
      // under display: none. One extra pass only: attribute selectors that flip each other cannot loop.
      if (runLate()) { for (const j of done) late(j); runLate(); }
      // …and once more in the frame (same WebKit reason; writes only on change). A separate queue:
      // in the late queue, the next event's same-task pass would re-read every job of every
      // earlier event in this frame (quadratic in events per frame).
      for (const j of done) recheck.add(j);
      request();
      counters.prompt++;
      for (const fn of afterLate) fn(true);
    }
  }
}

/** Runs the late phase; returns the number of jobs that wrote. */
function runLate(): number {
  if (!lateJobs.length) return 0;
  const list = lateJobs;
  lateJobs = [];
  let w = 0;
  for (let i = 0; i < list.length; i++) { list[i].queued = false; if (list[i].compute()) list[w++] = list[i]; }
  for (let i = 0; i < w; i++) list[i].write();
  return w;
}

/** Queues a new job for settle() instead of a frame. */
export function settleLater(job: Job): void {
  fresh.push(job);
}

/**
 * Computes and writes every new job now, in one pass (all reads, then all writes).
 * Called at the end of each stylesheet application and each DOM mutation batch, so new
 * elements get their values in the same task, before any script or paint sees them.
 */
export function settle(): void {
  const list = fresh;
  fresh = [];
  const writes = list.filter((j) => j.compute());
  for (const j of writes) j.write();
}

/** Called by sync() before urgent jobs run (selector runtimes with frame-deferred markers). */
const syncHooks = new Set<() => void>();
export function onSync(fn: () => void): void { syncHooks.add(fn); }

/**
 * Applies pending urgent work now: the logical consequences (state cells, :when() and
 * :nth-var() markers) of actions that already ran in this frame. Called before an event is
 * dispatched, so a second event in the same frame resolves the cascade against the latest
 * state instead of last frame's markers. Background jobs, the frame budget and rendering stay
 * in the frame; with nothing pending this does nothing.
 */
export function sync(): void {
  if (!urgent.length) return;
  for (const fn of syncHooks) fn();
  const jobs = urgent;
  urgent = [];
  let w = 0;
  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    job.queued = false;
    if (job.compute()) jobs[w++] = job;
  }
  for (let i = 0; i < w; i++) jobs[i].write();
  counters.syncs++;
}

export function frame(fn: () => void): void {
  frameTasks.add(fn);
  request();
}

/** Runs queued work now. `limit` caps the number of jobs; the rest stay queued for the next frame. */
export function flush(limit = Infinity): void {
  const t0 = now();
  // Snapshot: tasks scheduled while these run belong to the next frame.
  const tasks = [...frameTasks];
  frameTasks.clear();
  for (const fn of tasks) fn();
  const t1 = now();
  const all = queue;
  const n0 = Math.min(all.length, limit);
  queue = n0 < all.length ? all.slice(n0) : []; // deferred jobs stay marked queued
  if (queue.length) request();
  // Urgent jobs first and always complete; then as many background jobs as the budget allows.
  const jobs = urgent.length ? urgent.concat(n0 < all.length ? all.slice(0, n0) : all) : all;
  const n = urgent.length + n0;
  urgent = [];
  let w = 0;
  for (let i = 0; i < n; i++) {
    const job = jobs[i];
    job.queued = false;
    if (job.compute()) jobs[w++] = job; // reuse the array for the write list
  }
  const t2 = now();
  for (let i = 0; i < w; i++) jobs[i].write();
  for (const j of recheck) late(j);
  recheck.clear();
  runLate(); // one style read for all of them after the writes above, then their writes
  for (const fn of afterLate) fn(false);
  const t3 = now();
  if (n >= 64) costPerJob = costPerJob * 0.7 + ((t3 - t1) / n) * 0.3;
  counters.flushes++;
  counters.jobs += n;
  counters.writes += w;
  counters.sourceMs += t1 - t0;
  counters.computeMs += t2 - t1;
  counters.writeMs += t3 - t2;
  counters.lastFlushMs = t3 - t0;
  counters.totalFlushMs += t3 - t0;
}

export function subscriptionCount(): number {
  let n = 0;
  for (const g of groups.values()) n += g.subs.size;
  return n;
}

export function groupCount(): number {
  return groups.size;
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!hidden()) {
      const t = now();
      for (const g of groups.values()) if (g.next < t) g.next = t;
    }
    arm();
  });
}
