// 0.10 step 8: a consumer moved into another owner reads the new owner (the 0.9.1 nearest-owner
// rule), for state() and computed custom properties, through every kind of reader.
import { test, expect, type Page } from '@playwright/test';
import { open, frames, style, diagnostics } from './helpers';

const v = (page: Page, sel: string, p: string) => style(page, sel, p).then((s) => s.trim());

const CSS = (name: string) => `
  .c:when(${name} == "bb") { color: rgb(255, 0, 0) }
  .c .t { text: var(${name}) }
  .c { width: when(${name} == "bb", 20px, 10px); --len: length(${name}); attr: data-v var(${name}) }
  .c .w { width: calc(var(--len) * 1px) }
  .c input { bind: ${name} }`;
const BODY = '<div class="o" id="a"><div class="c" id="c" style="display:block"><span class="t"></span><i class="w" style="display:block"></i><input></div></div><div class="o" id="b"></div>';

async function read(page: Page) {
  return {
    color: await v(page, '#c', 'color'), text: await page.$eval('#c .t', (e) => e.textContent), width: await v(page, '#c', 'width'),
    len: await v(page, '#c .w', 'width'), attr: await page.$eval('#c', (e) => e.getAttribute('data-v')), input: await page.$eval('#c input', (e: HTMLInputElement) => e.value),
  };
}
const A = { color: 'rgb(0, 0, 0)', text: 'a', width: '10px', len: '1px', attr: 'a', input: 'a' };
const B = { color: 'rgb(255, 0, 0)', text: 'bb', width: '20px', len: '2px', attr: 'bb', input: 'bb' };

for (const [kind, owners] of [
  ['state()', '#a { --v: state("a") } #b { --v: state("bb") }'],
  ['computed', '#a { --s: state("A") } #b { --s: state("BB") } .o { --v: lower(--s) }'],
] as const) {
  test(`a moved consumer reads its new owner: ${kind}`, async ({ page }) => {
    await open(page, { head: `<style>${owners}${CSS('--v')}</style>`, body: BODY });
    await frames(page);
    expect(await read(page)).toEqual(A);
    await page.evaluate(() => document.getElementById('b')!.append(document.getElementById('c')!));
    await frames(page);
    expect(await read(page)).toEqual(B);
    await page.evaluate(() => document.getElementById('a')!.append(document.getElementById('c')!));
    await frames(page);
    expect(await read(page)).toEqual(A);
    expect(await diagnostics(page)).toEqual([]);
  });
}

test('a bound control the user edited, moved into another owner, shows that owner and overwrites nothing', async ({ page }) => {
  await open(page, { head: `<style>#a { --v: state("a") } #b { --v: state("bb") } ${CSS('--v')} #a .s { text: var(--v) } #b .s { text: var(--v) }</style>`,
    body: BODY.replace('<div class="o" id="b"></div>', '<div class="o" id="b"></div>') + '<p></p>' });
  await page.evaluate(() => { for (const id of ['a', 'b']) { const s = document.createElement('span'); s.className = 's'; document.getElementById(id)!.prepend(s); } });
  await frames(page);
  await page.fill('#c input', 'typed');
  await frames(page);
  expect(await page.$eval('#a .s', (e) => e.textContent)).toBe('typed');
  await page.evaluate(() => document.getElementById('b')!.append(document.getElementById('c')!));
  await frames(page);
  expect(await page.$eval('#c input', (e: HTMLInputElement) => e.value)).toBe('bb');
  expect([await page.$eval('#a .s', (e) => e.textContent), await page.$eval('#b .s', (e) => e.textContent)]).toEqual(['typed', 'bb']);
  expect(await diagnostics(page)).toEqual([]);
});

test('a move inside one owner, and a move with no owner change, keep their references', async ({ page }) => {
  await open(page, { head: `<style>#a { --v: state("a") } ${CSS('--v')}</style>`, body: BODY.replace('</div></div>', '</div><p id="p"></p></div>') });
  await frames(page);
  await page.evaluate(() => document.getElementById('p')!.append(document.getElementById('c')!)); // still inside #a
  await frames(page);
  expect(await read(page)).toEqual(A);
  expect(await diagnostics(page)).toEqual([]);
});

test('many subtrees moved in one task: each reads its new owner; subtrees nested in a moved one too', async ({ page }) => {
  await open(page, { head: `<style>#a { --v: state("a") } #b { --v: state("bb") } .i:when(--v == "bb") { color: rgb(255, 0, 0) } .i { width: when(--v == "bb", 20px, 10px); display: block }</style>`,
    body: `<div id="a">${'<p class="i"></p>'.repeat(5)}<div id="n"><p class="i" id="deep"></p></div></div><div id="b"></div>` });
  await frames(page);
  await page.evaluate(() => { const a = document.getElementById('a')!, b = document.getElementById('b')!; b.append(document.getElementById('n')!); for (const p of [...a.querySelectorAll('.i')].slice(0, 3)) b.append(p); });
  await frames(page);
  const widths = () => page.$$eval('.i', (l) => l.map((e) => e.closest('#a, #b')!.id + ':' + getComputedStyle(e).width));
  expect((await widths()).sort()).toEqual(['a:10px', 'a:10px', 'b:20px', 'b:20px', 'b:20px', 'b:20px']);
  expect(await v(page, '#deep', 'color')).toBe('rgb(255, 0, 0)');
  expect(await diagnostics(page)).toEqual([]);
});
