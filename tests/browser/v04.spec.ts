// 0.4: element(width | height) and wave().
import { test, expect, type Page } from '@playwright/test';
import { open, style, frames, stats, diagnostics, sheetCSS } from './helpers';

const px = (page: Page, sel: string, prop: string) => style(page, sel, prop).then((v) => v.trim());

test.describe('element()', () => {
  test('border-box width and height, updated on resize, readable by descendants', async ({ page }) => {
    await open(page, {
      head: `<style>.box { --w: element(width); --h: element(height); width: 200px; height: 50px; padding: 5px; border: 2px solid; box-sizing: content-box }
        .box i { display: block; width: calc(var(--w) / 2); height: 1px }</style>`,
      body: '<div class="box"><i></i></div>',
    });
    await expect.poll(() => px(page, '.box', '--w')).toBe('214px'); // 200 + 2*5 padding + 2*2 border
    expect(await px(page, '.box', '--h')).toBe('64px');
    expect(await px(page, '.box i', 'width')).toBe('107px');
    await page.evaluate(() => { (document.querySelector('.box') as HTMLElement).style.width = '300px'; });
    await expect.poll(() => px(page, '.box', '--w')).toBe('314px');
  });

  test('hidden and empty elements measure 0px; nested elements measure themselves; vertical writing modes stay physical', async ({ page }) => {
    await open(page, {
      head: `<style>.m { --w: element(width); --h: element(height) }
        .outer { width: 300px } .inner { width: 120px; height: 10px } .hidden { display: none } .empty { display: inline-block }
        .vert { writing-mode: vertical-rl; width: 40px; height: 90px }</style>`,
      body: '<div class="m outer"><div class="m inner"></div></div><div class="m hidden"></div><span class="m empty"></span><div class="m vert"></div>',
    });
    await expect.poll(() => px(page, '.inner', '--w')).toBe('120px');
    expect(await px(page, '.outer', '--w')).toBe('300px');
    expect(await px(page, '.hidden', '--w')).toBe('0px');
    expect(await px(page, '.empty', '--w')).toBe('0px');
    expect([await px(page, '.vert', '--w'), await px(page, '.vert', '--h')]).toEqual(['40px', '90px']);
  });

  test('one shared observer for all elements, released on removal', async ({ page }) => {
    await open(page, {
      head: `<style>.s { --w: element(width); width: 10px; height: 10px }</style>`,
      body: '<div id="host">' + '<div class="s"></div>'.repeat(50) + '</div>',
    });
    await expect.poll(() => px(page, '.s', '--w')).toBe('10px');
    let s = await stats(page);
    expect([s.observers, s.sources]).toEqual([1, 50]);
    await page.evaluate(() => document.getElementById('host')!.remove());
    await frames(page);
    s = await stats(page);
    expect([s.observers, s.sources, s.bindings]).toEqual([0, 0, 0]);
  });

  test('the standard element(#id) image function is left to the browser', async ({ page }) => {
    await open(page, { head: `<style>.x { background-image: element(#y); width: pick(3px) }</style>`, body: '<div class="x" style="display:block"></div>' });
    expect(await diagnostics(page)).toEqual([]);
    expect((await stats(page)).bindings).toBe(1); // only pick()
  });

  test('a feedback loop is detected and frozen with a warning', async ({ page }) => {
    await open(page, {
      head: `<style>.grow { width: calc(element(width) + 10px); height: 10px; background: red }</style>`,
      body: '<div style="width: 200px"><div class="grow"></div></div>',
    });
    await expect.poll(async () => (await diagnostics(page)).join('\n'), { timeout: 5000 }).toMatch(/element\(width\) on div\.grow feeds back into the element's own size/);
    const w1 = parseFloat(await px(page, '.grow', 'width'));
    await page.waitForTimeout(300);
    expect(parseFloat(await px(page, '.grow', 'width'))).toBe(w1); // stopped
    expect(w1).toBeLessThan(200 + 40 * 10); // stopped within the ~30-frame detection window plus the probe
  });

  test('a long transition that changes the size is not mistaken for a loop', async ({ page }) => {
    await open(page, {
      head: `<style>.t { --w: element(width); width: 100px; height: 10px; transition: width 1.5s linear } .t.big { width: 600px }
        .t b { display: block; width: calc(var(--w) / 10); height: 1px }</style>`,
      body: '<div class="t"><b></b></div>',
    });
    await expect.poll(() => px(page, '.t', '--w')).toBe('100px');
    await page.evaluate(() => document.querySelector('.t')!.classList.add('big'));
    await expect.poll(() => px(page, '.t', '--w'), { timeout: 4000 }).toBe('600px');
    expect(await px(page, '.t b', 'width')).toBe('60px');
    expect(await diagnostics(page)).toEqual([]);
  });

  test('a size change that stops during the loop check is not mistaken for a loop', async ({ page }) => {
    // Each element grows 2px a frame, for a different number of frames, so for some of them the growth
    // stops during the guard's two-frame pause, as a transition can end there on a slow frame.
    const N = Array.from({ length: 16 }, (_, i) => 24 + i);
    await open(page, {
      head: '<style>.g { --w: element(width); width: 100px; height: 4px }</style>',
      body: N.map((n) => `<div class="g" data-n="${n}"></div>`).join(''),
    });
    const synced = () => page.$$eval('.g', (els) => els.map((e) => getComputedStyle(e).getPropertyValue('--w') === getComputedStyle(e).width));
    await expect.poll(synced).toEqual(N.map(() => true));
    await page.evaluate(() => new Promise<void>((done) => {
      const els = [...document.querySelectorAll<HTMLElement>('.g')];
      let f = 0;
      const step = () => {
        f++;
        for (const e of els) if (f <= +e.dataset.n!) e.style.width = `${100 + 2 * f}px`;
        if (f < 60) requestAnimationFrame(step); else done();
      };
      requestAnimationFrame(step);
    }));
    await expect.poll(synced).toEqual(N.map(() => true)); // every value reaches the final size
    expect(await diagnostics(page)).toEqual([]);
  });
});
