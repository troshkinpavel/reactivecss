// The sixteen API examples (examples/api/<name>/), each run twice under a strict CSP: with the full
// runtime and with the smallest custom bundle the analyzer picks for it. Real mouse and keyboard
// input, real DOM, attribute, focus and computed-style assertions; then cleanup, idle activity and
// repeated mounting.
import { test, expect, type Page } from '@playwright/test';
import { visit, finish, frames, active } from './example-helpers';

const cs = (page: Page, sel: string, prop: string, pseudo?: string) =>
  page.$eval(sel, (e, [p, ps]) => getComputedStyle(e, ps || null).getPropertyValue(p!).trim(), [prop, pseudo] as const);
const text = (page: Page, sel: string) => page.textContent(sel).then((t) => t?.trim());
const click = async (page: Page, sel: string) => { await page.click(sel); await frames(page); };
const stats = (page: Page) => page.evaluate(() => (window as any).ReactiveCSS.stats());

const CHECKS: Record<string, (page: Page, browserName: string) => Promise<void>> = {
  async counter(page) {
    expect(await text(page, '.value')).toBe('0');
    for (let i = 0; i < 3; i++) await click(page, '.inc');
    await click(page, '.dec');
    expect(await text(page, '.value')).toBe('2');
    await page.focus('.inc');
    await page.keyboard.press('Enter');
    await frames(page);
    expect(await text(page, '.value')).toBe('3');
  },

  async 'state-history'(page) {
    expect([await text(page, '.now'), await text(page, '.prev'), await text(page, '.word')]).toEqual(['0', '0', 'none yet']);
    await click(page, '.up'); await click(page, '.up');
    expect([await text(page, '.now'), await text(page, '.prev'), await text(page, '.word')]).toEqual(['2', '1', 'up']);
    await click(page, '.down');
    expect([await text(page, '.now'), await text(page, '.prev'), await text(page, '.word')]).toEqual(['1', '2', 'down']);
    await expect.poll(() => cs(page, '.arrow', 'rotate')).toBe('180deg');
  },

  async 'random-colors'(page) {
    const hues = new Set<number>();
    for (let i = 0; i < 12; i++) {
      await click(page, '.roll');
      const h = Number(await cs(page, '.random', '--hue'));
      expect(Number.isInteger(h) && h >= 0 && h <= 359, String(h)).toBe(true);
      expect(await cs(page, '.hue', 'counter-reset', '::after')).toBe(`hue ${h}`);
      hues.add(h);
    }
    expect(hues.size).toBeGreaterThan(5);
    // the swatch reaches the color of the last hue (after its transition)
    const last = Number(await cs(page, '.random', '--hue')); // the final hue (it may repeat an earlier one)
    const want = await page.evaluate((h) => { const d = document.createElement('i'); d.style.color = `hsl(${h} 80% 55%)`; document.body.append(d); const c = getComputedStyle(d).color; d.remove(); return c; }, last);
    await expect.poll(() => cs(page, '.swatch', 'background-color')).toBe(want);
  },

  async 'pick-value'(page) {
    expect(await text(page, '.result')).toBe('Apple');
    const seen = new Set<string>();
    for (let i = 0; i < 20; i++) { await click(page, '.again'); seen.add((await text(page, '.result'))!); }
    for (const v of seen) expect(['Apple', 'Pear', 'Lemon', 'Plum', 'Cherry']).toContain(v);
    expect(seen.size).toBeGreaterThan(1);
    expect(await text(page, '.count')).toBe('20');
  },

  async 'live-values'(page) {
    const level = async () => Number(await cs(page, '.live', '--level'));
    const first = await level();
    expect(Number.isInteger(first) && first >= 0 && first <= 100).toBe(true);
    await expect.poll(async () => (await stats(page)).intervals).toBe(1);
    // A new value within one interval (2 s). A random value can repeat, and a tick can land late on a
    // loaded runner (WebKit CI, 2 workers: 4.5 s missed the second tick once), so allow three intervals.
    await expect.poll(level, { timeout: 6500 }).not.toBe(first);
    // Bar, readout and value agree once the 700 ms transition settles. Read together: the next tick
    // can change the level while the bar is still moving (slow frames under load).
    await expect.poll(() => page.evaluate(() => {
      const v = Number(getComputedStyle(document.querySelector('.live')!).getPropertyValue('--level'));
      const bar = getComputedStyle(document.querySelector('.bar')!).scale;
      const readout = getComputedStyle(document.querySelector('.level')!, '::after').counterReset;
      return bar === (v === 100 ? '1' : `${v / 100} 1`) && readout === `level ${v}`;
    }), { timeout: 6000 }).toBe(true);
  },

  async 'mouse-tracker'(page) {
    const pad = (await page.locator('.pad').boundingBox())!;
    await page.mouse.move(pad.x + 60, pad.y + 40);
    await page.mouse.move(pad.x + 80, pad.y + 50);
    // Relative to the pad's border box, which can sit at a fractional position (WebKit).
    const px = async (p: string) => parseFloat(await cs(page, '.pad', p));
    await expect.poll(async () => Math.abs((await px('--x')) - 80)).toBeLessThan(1);
    expect(Math.abs((await px('--y')) - 50)).toBeLessThan(1);
    const [x, y] = [await cs(page, '.pad', '--x'), await cs(page, '.pad', '--y')];
    await expect.poll(() => cs(page, '.dot', 'translate')).toBe(`${x} ${y}`);
    expect(await cs(page, '.coords', 'counter-reset', '::after')).toBe(`x ${Math.round(parseFloat(x))} y ${Math.round(parseFloat(y))}`);
    await page.mouse.move(pad.x + pad.width + 40, pad.y - 40); // outside: the dot rests in the middle
    await expect.poll(() => cs(page, '.dot', 'translate')).toBe(`${pad.width / 2}px ${pad.height / 2}px`);
  },

  async 'element-size'(page) {
    expect(await text(page, '.set')).toBe('300');
    await expect.poll(() => cs(page, '.card', '--w')).toBe('334px'); // 300 + padding and border
    expect(await cs(page, '.measured', 'counter-reset', '::after')).toBe('w 334');
    await page.focus('.width');
    for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight');
    await expect.poll(() => cs(page, '.card', '--w')).toBe('384px');
    expect([await text(page, '.set'), await cs(page, '.big', 'font-size')]).toEqual(['350', '64px']);
    await page.keyboard.press('End'); // 480 asked; the card is limited to the space available
    await expect.poll(() => text(page, '.set')).toBe('480');
    const available = await page.$eval('.size', (e) => e.clientWidth - 40); // .demo padding
    await expect.poll(() => cs(page, '.card', '--w')).toBe(`${available}px`);
  },

  async 'input-binding'(page) {
    expect(await text(page, '.greet')).toBe('stranger');
    await page.fill('#name', 'Ada');
    await page.type('#name', ' L.');
    await frames(page);
    expect([await text(page, '.greet'), await text(page, '.greet-2')]).toEqual(['Ada L.', 'Ada L.']);
    expect(await cs(page, '.generated', 'content', '::after')).toBe('"Ada L."');
    // The DOM text is a real text node, the generated one is not in the DOM at all.
    expect(await page.$eval('.greet', (e) => e.firstChild?.nodeType)).toBe(3); // a Text node
    expect(await page.$eval('.generated', (e) => e.textContent)).not.toContain('Ada');
    await page.fill('#name', '');
    await frames(page);
    expect(await text(page, '.greet')).toBe('stranger');
  },

  async 'conditional-styles'(page) {
    const pressed = () => page.$$eval('.levels button', (bs) => bs.map((b) => b.getAttribute('aria-pressed')));
    expect(await pressed()).toEqual(['true', 'false', 'false']);
    await expect.poll(() => cs(page, '.card', 'background-color')).toBe('rgb(238, 244, 246)');
    await click(page, '.breezy');
    expect([await pressed(), await text(page, '.label')]).toEqual([['false', 'true', 'false'], 'Breezy']);
    await expect.poll(() => cs(page, '.flag', 'rotate')).toBe('90deg');
    await click(page, '.stormy');
    expect(await text(page, '.label')).toBe('Stormy');
    await expect.poll(() => cs(page, '.card', 'background-color')).toBe('rgb(251, 227, 218)');
    await expect.poll(() => cs(page, '.card', 'border-top-color')).toBe('rgb(217, 72, 30)');
    expect(await cs(page, '.flag', 'animation-name')).toBe('flap');
    await click(page, '.calm');
    expect([await pressed(), await text(page, '.label'), await cs(page, '.flag', 'animation-name')]).toEqual([['true', 'false', 'false'], 'Calm', 'none']);
  },

  async 'dynamic-attributes'(page) {
    const disabled = () => page.$$eval('.qty button', (bs) => bs.map((b) => b.hasAttribute('disabled')));
    expect(await disabled()).toEqual([true, false]);
    expect(await cs(page, '.a-minus', 'content', '::after')).toBe('"disabled attribute present"');
    // Rapid real clicks: the attribute set by the click that reaches 5 stops the next ones.
    const plus = (await page.locator('.plus').boundingBox())!;
    for (let i = 0; i < 8; i++) await page.mouse.click(plus.x + plus.width / 2, plus.y + plus.height / 2);
    await frames(page);
    expect([await text(page, '.value'), ...(await disabled())]).toEqual(['5', false, true]);
    expect(await cs(page, '.a-plus', 'content', '::after')).toBe('"disabled attribute present"');
    expect(await page.getAttribute('.plus', 'disabled')).toBe(''); // a real boolean attribute, never "false"
    await click(page, '.minus');
    expect([await text(page, '.value'), ...(await disabled())]).toEqual(['4', false, false]);
  },

  async 'keyboard-controls'(page) {
    await page.setViewportSize({ width: 800, height: 500 }); // the page scrolls
    await page.evaluate(() => { (window as any).__prevented = []; addEventListener('keydown', (e) => (window as any).__prevented.push(`${e.key}:${e.defaultPrevented}`)); });
    await page.focus('.board');
    const y0 = await page.evaluate(() => scrollY);
    for (const k of ['ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowDown']) await page.keyboard.press(k);
    await frames(page);
    expect([await text(page, '.col'), await text(page, '.r')]).toEqual(['1', '4']); // 3 → 4 → 5 → wraps to 1
    expect([await cs(page, '.token', 'grid-column-start'), await cs(page, '.token', 'grid-row-start')]).toEqual(['1', '4']);
    expect(await page.evaluate(() => scrollY)).toBe(y0);
    expect(await page.evaluate(() => (window as any).__prevented)).toEqual(['ArrowRight:true', 'ArrowRight:true', 'ArrowRight:true', 'ArrowDown:true']);
    await page.keyboard.press('PageDown'); // not handled: native scrolling
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(y0);
    await page.focus('#note');
    await page.$eval('#note', (e) => (e as HTMLInputElement).setSelectionRange(5, 5)); // End does not move the caret on macOS
    const caret = 5;
    await page.keyboard.press('ArrowLeft');
    expect(await page.$eval('#note', (e) => (e as HTMLInputElement).selectionStart)).toBe(caret - 1);
    expect(await text(page, '.col')).toBe('1');
  },

  async 'focus-management'(page) {
    expect(await active(page)).toBe('body'); // never on load
    await click(page, '.next');
    await frames(page);
    expect([await text(page, '.n'), await page.evaluate(() => document.activeElement!.textContent)]).toEqual(['2', '2. Your details']);
    expect(await cs(page, '.panel:nth-child(2) h2', 'outline-style')).toBe('solid');
    await page.focus('.next');
    await page.keyboard.press('Enter');
    await frames(page, 3);
    expect([await page.evaluate(() => document.activeElement!.textContent), await text(page, '.next')]).toEqual(['3. Confirm', 'Start over']);
    expect(await page.$$eval('.panel', (ps) => ps.map((p) => getComputedStyle(p).display))).toEqual(['none', 'none', 'block']);
    await click(page, '.next');
    await frames(page);
    expect([await text(page, '.n'), await page.evaluate(() => document.activeElement!.textContent)]).toEqual(['1', '1. Choose a plan']);
  },

  async 'state-selection'(page) {
    const pressed = () => page.$$eval('.card', (cs) => cs.map((c) => c.getAttribute('aria-pressed')));
    expect(await pressed()).toEqual(['true', 'false', 'false', 'false']);
    await click(page, '.card:nth-child(3)');
    expect([await pressed(), await text(page, '.i')]).toEqual([['false', 'false', 'true', 'false'], '3']);
    await click(page, '.next');
    await click(page, '.next'); // 4 → wraps to 1
    expect([await pressed(), await text(page, '.i')]).toEqual([['true', 'false', 'false', 'false'], '1']);
    await click(page, '.prev');
    expect([await pressed(), await text(page, '.i')]).toEqual([['false', 'false', 'false', 'true'], '4']);
  },

  async 'change-animation'(page) {
    const anims = () => page.$eval('.likes .n', (e) => e.getAnimations().map((a) => (a as CSSAnimation).animationName));
    expect(await anims()).toEqual([]); // never on load
    await click(page, '.like');
    await expect.poll(anims).toEqual(['pop']);
    expect(await text(page, '.n')).toBe('1');
    await expect.poll(anims, { timeout: 2000 }).toEqual([]);
    await click(page, '.like'); // restarts
    await expect.poll(anims).toEqual(['pop']);
    await expect.poll(anims, { timeout: 2000 }).toEqual([]);
    await click(page, '.reset');
    await expect.poll(anims).toEqual(['pop']);
    await expect.poll(anims, { timeout: 2000 }).toEqual([]);
    await click(page, '.reset'); // 0 → 0: not a change
    await frames(page, 4);
    expect(await anims()).toEqual([]);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await click(page, '.like');
    await expect.poll(anims).toEqual(['flash']);
  },

  async viewport(page) {
    await page.setViewportSize({ width: 820, height: 640 });
    const inner = () => page.evaluate(() => [innerWidth, innerHeight]);
    let [w, h] = await inner();
    await expect.poll(() => cs(page, '.w', 'counter-reset', '::after')).toBe(`w ${w}`);
    expect(await cs(page, '.h', 'counter-reset', '::after')).toBe(`h ${h}`);
    await page.setViewportSize({ width: 500, height: 700 });
    [w, h] = await inner();
    await expect.poll(() => cs(page, '.w', 'counter-reset', '::after')).toBe(`w ${w}`);
    expect(await cs(page, '.h', 'counter-reset', '::after')).toBe(`h ${h}`);
    expect(Number(await cs(page, '.fill', 'scale').then((s) => s.split(' ')[0]))).toBeCloseTo(w / 1600, 3);
    expect((await stats(page)).sources).toBe(0); // compiled to 100dvw / 100dvh: nothing runs
  },

  async visibility(page) {
    const status = () => cs(page, '.status', 'content', '::after');
    await expect.poll(() => cs(page, '.target', '--seen')).toBe('0');
    expect(await status()).toBe('"target: out of view"');
    const box = (await page.locator('.scroller').boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, 300);
    await expect.poll(() => cs(page, '.target', '--seen')).toBe('1');
    expect(await status()).toBe('"target: in view ✓"');
    await expect.poll(() => cs(page, '.box', 'opacity')).toBe('1');
    await page.mouse.wheel(0, -600);
    await expect.poll(() => cs(page, '.target', '--seen')).toBe('0');
    expect(await status()).toBe('"target: out of view"');
  },
};
const NAMES = Object.keys(CHECKS);
const SOURCES = ['live-values', 'mouse-tracker', 'element-size', 'visibility', 'viewport'];

for (const custom of [false, true]) {
  test.describe(custom ? 'with the analyzer-chosen custom bundle' : 'with the full runtime', () => {
    for (const name of NAMES) {
      test(name, async ({ page, browserName }) => {
        const problems = await visit(page, `api/${name}`, { custom });
        if (custom) expect((await page.evaluate(() => (window as any).ReactiveCSS.describe().bundle)).length).toBeLessThan(12);
        await CHECKS[name]!(page, browserName);
        await finish(page, problems);
        // Timers end with their last subscriber, and so do the shared observers and listeners of
        // live(), mouse(), element() and visible(). (The on: dispatcher's document listener belongs to
        // the stylesheet's rules, not to elements, so it stays while the sheet does.)
        const s = await stats(page);
        expect([s.intervals, s.scheduled]).toEqual([0, 0]);
        if (SOURCES.includes(name)) expect(s.observers).toBe(0);
      });
    }
  });
}

test.describe('custom bundles', () => {
  test('the analyzer finds every example complete, adds requirements, and the bundles are smaller', async () => {
    // @ts-expect-error: plain ESM tooling
    const { analyze, build } = await import('../../tools/bundle.mjs');
    const full = (await build({ profile: 'full' })).manifest.sizes.minified;
    for (const name of NAMES) {
      const a = await analyze([`examples/api/${name}`], { assumeComplete: true });
      expect(a.complete, name).toBe(true);
      const r = await build({ features: a.recommended.features });
      expect(r.manifest.features, name).toEqual(a.features);
      expect(r.manifest.sizes.minified, name).toBeLessThan(full);
      if (a.used.includes('focus')) expect(r.manifest.features, name).toContain('events'); // focus requires events
    }
  });
});

test.describe('runtime activity', () => {
  test('idle pages do no work, except live() on its interval', async ({ page }) => {
    for (const name of NAMES) {
      await visit(page, `api/${name}`);
      await frames(page, 3);
      const a = (await stats(page)).flushes;
      await page.waitForTimeout(1200);
      const b = (await stats(page)).flushes;
      expect(b - a, name).toBeLessThanOrEqual(name === 'live-values' ? 1 : 0);
    }
  });

  test('repeated mounting: 20 remounts leave the same bindings, observers, timers and listeners', async ({ page, browserName }) => {
    for (const name of ['live-values', 'mouse-tracker', 'element-size', 'visibility', 'keyboard-controls', 'focus-management']) {
      await visit(page, `api/${name}`);
      const cdp = browserName === 'chromium' ? await page.context().newCDPSession(page) : undefined;
      const listeners = async () => (cdp ? (await cdp.send('Memory.getDOMCounters')).jsEventListeners : 0);
      const pick = (s: any) => [s.bindings, s.states, s.sources, s.observers, s.intervals];
      if (cdp) await cdp.send('HeapProfiler.collectGarbage'); // listeners of the previous page
      const before = [...pick(await stats(page)), await listeners()];
      for (let i = 0; i < 20; i++) {
        await page.evaluate(() => { const m = document.querySelector('main')!; const html = m.outerHTML; m.remove(); document.body.insertAdjacentHTML('afterbegin', html); });
        await frames(page);
      }
      await frames(page, 3);
      if (cdp) await cdp.send('HeapProfiler.collectGarbage');
      expect([...pick(await stats(page)), await listeners()], name).toEqual(before);
    }
  });
});

test.describe('demo lab', () => {
  test('lists the API examples in their own group and loads each with its README', async ({ page }) => {
    await page.goto('/examples/lab/');
    const names = await page.$$eval('.api-list li', (ls) => ls.map((l) => (l as HTMLElement).dataset.name!));
    expect(names).toEqual(NAMES.map((n) => `api/${n}`).sort((a, b) => names.indexOf(a) - names.indexOf(b)));
    expect(names).toHaveLength(16);
    expect(await page.$$eval('.examples li', (ls) => ls.length)).toBe(20); // the application demos, unchanged
    for (const name of names) {
      await page.click(`.api-list li[data-name="${name}"] a`);
      await page.waitForFunction((n) => {
        const w = (document.querySelector('.frame') as HTMLIFrameElement).contentWindow as any;
        return w?.location.pathname === `/examples/${n}/` && w.ReactiveCSS?.stats().sheets >= 1;
      }, name);
      expect(await page.$eval('.frame', (f) => ((f as HTMLIFrameElement).contentWindow as any).ReactiveCSS.diagnostics), name).toEqual([]);
      await expect(page.locator('.source')).toContainText('## Native CSS alternative');
    }
  });

  test('the API examples index links all sixteen', async ({ page }) => {
    await page.goto('/examples/api/');
    expect(await page.$$eval('.list a', (as) => as.map((a) => a.getAttribute('href')))).toEqual(
      expect.arrayContaining(NAMES.map((n) => `${n}/`)));
    expect(await page.locator('.list li').count()).toBe(16);
  });
});
