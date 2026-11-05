// 0.10 step 6 (datetime): time(), timezone(), state(time()), datetime arithmetic and dates in
// format(). Deterministic: Playwright's fake clock (Date, timers and frames move only with it).
import { test, expect, type Page } from '@playwright/test';
import { open, style, diagnostics } from './helpers';

const v = (page: Page, sel: string, p: string) => style(page, sel, p).then((s) => s.trim());
const text = (page: Page, sel: string) => page.$eval(sel, (e) => e.textContent);
/** Opens the page with the clock paused at `iso` (installed 10s earlier, so pauseAt() is never in the past). */
async function start(page: Page, iso: string, head: string, body: string) {
  const at = new Date(iso);
  await page.clock.install({ time: new Date(at.getTime() - 10_000) });
  await page.clock.pauseAt(at);
  await open(page, { head: `<style>${head}</style>`, body });
  await page.clock.runFor(50);
}

test('countdown from timestamps: a deadline state, a live() countdown, the deadline in a zone', async ({ page }) => {
  await start(page, '2026-10-28T10:00:00Z', `.r { --until: state(time()) }
    .r button:on(click) { --until: set(time() + 30s) }
    .r .left { --left: live(format(max(0, round(up, (--until - time()) / 1s)), "integer"), 250ms) }
    .r .at { text: format(timezone(--until, "Asia/Kolkata"), "HH:mm:ss") }`,
  '<div class="r"><button>Resend</button><i class="left"></i><b class="at"></b></div>');
  expect(await v(page, '.r', '--until')).toBe(String(Date.parse('2026-10-28T10:00:00Z'))); // epoch ms in CSS
  expect([await v(page, '.left', '--left'), await text(page, '.at')]).toEqual(['"0"', '15:30:00']);
  await page.clock.runFor(1950); // 10:00:02
  await page.click('button');
  await page.clock.runFor(50); // the same task's time(): exactly 30s, shown at once
  expect([await v(page, '.left', '--left'), await text(page, '.at')]).toEqual(['"30"', '15:30:32']);
  await page.clock.runFor(10_000);
  expect(await v(page, '.left', '--left')).toBe('"20"');
  await page.clock.runFor(900); // 19.1s left: rounded up
  expect(await v(page, '.left', '--left')).toBe('"20"');
  await page.clock.runFor(20_000);
  expect(await v(page, '.left', '--left')).toBe('"0"'); // max(0, …): never negative
  expect(await diagnostics(page)).toEqual([]);
});

test('a running clock across the London spring-forward transition, in the nearest lang', async ({ page }) => {
  await start(page, '2026-03-29T00:59:58Z', `.c .t { --t: live(format(timezone(time(), "Europe/London"), "HH:mm:ss"), 1s) }
    .c .d { --d: live(format(timezone(time(), "Europe/London"), "EEEE d MMMM, h a"), 1s) }`,
  '<div class="c"><i class="t"></i><b class="d" lang="fr-FR"></b></div>');
  expect(await v(page, '.t', '--t')).toBe('"00:59:58"');
  await page.clock.runFor(2000);
  expect(await v(page, '.t', '--t')).toBe('"02:00:00"'); // 01:00 to 01:59 does not exist that day
  expect(await v(page, '.d', '--d')).toMatch(/^"dimanche 29 mars, 2 /);
  expect(await diagnostics(page)).toEqual([]);
});

test('a running clock across midnight: new year and weekday', async ({ page }) => {
  await start(page, '2026-12-31T23:59:59Z', `.c .t { --t: live(format(timezone(time(), "UTC"), "EEE yyyy-MM-dd HH:mm:ss"), 1s) }`,
    '<div class="c"><i class="t"></i></div>');
  expect(await v(page, '.t', '--t')).toBe('"Thu 2026-12-31 23:59:59"');
  await page.clock.runFor(1000);
  expect(await v(page, '.t', '--t')).toBe('"Fri 2027-01-01 00:00:00"');
});

test('conditions with time() are evaluated when their states change, not as time passes', async ({ page }) => {
  await start(page, '2026-10-28T10:00:00Z', `.r { --until: state(time()) }
    .r button:on(click) { --until: set(time() + 5s) }
    .r .wait { display: none }
    .r:when(--until > time()) .wait { display: inline }`,
  '<div class="r"><button>Go</button><span class="wait">wait</span></div>');
  expect(await v(page, '.wait', 'display')).toBe('none');
  await page.click('button');
  await page.clock.runFor(50);
  expect(await v(page, '.wait', 'display')).toBe('inline');
  await page.clock.runFor(10_000);
  expect(await v(page, '.wait', 'display')).toBe('inline'); // no state changed: not re-evaluated (0.10 timers: every())
  await page.click('button'); // a state change re-evaluates it
  await page.clock.runFor(50);
  expect(await v(page, '.wait', 'display')).toBe('inline');
  expect(await diagnostics(page)).toEqual([]);
});

test('mistakes: one diagnostic each; a datetime is never stored in a number state', async ({ page }) => {
  await start(page, '2026-10-28T10:00:00Z', `.m { --n: state(0); --at: state(time()) }
    .m button:on(click) { --n: set(time()); --at: set(time() + 1) }
    .m .a { text: format(--n, "HH:mm") }
    .m .b { text: format(timezone(time(), "Mars/Olympus"), "HH:mm") }`,
  '<div class="m"><button>x</button><i class="a"></i><b class="b"></b></div>');
  await page.click('button');
  await page.clock.runFor(50);
  expect(await v(page, '.m', '--n')).toBe('0');
  expect(await v(page, '.m', '--at')).toBe(String(Date.parse('2026-10-28T10:00:00Z')));
  const d = (await diagnostics(page)).join('\n');
  expect(d).toMatch(/format\(\): a date pattern needs a date and time from time\(\) or timezone\(\); 0 is a number/);
  expect(d).toMatch(/timezone\(\): unknown time zone "Mars\/Olympus"/);
  expect(d).toMatch(/cannot be stored in --n, which holds 0/); // the 0.9.1 type rule
  expect(d).toMatch(/: a datetime takes \+ or - with a time like 30s or 500ms/);
});

test('a custom bundle with datetime brings format; one without it reports time()', async ({ page }) => {
  // @ts-expect-error: plain ESM tooling
  const { build } = await import('../../tools/bundle.mjs');
  const css = `.r { --until: state(time()) } .r button:on(click) { --until: set(time() + 90s) }
    .r .at { text: format(timezone(--until, "UTC"), "HH:mm") }`;
  const body = '<div class="r"><button>x</button><b class="at"></b></div>';
  const withIt = await build({ features: ['events', 'datetime', 'text'] });
  expect(withIt.ok).toBe(true);
  await page.route('**/dist/reactive-css.js', (x) => x.fulfill({ contentType: 'text/javascript', body: withIt.code }));
  await start(page, '2026-10-28T10:00:00Z', css, body);
  await page.click('button');
  await page.clock.runFor(50);
  expect(await text(page, '.at')).toBe('10:01');
  expect(await diagnostics(page)).toEqual([]);

  const without = await build({ features: ['events', 'format', 'text'] });
  await page.unroute('**/dist/reactive-css.js');
  await page.route('**/dist/reactive-css.js', (x) => x.fulfill({ contentType: 'text/javascript', body: without.code }));
  await open(page, { head: `<style>${css}</style>`, body });
  await page.clock.runFor(50);
  expect((await diagnostics(page)).join('\n')).toMatch(/time\(\).*"datetime"/);
});
