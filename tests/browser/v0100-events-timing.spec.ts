// 0.10 step 3 (events): debounce(time) and throttle(time) in :on().
// Deterministic: Playwright's fake clock (timers, performance.now() and frames move only with it).
import { test, expect, type Page } from '@playwright/test';
import { open, style, stats, diagnostics } from './helpers';

const v = (page: Page, sel: string, p: string) => style(page, sel, p).then((s) => s.trim());
/** Opens the page with the clock paused (installed 10s earlier, so pauseAt() is never in the past). */
async function start(page: Page, head: string, body: string) {
  const at = new Date('2026-10-27T10:00:00Z');
  await page.clock.install({ time: new Date(at.getTime() - 10_000) });
  await page.clock.pauseAt(at);
  await open(page, { head: `<style>${head}</style>`, body });
  await page.clock.runFor(50);
}
/** Input events in one task, one per character. */
const typeFast = (page: Page, sel: string, s: string) => page.$eval(sel, (el: HTMLInputElement, s) => {
  for (const c of s) { el.value += c; el.dispatchEvent(new Event('input', { bubbles: true })); }
}, s);

test('debounce: trailing edge, the last event\'s value, restarted by each event', async ({ page }) => {
  await start(page, `.s { --query: state(""); --runs: state(0) }
    .s input:on(input, debounce(300ms)) { --query: set(event(value)); --runs: increment(1) }`, '<div class="s"><input></div>');
  await typeFast(page, 'input', 'hel');
  await page.clock.runFor(200);
  await typeFast(page, 'input', 'lo'); // restarts the delay
  await page.clock.runFor(299);
  expect(await v(page, '.s', '--runs')).toBe('0');
  await page.clock.runFor(20); // the delay ends; the next frame shows it
  expect([await v(page, '.s', '--query'), await v(page, '.s', '--runs')]).toEqual(['"hello"', '1']);
  await page.clock.runFor(1000);
  expect(await v(page, '.s', '--runs')).toBe('1'); // once, after the last event
  expect(await diagnostics(page)).toEqual([]);
});

test('debounce: cancelled when the rule stops applying, the element is removed, or the sheet goes', async ({ page }) => {
  await start(page, `.s { --query: state(""); --on: state(true) }
    .s:when(--on) input:on(input, debounce(300ms)) { --query: set(event(value)) }
    .s button:on(click) { --on: toggle() }`, '<div class="s"><input id="a"><input id="b"><button>off</button></div>');
  await typeFast(page, '#a', 'x');
  await page.clock.runFor(100);
  await page.click('button'); // the rule no longer applies when the delay ends
  await page.clock.runFor(400);
  expect(await v(page, '.s', '--query')).toBe('""');
  await page.click('button');
  await page.clock.runFor(50);
  await typeFast(page, '#b', 'y');
  await page.$eval('#b', (e) => e.remove());
  await page.clock.runFor(400);
  expect(await v(page, '.s', '--query')).toBe('""');
  // Still working: a run that is not interrupted.
  await typeFast(page, '#a', 'z');
  await page.clock.runFor(320);
  expect(await v(page, '.s', '--query')).toBe('"xz"');
  // The stylesheet with the rule is removed during the delay: the run is cancelled with it.
  await page.evaluate(() => {
    const s = document.createElement('style');
    s.id = 'x';
    s.textContent = '.t { --n: state(0) } .t:on(dblclick, debounce(200ms)) { --n: increment(1) }';
    document.head.append(s);
    document.body.insertAdjacentHTML('beforeend', '<button class="t">t</button>');
  });
  await page.clock.runFor(50);
  const base = (await stats(page)).observers;
  await page.dblclick('.t');
  await page.evaluate(() => document.getElementById('x')!.remove());
  await page.clock.runFor(400);
  expect((await stats(page)).observers).toBe(base - 1); // the dblclick listener is released
  expect(await page.evaluate(() => window.ReactiveCSS.diagnostics.length)).toBe(0); // no run on a dead rule
});

test('throttle: leading edge, no trailing run', async ({ page }) => {
  await start(page, `.pad { --x: state(0px); --n: state(0) }
    .pad:on(pointermove, throttle(50ms)) { --x: set(event(client-x)); --n: increment(1) }`,
    '<div class="pad" style="position:absolute;left:0;top:0;width:400px;height:200px"></div>');
  await page.mouse.move(10, 10);
  await page.mouse.move(20, 10);
  await page.clock.runFor(49);
  await page.mouse.move(30, 10); // 49 ms after the first: dropped
  await page.clock.runFor(0);
  expect([await v(page, '.pad', '--x'), await v(page, '.pad', '--n')]).toEqual(['10px', '1']);
  await page.clock.runFor(1);
  await page.mouse.move(40, 10); // 50 ms: runs
  await page.clock.runFor(200);
  expect([await v(page, '.pad', '--x'), await v(page, '.pad', '--n')]).toEqual(['40px', '2']);
  expect(await diagnostics(page)).toEqual([]);
});

test('a | b with debounce shares one delay; prevent() still applies at once', async ({ page }) => {
  await start(page, `.f { --v: state(""); --runs: state(0); --last: state("") }
    .f input:on(input | change, debounce(300ms)) { --v: set(event(value)); --runs: increment(1); --last: set(event(type)) }
    .f a:on(click | keydown(Enter), prevent(), debounce(100ms)) { --runs: increment(10) }`,
    '<form class="f"><input><a href="#moved">go</a></form>');
  await typeFast(page, 'input', 'ab');
  await page.clock.runFor(100);
  await page.$eval('input', (e) => e.dispatchEvent(new Event('change', { bubbles: true })));
  await page.clock.runFor(299);
  expect(await v(page, '.f', '--runs')).toBe('0');
  await page.clock.runFor(20);
  expect([await v(page, '.f', '--v'), await v(page, '.f', '--runs'), await v(page, '.f', '--last')]).toEqual(['"ab"', '1', '"change"']);
  await page.click('a');
  expect(await page.evaluate(() => location.hash)).toBe(''); // cancelled now, not after the delay
  await page.clock.runFor(120);
  expect(await v(page, '.f', '--runs')).toBe('11');
  expect(await diagnostics(page)).toEqual([]);
});

test('one rule on nested elements: each element has its own delay and interval', async ({ page }) => {
  await start(page, `.i { --n: state(0); --t: state(0) }
    .i:on(click, debounce(100ms)) { --n: increment(1) }
    .i:on(dblclick, throttle(1s)) { --t: increment(1) }`,
    '<div class="i" id="outer"><div class="i" id="inner">x</div></div>');
  await page.$eval('#inner', (e) => e.click()); // reaches #inner and #outer
  await page.clock.runFor(120);
  expect([await v(page, '#inner', '--n'), await v(page, '#outer', '--n')]).toEqual(['1', '1']);
  await page.$eval('#inner', (e) => { e.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); e.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); });
  await page.$eval('#outer', (e) => e.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })));
  await page.clock.runFor(20);
  expect([await v(page, '#inner', '--t'), await v(page, '#outer', '--t')]).toEqual(['1', '1']);
  expect(await diagnostics(page)).toEqual([]);
});
