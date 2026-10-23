// 0.7.0: prevent(), cancelling a native default action. Contract: docs/rfc-prevent-action-0.7.md.
// Real scrolling, real key presses, real link navigation; never an internal flag.
import { test, expect, type Page } from '@playwright/test';
import { open, frames, stats, diagnostics } from './helpers';

const scrollY = (page: Page) => page.evaluate(() => Math.round(window.scrollY));
// State values reach CSS in the frame flush: wait for it before reading.
const css = async (page: Page, sel: string, p: string) => { await frames(page); return page.$eval(sel, (e, p) => getComputedStyle(e).getPropertyValue(p).trim(), p); };
const diag = async (page: Page) => (await diagnostics(page)).join('\n');
const TALL = '<div style="height: 3000px">tall</div>';
// Records what the browser reports to an ordinary page listener (bubble phase, after the library).
const RECORD = `<script>window.__ev = []; for (const t of ['keydown', 'click']) document.addEventListener(t, (e) => window.__ev.push(t + ':' + e.defaultPrevented));</script>`;

// Native key scrolling differs: headless WebKit (Playwright 27.2) does not scroll on arrow keys at
// all, while PageDown, Space and End scroll in both engines (checked). Scroll assertions therefore
// use PageDown; arrow keys are checked through defaultPrevented in both, and by scrolling in Chromium.
const settle = (page: Page) => page.waitForTimeout(600); // native smooth scrolling

test.describe('keys: scrolling', () => {
  test('a handled key does not scroll; unhandled keys still scroll; actions run; propagation unchanged', async ({ page, browserName }) => {
    await open(page, {
      head: RECORD + `<style>.r { --y: state(0); on: key(PageDown, prevent(), increment(--y)), key(ArrowDown, prevent(), increment(--y)), key(PageUp, decrement(--y)) }</style>`,
      body: `<div class="r" tabindex="0" id="r">region</div>${TALL}`,
    });
    await page.focus('#r');
    for (let i = 0; i < 5; i++) await page.keyboard.press('PageDown'); // repeated keydown
    await settle(page);
    expect(await scrollY(page)).toBe(0);
    expect(await css(page, '.r', '--y')).toBe('5');
    expect(await page.evaluate(() => (window as any).__ev.slice(-1)[0])).toBe('keydown:true'); // the page listener still got it
    await page.keyboard.press('ArrowDown');
    expect(await page.evaluate(() => (window as any).__ev.slice(-1)[0])).toBe('keydown:true');
    if (browserName === 'chromium') { await settle(page); expect(await scrollY(page)).toBe(0); }
    await page.keyboard.press('End'); // no rule for this key: native
    await settle(page);
    const y = await scrollY(page);
    expect(y).toBeGreaterThan(0);
    await page.keyboard.press('PageUp'); // handled, but without prevent(): scrolls
    await settle(page);
    expect(await scrollY(page)).toBeLessThan(y);
    expect(await css(page, '.r', '--y')).toBe('5');
  });

  test('without any prevent() rule the listener stays passive; a late sheet switches it; removing it restores native scrolling', async ({ page }) => {
    await open(page, { head: `<style>.r { --y: state(0); on: key(PageDown, increment(--y)) }</style>`, body: `<div class="r" tabindex="0" id="r">r</div>${TALL}` });
    expect((await stats(page)).internal.cancelingTypes).toBe(0);
    await page.focus('#r');
    await page.keyboard.press('PageDown');
    await settle(page);
    expect(await scrollY(page)).toBeGreaterThan(0);
    await page.evaluate(() => { window.scrollTo(0, 0); const s = document.createElement('style'); s.id = 'late'; s.textContent = '.r.r { on: key(PageDown, prevent(), increment(--y)) }'; document.head.append(s); });
    await frames(page);
    expect((await stats(page)).internal.cancelingTypes).toBe(1);
    await page.keyboard.press('PageDown');
    await settle(page);
    expect(await scrollY(page)).toBe(0);
    await page.evaluate(() => document.getElementById('late')!.remove());
    await frames(page);
    expect((await stats(page)).internal.cancelingTypes).toBe(0);
    await page.keyboard.press('PageDown');
    await settle(page);
    expect(await scrollY(page)).toBeGreaterThan(0);
    expect(await css(page, '.r', '--y')).toBe('3'); // one dispatch per event throughout: no duplicate listener
  });

  test('conditional: cancels only while the condition holds, current within one task', async ({ page }) => {
    await open(page, {
      head: `<style>.r { --cap: state(false); on: key(PageDown, toggle(--cap)) } .r:when(--cap) { on: key(PageDown, prevent(), toggle(--cap)) }</style>`,
      body: `<div class="r" tabindex="0" id="r">r</div>${TALL}`,
    });
    // Same task: the first event sets --cap (not cancelled); the second sees --cap = true (cancelled); the third is not.
    const r = await page.$eval('#r', (el) => [1, 2, 3].map(() => {
      const e = new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true, cancelable: true });
      el.dispatchEvent(e);
      return e.defaultPrevented;
    }));
    expect(r).toEqual([false, true, false]);
    await page.focus('#r');
    await page.keyboard.press('PageDown'); // --cap is true now: cancelled, and back to false
    await settle(page);
    expect(await scrollY(page)).toBe(0);
    await page.keyboard.press('PageDown'); // --cap false: native scrolling
    await settle(page);
    expect(await scrollY(page)).toBeGreaterThan(0);
  });

  test('form controls keep their keys unless they carry the rule; nested handlers all run; no stopPropagation', async ({ page }) => {
    await open(page, {
      head: RECORD + `<style>.o { --n: state(0); on: key(ArrowDown, prevent(), increment(--n)) } .i { --m: state(0); on: key(ArrowDown, prevent(), increment(--m)) }
        .o .own { on: key(ArrowDown, prevent()) }</style>`,
      body: `<div class="o" id="o"><textarea id="ta">line one\nline two</textarea><div contenteditable id="ce">a<br>b</div><input type="range" id="range" value="50">
        <input class="own" id="own"><div class="i" tabindex="0" id="i">inner</div></div>${TALL}`,
    });
    await page.focus('#ta');
    await page.keyboard.press('ArrowDown');
    expect(await page.$eval('#ta', (t: HTMLTextAreaElement) => t.selectionStart)).toBeGreaterThan(0); // the caret moved
    expect(await page.evaluate(() => (window as any).__ev.slice(-1)[0])).toBe('keydown:false');
    await page.focus('#range');
    await page.keyboard.press('ArrowDown');
    expect(await page.inputValue('#range')).toBe('49'); // native slider key
    await page.focus('#own');
    await page.keyboard.press('ArrowDown');
    expect(await page.evaluate(() => (window as any).__ev.slice(-1)[0])).toBe('keydown:true'); // the control carries the rule itself
    await page.focus('#i');
    await page.keyboard.press('ArrowDown'); // inner and outer both handle it
    expect([await css(page, '#o', '--n'), await css(page, '#i', '--m')]).toEqual(['4', '1']);
    expect(await scrollY(page)).toBe(0);
  });

  test('nothing focused (key() falls back to the last pressed element): actions run, nothing is cancelled', async ({ page }) => {
    await open(page, { head: `<style>.r { --y: state(0); on: key(PageDown, prevent(), increment(--y)) }</style>`, body: `<div class="r"><span id="s">not focusable</span></div>${TALL}` });
    await page.click('#s'); // sets the fallback; focus stays on <body>
    await page.keyboard.press('PageDown');
    expect(await css(page, '.r', '--y')).toBe('1');
    await settle(page);
    expect(await scrollY(page)).toBeGreaterThan(0); // the event did not happen inside the region
  });

  test('a non-cancelable event is reported, not claimed', async ({ page }) => {
    await open(page, { head: `<style>.r { --y: state(0); on: key(ArrowDown, prevent(), increment(--y)) }</style>`, body: '<div class="r" tabindex="0" id="r">r</div>' });
    const prevented = await page.$eval('#r', (el) => { const e = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }); el.dispatchEvent(e); return e.defaultPrevented; });
    expect(prevented).toBe(false);
    expect(await css(page, '.r', '--y')).toBe('1');
    expect(await diag(page)).toMatch(/prevent\(\) on div#r\.r: this keydown event is not cancelable/);
  });
});

test.describe('clicks', () => {
  test('link navigation: cancelled where a rule says so; other links navigate; a cancelling ancestor is reported', async ({ page }) => {
    await open(page, {
      head: RECORD + `<style>.c { --o: state(false) } .c a.stay { on: click(prevent(), toggle(--o)) } .card { on: click(prevent()) }</style>`,
      body: `<div class="c"><a class="stay" href="#stay">stay</a> <a class="go" href="#go">go</a></div><div class="card"><a href="#inner" id="inner">inner</a></div>`,
    });
    await page.click('a.stay');
    expect(new URL(page.url()).hash).toBe('');
    expect(await css(page, '.c', '--o')).toBe('1');
    await page.click('a.go');
    expect(new URL(page.url()).hash).toBe('#go');
    await page.click('#inner');
    expect(new URL(page.url()).hash).toBe('#go'); // the card's rule cancelled it
    expect(await diag(page)).toMatch(/prevent\(\) on div\.card also cancelled the click on a#inner inside it/);
  });

  test('checkbox toggling and a scripted (cancelable) click', async ({ page }) => {
    await open(page, { head: `<style>.k { on: click(prevent()) }</style>`, body: '<input type="checkbox" class="k" id="k"><input type="checkbox" id="free">' });
    await page.click('#k');
    expect(await page.isChecked('#k')).toBe(false);
    await page.$eval('#k', (k) => (k as HTMLElement).click());
    expect(await page.isChecked('#k')).toBe(false);
    await page.click('#free');
    expect(await page.isChecked('#free')).toBe(true);
  });
});

test.describe('compile-time rules', () => {
  test('prevent() only in click() and key(); never in outside(), reset, focus or input events; no arguments', async ({ page }) => {
    await open(page, {
      head: `<style>.a { on: change(prevent()) } .b { on: outside(click, prevent()) } .c { on: reset(prevent()) } .d { on: focusin(prevent()) } .e { on: click(prevent(1)) }
        .ok { on: click(prevent()), key(Enter, prevent()) }</style>`,
      body: '<div class="a"></div>',
    });
    const d = await diag(page);
    expect(d).toMatch(/prevent\(\) only works in click\(…\) and key\(…\); change events are not cancelable/);
    expect(d).toMatch(/prevent\(\) is not allowed in outside\(\)/);
    expect(d).toMatch(/reset events are restored by bind:/);
    expect(d).toMatch(/focusin events are not cancelable/);
    expect(d).toMatch(/prevent\(\): prevent\(\) takes no arguments/);
    expect(d).not.toMatch(/\.ok/);
  });

  test('untrusted stylesheets cannot cancel events', async ({ page }) => {
    await open(page, { head: `<script>window.ReactiveCSSConfig = { trustInlineStyles: false }</script><style>a { on: click(prevent()) }</style>`, body: '<a href="#x">x</a>' });
    await page.click('a');
    expect(new URL(page.url()).hash).toBe('#x');
    expect(await diag(page)).toMatch(/on: is ignored in untrusted stylesheets/);
  });
});
