// 0.10 step 7 (timers): :on(after()) and :on(every()). Toast, hold-to-repeat, clock as state +
// every(), resend countdown, background tab, dynamic selectors, ownership, rejected rules.
// Deterministic: Playwright's fake clock (Date, timers and frames move only with it).
import { test, expect, type Page } from '@playwright/test';
import { open, style, diagnostics } from './helpers';

const v = (page: Page, sel: string, p: string) => style(page, sel, p).then((s) => s.trim());
const text = (page: Page, sel: string) => page.$eval(sel, (e) => e.textContent);
const sources = (page: Page) => page.evaluate(() => window.ReactiveCSS.stats().sources as number);
/** Opens the page with the clock paused at `iso` (installed 10s earlier, so pauseAt() is never in the past). */
async function start(page: Page, head: string, body: string, iso = '2026-10-28T10:00:00Z') {
  const at = new Date(iso);
  await page.clock.install({ time: new Date(at.getTime() - 10_000) });
  await page.clock.pauseAt(at);
  await open(page, { head: `<style>${head}</style>`, body });
  await page.clock.runFor(50);
}
/** Emulates the page being hidden or shown (Playwright cannot background a tab). */
const visibility = (page: Page, state: 'hidden' | 'visible') => page.evaluate((s) => {
  Object.defineProperty(document, 'visibilityState', { value: s, configurable: true });
  Object.defineProperty(document, 'hidden', { value: s === 'hidden', configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}, state);

const TOAST = `.app { --visible: state(false); --other: state(0) }
  .app .show:on(click) { --visible: set(true) }
  .app .hide:on(click) { --visible: set(false) }
  .app .bump:on(click) { --other: increment(1) }
  .toast { display: none }
  .app:when(--visible) .toast { display: block }
  .toast:when(--visible):on(after(3s)) { --visible: set(false) }`;
const TOAST_BODY = '<div class="app"><button class="show">show</button><button class="hide">hide</button><button class="bump">bump</button><div class="toast">Saved</div></div>';
const shown = (page: Page) => page.$eval('.toast', (e) => getComputedStyle(e).display !== 'none');

test('toast: after() starts when the rule becomes active and fires once', async ({ page }) => {
  await start(page, TOAST, TOAST_BODY);
  expect(await sources(page)).toBe(0); // inactive: no timer
  await page.click('.show');
  await page.clock.runFor(1000);
  expect(await sources(page)).toBe(1);
  await page.click('.bump'); // an unrelated state change: no restart
  await page.clock.runFor(1900);
  expect(await shown(page)).toBe(true);
  await page.clock.runFor(150);
  expect(await shown(page)).toBe(false);
  expect(await sources(page)).toBe(0);
  expect(await diagnostics(page)).toEqual([]);
});

test('toast: cancelled when inactive; a new timer when active again', async ({ page }) => {
  await start(page, TOAST, TOAST_BODY);
  await page.click('.show');
  await page.clock.runFor(2000);
  await page.click('.hide');
  await page.clock.runFor(500);
  expect(await sources(page)).toBe(0);
  await page.click('.show'); // 2.5s after the first show
  await page.clock.runFor(1000); // the first timer would have fired here
  expect(await shown(page)).toBe(true);
  await page.clock.runFor(2100);
  expect(await shown(page)).toBe(false);
});

test('hold-to-repeat: every(80ms, 400ms) while held, no duplicate timers', async ({ page }) => {
  await start(page, `.counter { --held: state(false); --count: state(0) }
    .counter button:on(pointerdown) { --held: set(true) }
    .counter button:on(pointerup | pointerleave | pointercancel) { --held: set(false) }
    .counter:when(--held):on(every(80ms, 400ms)) { --count: increment(1) }`,
  '<div class="counter"><button style="position:absolute;left:50px;top:50px;width:100px;height:40px">+</button></div>');
  await page.mouse.move(100, 70);
  await page.mouse.down();
  await page.clock.runFor(380);
  expect(await v(page, '.counter', '--count')).toBe('0');
  // The :when() marker is written in the frame after the press (≤16ms), which starts the timer;
  // the run's value is in CSS one frame later: the first repeat shows by 432ms.
  await page.clock.runFor(60);
  expect(await v(page, '.counter', '--count')).toBe('1');
  await page.clock.runFor(80 * 5);
  expect(await v(page, '.counter', '--count')).toBe('6');
  await page.mouse.up();
  await page.clock.runFor(1000);
  expect(await v(page, '.counter', '--count')).toBe('6');
  expect(await sources(page)).toBe(0);
  // Quick presses never run (each press restarts the 400ms first delay), and leave no timers.
  for (let i = 0; i < 5; i++) { await page.mouse.down(); await page.clock.runFor(100); await page.mouse.up(); await page.clock.runFor(20); }
  expect(await v(page, '.counter', '--count')).toBe('6');
  expect(await sources(page)).toBe(0);
  expect(await diagnostics(page)).toEqual([]);
});

test('every(): the first run after one interval; skipped, not replayed, when blocked', async ({ page }) => {
  await start(page, '.t { --n: state(0) } .t:on(every(1s)) { --n: increment(1) }', '<div class="t"></div>');
  await page.clock.runFor(940);
  expect(await v(page, '.t', '--n')).toBe('0');
  await page.clock.runFor(60);
  expect(await v(page, '.t', '--n')).toBe('1');
  await page.clock.fastForward(5000); // a long block: at most one late run, then the rhythm again
  await page.clock.runFor(20);
  expect(await v(page, '.t', '--n')).toBe('2');
  await page.clock.runFor(1000);
  expect(await v(page, '.t', '--n')).toBe('3');
});

test('a clock as a state: every(1s) sets time(), format() shows it, across a minute', async ({ page }) => {
  await start(page, `.clock { --now: state(time()) }
    .clock:on(every(1s)) { --now: set(time()) }
    .clock .t { text: format(timezone(--now, "UTC"), "HH:mm:ss") }`,
  '<div class="clock"><span class="t"></span></div>', '2026-10-28T10:00:58Z');
  expect(await text(page, '.t')).toBe('10:00:58');
  await page.clock.runFor(1000);
  expect(await text(page, '.t')).toBe('10:00:59');
  await page.clock.runFor(1000);
  expect(await text(page, '.t')).toBe('10:01:00');
  expect(await diagnostics(page)).toEqual([]);
});

test('resend: after(30s) re-enables the button; the countdown comes from timestamps', async ({ page }) => {
  await start(page, `.resend { --waiting: state(false); --until: state(time()); --now: state(time()) }
    .resend button:on(click) { --waiting: set(true); --until: set(time() + 30s); --now: set(time()) }
    .resend:when(--waiting):on(every(250ms)) { --now: set(time()) }
    .resend:when(--waiting):on(after(30s)) { --waiting: set(false) }
    .resend:when(--waiting) button { pointer-events: none }
    .resend .left { text: format(max(0, round(up, (--until - --now) / 1s)), "integer") }`,
  '<div class="resend"><button>Resend</button> <span class="left"></span></div>');
  expect(await text(page, '.left')).toBe('0');
  await page.click('button');
  await page.clock.runFor(50);
  expect(await text(page, '.left')).toBe('30'); // --now is set with --until: no stale sample
  await page.clock.runFor(10_250);
  expect(await text(page, '.left')).toBe('20');
  expect(await v(page, '.resend', '--waiting')).toBe('1');
  expect(await sources(page)).toBe(2);
  await page.clock.runFor(20_000);
  expect(await v(page, '.resend', '--waiting')).toBe('0');
  expect(await text(page, '.left')).toBe('0');
  expect(await sources(page)).toBe(0); // both timers stop with the rule
  expect(await diagnostics(page)).toEqual([]);
});

test('background tab: every() pauses while hidden and resumes one interval after; after() keeps its deadline', async ({ page }) => {
  await start(page, `.t { --n: state(0); --done: state(false) } .t:on(every(1s)) { --n: increment(1) }
    .t:when(not --done):on(after(2500ms)) { --done: set(true) }`, '<div class="t"></div>');
  await page.clock.runFor(1000);
  expect(await v(page, '.t', '--n')).toBe('1');
  await visibility(page, 'hidden');
  await page.clock.runFor(5000);
  expect(await v(page, '.t', '--n')).toBe('1');
  expect(await v(page, '.t', '--done')).toBe('1'); // the deadline passed while hidden
  await visibility(page, 'visible');
  await page.clock.runFor(990);
  expect(await v(page, '.t', '--n')).toBe('1');
  await page.clock.runFor(40); // due at 1000ms, shown in the next frame (≤ 1016ms)
  expect(await v(page, '.t', '--n')).toBe('2');
});

test('dynamic selectors: a class or attribute starts and stops the timer; removal cancels', async ({ page }) => {
  await start(page, '.w { --n: state(0) } .w .tick.on[data-run]:on(every(100ms)) { --n: increment(1) }',
    '<div class="w"><span class="tick"></span></div>');
  await page.clock.runFor(500);
  expect(await sources(page)).toBe(0);
  await page.$eval('.tick', (e) => { e.classList.add('on'); e.setAttribute('data-run', ''); });
  await page.clock.runFor(350);
  expect(await v(page, '.w', '--n')).toBe('3');
  await page.$eval('.tick', (e) => e.removeAttribute('data-run'));
  await page.clock.runFor(500);
  expect(await v(page, '.w', '--n')).toBe('3');
  await page.$eval('.tick', (e) => e.setAttribute('data-run', ''));
  await page.clock.runFor(250);
  expect(await v(page, '.w', '--n')).toBe('5');
  await page.$eval('.tick', (e) => e.remove());
  await page.clock.runFor(500);
  expect(await v(page, '.w', '--n')).toBe('5');
  expect(await sources(page)).toBe(0);
});

test('ownership: a moved element keeps its timer and writes to its new owner', async ({ page }) => {
  await start(page, '.owner { --n: state(0) } .tick:on(every(100ms)) { --n: increment(1) }',
    '<div class="owner" id="a"><i class="tick"></i></div><div class="owner" id="b"></div>');
  await page.clock.runFor(270); // runs at ~100, 200, 300ms, each shown one frame later
  expect(await v(page, '#a', '--n')).toBe('3');
  await page.evaluate(() => document.getElementById('b')!.append(document.querySelector('.tick')!));
  await page.clock.runFor(120);
  expect([await v(page, '#a', '--n'), await v(page, '#b', '--n')]).toEqual(['3', '1']);
  expect(await sources(page)).toBe(1);
});

test('two active rules with one trigger share one timer; the cascade picks per state', async ({ page }) => {
  await start(page, `.t { --a: state(0); --b: state(0) }
    .t:on(every(100ms)) { --a: increment(1) }
    .t.fast:on(every(100ms)) { --a: increment(10); --b: increment(1) }`, '<div class="t fast"></div>');
  await page.clock.runFor(120);
  expect([await v(page, '.t', '--a'), await v(page, '.t', '--b')]).toEqual(['10', '1']);
  expect(await sources(page)).toBe(1);
  await page.$eval('.t', (e) => e.classList.remove('fast'));
  await page.clock.runFor(100);
  expect([await v(page, '.t', '--a'), await v(page, '.t', '--b')]).toEqual(['11', '1']);
  expect(await sources(page)).toBe(1);
});

test('rules the runtime cannot follow are rejected with a reason; the rest of the sheet works', async ({ page }) => {
  await start(page, `.a { --n: state(0); --x: state(true) }
    .a:hover:on(after(1s)) { --n: increment(1) }
    .a:on(after(1s), prevent()) { --n: increment(1) }
    .a:when(--x) { .b:on(every(1s)) { --n: increment(1) } }
    .a:on(every(5ms)) { --n: increment(0) }
    .a:on(after(1s)) { --n: set(event(type)) }
    .a b { text: var(--n) }`, '<div class="a"><div class="b"></div><b></b></div>');
  await page.hover('.a');
  await page.clock.runFor(2000);
  const d = (await diagnostics(page)).join('\n');
  expect(d).toMatch(/not on :hover; use a state/);
  expect(d).toMatch(/takes no modifiers/);
  expect(d).toMatch(/cannot be nested inside a rule with a state condition/);
  expect(d).toMatch(/every\(5ms\) is below the 20ms minimum/);
  expect(d).toMatch(/event\(type\) is only available in :on\(\) actions; after\(1000ms\) has no event/);
  expect(await text(page, '.a b')).toBe('0');
});

test('a custom bundle without timers reports them; one with timers runs them', async ({ page }) => {
  // @ts-expect-error: plain ESM tooling
  const { build } = await import('../../tools/bundle.mjs');
  const css = '.t { --n: state(0) } .t:on(every(100ms)) { --n: increment(1) }';
  const without = await build({ features: ['events'] });
  await page.route('**/dist/reactive-css.js', (x) => x.fulfill({ contentType: 'text/javascript', body: without.code }));
  await start(page, css, '<div class="t"></div>');
  expect((await diagnostics(page)).join('\n')).toMatch(/:on\(after\(\)\) and :on\(every\(\)\) is not included in this bundle \(feature "timers"\)/);
  const withIt = await build({ features: ['timers'] });
  expect(withIt.ok).toBe(true);
  await page.unroute('**/dist/reactive-css.js');
  await page.route('**/dist/reactive-css.js', (x) => x.fulfill({ contentType: 'text/javascript', body: withIt.code }));
  await open(page, { head: `<style>${css}</style>`, body: '<div class="t"></div>' });
  await page.clock.runFor(250);
  expect(await v(page, '.t', '--n')).toBe('2');
  expect(await diagnostics(page)).toEqual([]);
});
