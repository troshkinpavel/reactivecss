// 0.5.3: attr: <attribute> <value> — HTML attributes derived from (usually ancestor-owned) state.
import { test, expect, type Page } from '@playwright/test';
import { open, frames, stats, diagnostics } from './helpers';

const attr = (page: Page, sel: string, name: string) => page.$eval(sel, (e, n) => e.getAttribute(n), name);
const attrs = (page: Page, sel: string, name: string) => page.$$eval(sel, (es, n) => es.map((e) => e.getAttribute(n)), name);
const css = (page: Page, sel: string, p: string) => page.$eval(sel, (e, p) => getComputedStyle(e).getPropertyValue(p).trim(), p);
const diag = async (page: Page) => (await diagnostics(page)).join('\n');

const STEPPER = `<style>
  .qty { --n: state(1) }
  .qty .minus { on: click(decrement(--n)); attr: disabled when(--n <= 1) }
  .qty .plus { on: click(increment(--n)); attr: disabled when(--n >= 4) }
  .qty output { text: var(--n) }
</style>`;
const STEPPER_BODY = '<div class="qty"><button class="minus">−</button><output>1</output><button class="plus">+</button></div>';

test.describe('the acceptance cases', () => {
  test('ancestor state drives disabled, aria-expanded, aria-current and data-* on descendants', async ({ page }) => {
    await open(page, {
      head: `<style>
        .w { --step: state(1); --open: state(false); --status: state(idle) }
        .w .next { on: click(increment(--step)); attr: disabled when(--step >= 4) }
        .w .toggle { on: click(toggle(--open)); attr: aria-expanded var(--open) }
        .w li:nth-child(1) { attr: aria-current when(--step == 1, "step", "false") }
        .w li:nth-child(2) { attr: aria-current when(--step == 2, "step", "false") }
        .w .card { attr: data-state var(--status) }
        .w .go { on: click(set(--status, busy)) }
      </style>`,
      body: '<div class="w"><ol><li>1</li><li>2</li></ol><button class="next">next</button><button class="toggle">t</button><button class="go">go</button><div class="card"></div></div>',
    });
    await frames(page);
    expect(await attrs(page, 'li', 'aria-current')).toEqual(['step', 'false']);
    expect(await attr(page, '.toggle', 'aria-expanded')).toBe('false');
    expect(await attr(page, '.card', 'data-state')).toBe('idle');
    expect(await attr(page, '.next', 'disabled')).toBe(null); // false: absent, never disabled="false"
    await page.click('.next');
    expect(await attrs(page, 'li', 'aria-current')).toEqual(['false', 'step']); // same task as the click
    await page.click('.toggle');
    expect(await attr(page, '.toggle', 'aria-expanded')).toBe('true');
    await page.click('.go');
    expect(await attr(page, '.card', 'data-state')).toBe('busy');
    await page.click('.next'); await page.click('.next');
    expect(await attr(page, '.next', 'disabled')).toBe('');
    expect(await page.$eval('.next', (b) => b.matches(':disabled'))).toBe(true);
    expect(await css(page, '.w', '--step')).toBe('4');
    expect(await page.locator('.next').ariaSnapshot()).toContain('[disabled]');
    expect(await diagnostics(page)).toEqual([]);
  });

  test('the owner state is not duplicated: one state, several elements, several attributes', async ({ page }) => {
    await open(page, { head: STEPPER, body: STEPPER_BODY });
    await frames(page);
    expect(await attr(page, '.minus', 'disabled')).toBe('');
    expect(await attr(page, '.plus', 'disabled')).toBe(null);
    expect((await stats(page)).states).toBe(1);
  });
});

test.describe('timing', () => {
  test('clicks in one task cannot pass a bound: disabled is in place before the next click', async ({ page }) => {
    await open(page, { head: STEPPER, body: STEPPER_BODY });
    await page.$eval('.plus', (b) => { for (let i = 0; i < 10; i++) (b as HTMLElement).click(); });
    expect(await css(page, '.qty', '--n')).toBe('4');
    expect(await attr(page, '.plus', 'disabled')).toBe('');
    expect(await attr(page, '.minus', 'disabled')).toBe(null); // the other button, same task
    await page.$eval('.minus', (b) => { for (let i = 0; i < 10; i++) (b as HTMLElement).click(); });
    expect(await css(page, '.qty', '--n')).toBe('1');
    await frames(page);
    expect(await page.textContent('output')).toBe('1');
  });

  test('rapid real pointer clicks cannot pass a bound', async ({ page }) => {
    await open(page, { head: STEPPER, body: STEPPER_BODY });
    const box = (await page.locator('.plus').boundingBox())!;
    for (let i = 0; i < 8; i++) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    expect(await css(page, '.qty', '--n')).toBe('4');
    expect(await attr(page, '.plus', 'disabled')).toBe('');
    await page.keyboard.press('Tab'); // focus was on a now-disabled button; keyboard still works
    const s = await stats(page);
    expect(s.stateChanges).toBe(3);
  });

  test('keyboard activation and repeated Enter respect the bound', async ({ page }) => {
    await open(page, { head: STEPPER, body: STEPPER_BODY });
    await page.focus('.plus');
    for (let i = 0; i < 6; i++) await page.keyboard.press('Enter');
    expect(await css(page, '.qty', '--n')).toBe('4');
    expect(await attr(page, '.plus', 'disabled')).toBe('');
  });

  test('a bound control (input) updates derived attributes in the same task', async ({ page }) => {
    await open(page, {
      head: `<style>.f { --name: state("") } .f input { bind: --name } .f .send { attr: disabled when(--name == "") }</style>`,
      body: '<form class="f"><input><button class="send" type="button">send</button></form>',
    });
    await frames(page);
    expect(await attr(page, '.send', 'disabled')).toBe('');
    const same = await page.$eval('.f input', (i: HTMLInputElement) => {
      i.value = 'Ada'; i.dispatchEvent(new Event('input', { bubbles: true }));
      return document.querySelector('.send')!.hasAttribute('disabled');
    });
    expect(same).toBe(false);
  });
});

test.describe('grammar and cascade', () => {
  test('several attr: declarations combine per attribute; the same attribute twice follows the cascade', async ({ page }) => {
    await open(page, {
      head: `<style>
        .o { --busy: state(true); --off: state(false) }
        .o button { attr: disabled var(--off); attr: aria-busy-no var(--busy); attr: data-busy var(--busy) }
        .o button { attr: aria-pressed var(--busy) }
        .o button { attr: data-x "first"; attr: data-x "second" }
        .o button.b { attr: data-y "specific" } .o button { attr: data-y "general" }
        @layer low, high; @layer high { .o button { attr: data-l "high" } } @layer low { .o .o2.o2 button { attr: data-l "low" } }
        .o button { attr: data-i "imp" !important } .o.o2 button.b { attr: data-i "normal" }
        @media (max-width: 1px) { .o button { attr: data-m "tiny" } }
        .o:when(--busy) button { attr: data-c "busy" }
      </style>`,
      body: '<div class="o o2"><button class="b">b</button></div>',
    });
    await frames(page);
    const got = await page.$eval('button', (b) => Object.fromEntries(['disabled', 'data-busy', 'aria-pressed', 'data-x', 'data-y', 'data-l', 'data-i', 'data-m', 'data-c'].map((a) => [a, b.getAttribute(a)])));
    expect(got).toEqual({ disabled: null, 'data-busy': '1', 'aria-pressed': 'true', 'data-x': 'second', 'data-y': 'specific', 'data-l': 'high', 'data-i': 'imp', 'data-m': null, 'data-c': 'busy' });
    expect(await diag(page)).toMatch(/"aria-busy-no" is not one of them/); // unknown name rejected, others kept
  });

  test('when no attr: declaration applies any more, the original attribute comes back', async ({ page }) => {
    await open(page, {
      head: `<style>.p { --on: state(true) } .p .x.active { attr: data-mode "on"; attr: hidden var(--on) } .p b { on: click(toggle(--on)) }
        .p .y { attr: data-v when(--on, "yes") }</style>`,
      body: '<div class="p"><span class="x active" data-mode="orig">x</span><span class="y">y</span><b>b</b></div>',
    });
    await frames(page);
    expect([await attr(page, '.x', 'data-mode'), await attr(page, '.x', 'hidden'), await attr(page, '.y', 'data-v')]).toEqual(['on', '', 'yes']);
    await page.click('.p b'); // when() with no false branch: no value, so restore
    expect([await attr(page, '.x', 'hidden'), await attr(page, '.y', 'data-v')]).toEqual([null, null]);
    await page.$eval('.x', (e) => e.classList.remove('active'));
    await frames(page);
    expect(await attr(page, '.x', 'data-mode')).toBe('orig');
  });

  test('values are checked: booleans need true/false, ARIA tokens are validated, "false" is never truthy', async ({ page }) => {
    await open(page, {
      head: `<style>.v { --s: state("false"); --k: state(maybe) } .v button { attr: disabled var(--s); attr: aria-expanded var(--s); attr: aria-current var(--k) }
        .v input { attr: required 2 } .v i { attr: aria-current "page" }</style>`,
      body: '<div class="v"><button aria-current="page">b</button><input><i>i</i></div>',
    });
    await frames(page);
    expect(await attr(page, 'button', 'disabled')).toBe(null);
    expect(await attr(page, 'button', 'aria-expanded')).toBe('false');
    expect(await attr(page, 'button', 'aria-current')).toBe('page'); // invalid token: unchanged
    expect(await attr(page, 'input', 'required')).toBe(null);
    expect(await attr(page, 'i', 'aria-current')).toBe('page');
    const d = await diag(page);
    expect(d).toMatch(/attr: aria-current on <button> cannot be maybe: use one of page, step/);
    expect(d).toMatch(/attr: required on <input\[type=text\]> cannot be 2: use true or false/);
  });

  test('hidden keeps until-found while true; data-* holds numbers, empty strings and markup as plain text', async ({ page }) => {
    await open(page, {
      head: `<style>.h { --show: state(false); --n: state(2.50) } .h p { attr: hidden when(--show, false, true) } .h b { on: click(toggle(--show)) }
        .h i { attr: data-n var(--n); attr: data-e ""; attr: data-html "<img src=x onerror=alert(1)>" }</style>`,
      body: '<div class="h"><p hidden="until-found">p</p><b>b</b><i>i</i></div>',
    });
    await frames(page);
    expect(await attr(page, 'p', 'hidden')).toBe('until-found');
    await page.click('.h b');
    expect(await attr(page, 'p', 'hidden')).toBe(null);
    await page.click('.h b');
    expect(await attr(page, 'p', 'hidden')).toBe('');
    expect(await page.$eval('i', (e) => [e.getAttribute('data-n'), e.getAttribute('data-e'), e.getAttribute('data-html'), e.children.length])).toEqual(['2.5', '', '<img src=x onerror=alert(1)>', 0]);
  });
});

test.describe('ownership', () => {
  test('state(…, bind(attribute)) owns its attribute: attr: for the same attribute is reported and ignored', async ({ page }) => {
    await open(page, {
      head: `<style>.t { --open: state(false, bind(aria-expanded)); on: click(toggle(--open)); attr: aria-expanded when(--open, false, true); attr: data-open var(--open) }</style>`,
      body: '<button class="t">t</button>',
    });
    await page.click('.t');
    expect(await attr(page, '.t', 'aria-expanded')).toBe('true'); // the state binding wins, always
    expect(await attr(page, '.t', 'data-open')).toBe('1'); // other attributes are unaffected (a boolean state is 1/0 in CSS)
    expect(await diag(page)).toMatch(/attr: aria-expanded on button\.t is ignored: a state\(…, bind\(aria-expanded\)\) on the same element owns/);
  });

  test('an outside change makes the binding yield: no more writes, no restore', async ({ page }) => {
    await open(page, { head: STEPPER, body: STEPPER_BODY + '<div id="host"></div>' });
    await frames(page);
    await page.$eval('.minus', (b) => b.removeAttribute('disabled')); // someone else takes it
    await page.click('.plus'); await page.click('.minus'); await page.click('.minus');
    expect(await attr(page, '.minus', 'disabled')).toBe(null);
    expect(await diag(page)).toMatch(/attr: disabled on button\.minus stopped: the attribute was changed by something else/);
    expect(await attr(page, '.plus', 'disabled')).toBe(null); // the other binding still works
  });

  test('attribute selectors on written attributes cannot loop, with or without a page MutationObserver', async ({ page }) => {
    await open(page, {
      head: `<style>.l { --on: state(false) } .l b { on: click(toggle(--on)) }
        .l [data-x="a"] { attr: data-x "b" } .l [data-x="b"] { attr: data-x "a" }
        .l [data-y] { attr: data-y var(--on) } .l [data-y="true"] { attr: data-z "seen" }</style>`,
      body: '<div class="l"><i data-x="a">x</i><i data-y="0">y</i><b>b</b></div>',
    });
    await page.evaluate(() => { (window as any).records = 0; new MutationObserver((r) => { (window as any).records += r.length; }).observe(document.body, { attributes: true, subtree: true }); });
    for (let i = 0; i < 4; i++) await page.click('.l b');
    await frames(page, 6);
    const n1 = await page.evaluate(() => (window as any).records);
    await frames(page, 6);
    expect(await page.evaluate(() => (window as any).records)).toBe(n1); // quiet: nothing oscillates
    // Bounded per state change: data-y, data-z, and the contradictory data-x pair flipping once per
    // read (same task, its one extra pass, and the frame).
    expect(n1).toBeLessThanOrEqual(4 * 6);
    expect(await attr(page, '[data-y]', 'data-y')).toBe('0');
  });
});

test.describe('element compatibility', () => {
  test('disabled and required only where HTML gives them a meaning; one warning per element type; no write', async ({ page }) => {
    await open(page, {
      head: `<style>.c { --on: state(true) }
        .c > * { attr: disabled var(--on) }
        .c > .r { attr: required var(--on) }
        .c svg { attr: hidden var(--on); attr: data-on var(--on) }
      </style>`,
      body: `<div class="c">
        <button>b</button><input class="r"><select class="r"><option disabled>o</option></select><textarea class="r"></textarea>
        <fieldset></fieldset><a href="#" class="a1">a</a><a href="#" class="a2">a</a><div class="r" id="d">d</div>
        <input class="r" type="range" id="range"><input class="r" type="checkbox" id="cb"><svg></svg>
      </div>`,
    });
    await frames(page);
    const d = await page.$$eval('.c > *', (es) => es.map((e) => `${e.localName}${e.id ? '#' + e.id : ''}:${e.hasAttribute('disabled')}/${e.hasAttribute('required')}`));
    expect(d).toEqual([
      'button:true/false', 'input:true/true', 'select:true/true', 'textarea:true/true', 'fieldset:true/false',
      'a:false/false', 'a:false/false', 'div#d:false/false', 'input#range:true/false', 'input#cb:true/true', 'svg:false/false',
    ]);
    expect(await page.$eval('svg', (e) => [e.hasAttribute('hidden'), e.getAttribute('data-on')])).toEqual([false, '1']);
    const all = await diagnostics(page);
    expect(all.filter((m) => /attr: disabled on <a>/.test(m))).toHaveLength(1); // deduplicated per element type
    expect(all.join('\n')).toMatch(/required only works on input .* on <input\[type=range\]> it would not be validated/);
    expect(all.join('\n')).toMatch(/hidden is an HTML attribute; <svg> is not an HTML element/);
  });

  test('form-associated custom elements can be disabled, also when defined later; other custom elements cannot', async ({ page }) => {
    await open(page, {
      head: `<style>.c { --on: state(true) } .c > * { attr: disabled var(--on) } .c b { on: click(toggle(--on)) }</style>
        <script>customElements.define('x-plain', class extends HTMLElement {});</script>`,
      body: '<div class="c"><x-field></x-field><x-plain></x-plain><b>b</b></div>',
    });
    await frames(page);
    expect(await page.$eval('x-field', (e) => e.hasAttribute('disabled'))).toBe(false); // not defined yet
    await page.evaluate(() => customElements.define('x-field', class extends HTMLElement { static formAssociated = true; }));
    await frames(page, 3);
    expect(await page.$eval('x-field', (e) => [e.hasAttribute('disabled'), e.matches(':disabled')])).toEqual([true, true]);
    expect(await page.$eval('x-plain', (e) => e.hasAttribute('disabled'))).toBe(false);
    await page.click('.c b');
    expect(await page.$eval('x-field', (e) => e.hasAttribute('disabled'))).toBe(false);
    expect(await diag(page)).toMatch(/<x-plain> is not form-associated/);
  });

  test('ARIA misuse is reported but written; a later input type change is honored on the next write', async ({ page }) => {
    await open(page, {
      head: `<style>.c { --on: state(false) } .c b { on: click(toggle(--on)) } .c .p { attr: aria-pressed var(--on); attr: aria-selected var(--on) }
        .c input { attr: required var(--on) }</style>`,
      body: '<div class="c"><span class="p">s</span><div role="tab" class="p">t</div><button class="p">x</button><input type="range"><b>b</b></div>',
    });
    await frames(page);
    expect(await attrs(page, '.p', 'aria-pressed')).toEqual(['false', 'false', 'false']);
    const d = await diag(page);
    expect(d).toMatch(/aria-pressed is for toggle buttons; <span> is not a button/);
    expect(d).toMatch(/aria-pressed is for toggle buttons; <div> with role="tab"/);
    expect(d).toMatch(/aria-selected needs a role like tab, option, row or gridcell; <span> without a role/);
    expect(d).not.toMatch(/aria-selected .*role="tab"/);
    await page.$eval('input', (i: HTMLInputElement) => { i.type = 'email'; });
    await page.click('.c b');
    expect(await attr(page, 'input', 'required')).toBe('');
  });
});

test.describe('lifecycle', () => {
  test('dynamic elements, removal, reinsertion, nested owners', async ({ page }) => {
    await open(page, {
      head: `<style>.g { --n: state(0) } .g > b { on: click(increment(--n)) } .g > i { attr: data-n var(--n) }</style>`,
      body: '<div class="g" id="o"><b>o</b><i></i><div class="g" id="in"><b>in</b><i></i></div></div><div id="host"></div>',
    });
    await page.click('#in > b'); await page.click('#in > b'); await page.click('#o > b');
    expect([await attr(page, '#o > i', 'data-n'), await attr(page, '#in > i', 'data-n')]).toEqual(['1', '2']); // nearest owner
    await page.evaluate(() => { document.getElementById('o')!.append(Object.assign(document.createElement('i'), { id: 'late' })); });
    await frames(page);
    expect(await attr(page, '#late', 'data-n')).toBe('1');
    const back = await page.evaluate(async () => {
      const i = document.getElementById('late')!; i.remove();
      await new Promise((r) => setTimeout(r));
      const detached = i.getAttribute('data-n');
      document.getElementById('in')!.append(i);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      return [detached, i.getAttribute('data-n')];
    });
    expect(back).toEqual([null, '2']); // restored on removal; the new owner's value after reinsertion
  });

  test('recompiling and removing the sheet: bindings follow, originals come back, stats return to zero', async ({ page }) => {
    await open(page, {
      head: `<style id="s">.k { --v: state(1) } .k i { attr: data-v var(--v) }</style>`,
      body: '<div class="k"><i data-v="orig">i</i></div>',
    });
    await frames(page);
    expect(await attr(page, 'i', 'data-v')).toBe('1');
    await page.evaluate(() => { document.getElementById('s')!.textContent = '.k { --v: state(1) } .k i { attr: data-w var(--v) }'; });
    await frames(page);
    expect([await attr(page, 'i', 'data-v'), await attr(page, 'i', 'data-w')]).toEqual(['orig', '1']);
    await page.evaluate(() => document.getElementById('s')!.remove());
    await frames(page);
    expect([await attr(page, 'i', 'data-v'), await attr(page, 'i', 'data-w')]).toEqual(['orig', null]);
    const s = await stats(page);
    expect([s.states, s.bindings]).toEqual([0, 0]);
  });

  test('1,000 rows: each row derives its own disabled from its own state', async ({ page }) => {
    const rows = Array.from({ length: 1000 }, (_, i) => `<li><button class="inc">+</button><button class="dec">-</button></li>`).join('');
    await open(page, {
      head: `<style>li { --n: state(0) } li .inc { on: click(increment(--n)); attr: disabled when(--n >= 1) } li .dec { on: click(decrement(--n)); attr: disabled when(--n <= 0) }</style>`,
      body: `<ul>${rows}</ul>`,
    });
    await frames(page, 3);
    expect(await page.$$eval('.dec[disabled]', (e) => e.length)).toBe(1000);
    await page.$eval('li:nth-child(500) .inc', (b) => { (b as HTMLElement).click(); (b as HTMLElement).click(); });
    expect(await page.$$eval('.inc[disabled]', (e) => e.length)).toBe(1);
    expect(await page.$$eval('.dec[disabled]', (e) => e.length)).toBe(999);
  });
});

test.describe('security', () => {
  test('unsafe and unknown attribute names are rejected at compile time', async ({ page }) => {
    await open(page, {
      head: `<style>.s { --v: state("x") } .s a { attr: onclick "alert(1)"; attr: href "javascript:alert(1)"; attr: style "color: red"; attr: class var(--v);
        attr: aria-describedby "free"; attr: data-ok attr(data-v); attr: data-u url(x.png); attr: id "y" }</style>`,
      body: '<div class="s"><a>a</a></div>',
    });
    await frames(page);
    expect(await page.$eval('a', (a) => a.getAttributeNames())).toEqual([]);
    const d = await diag(page);
    // 0.9.0 allows aria-label (text); ID references such as aria-describedby stay out.
    for (const n of ['onclick', 'href', 'style', 'class', 'aria-describedby', 'id']) expect(d).toContain(`"${n}" is not one of them`);
    expect(d).toMatch(/attr\(\) is not supported/);
  });

  test('untrusted stylesheets cannot write attributes', async ({ page }) => {
    await open(page, {
      head: `<script>window.ReactiveCSSConfig = { trustInlineStyles: false }</script><style>.m { --o: state(true) } .m b { attr: disabled var(--o) }</style>`,
      body: '<div class="m"><button>b</button></div>',
    });
    await frames(page);
    expect(await attr(page, 'button', 'disabled')).toBe(null);
    expect(await diag(page)).toMatch(/attr: is ignored in untrusted stylesheets/);
  });

  test('works under a strict CSP with a linked sheet', async ({ page }) => {
    await open(page, {
      head: '<link rel="stylesheet" href="/t/css/c.css">',
      css: { 'c.css': STEPPER.replace(/<\/?style>/g, '') },
      body: STEPPER_BODY,
      csp: "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'",
    });
    await expect.poll(() => attr(page, '.minus', 'disabled')).toBe('');
    for (let i = 0; i < 5; i++) await page.$eval('.plus', (b) => (b as HTMLElement).click());
    expect(await attr(page, '.plus', 'disabled')).toBe('');
    expect(await css(page, '.qty', '--n')).toBe('4');
  });
});

test.describe('update path (attr: performance experiment)', () => {
  const COUNT = `<script>(() => { const g = window.getComputedStyle; window.__gcs = 0; window.getComputedStyle = function (...a) { window.__gcs++; return g.apply(this, a); }; })();</script>`;
  const CSS = `.dv { --on: state(false) } .dv b { on: click(toggle(--on)) } .dv i { attr: data-on var(--on) } .dv i[data-on="1"] { outline: 1px solid }
    .dv { attr: data-c var(--on) } .dv u { attr: data-x "off" } .dv[data-c="1"] u { attr: data-x "on" }`;
  const body = '<span class="dv"><b>t</b><i></i><u></u></span>'.repeat(30);

  test('each same-task pass reads only its own event\'s bindings; every binding is re-read once in the frame', async ({ page }) => {
    await open(page, { head: COUNT + `<style>${CSS}</style>`, body });
    await frames(page, 3);
    const r = await page.evaluate(() => {
      const bs = document.querySelectorAll('.dv b');
      const g0 = (window as any).__gcs;
      const per: number[] = [];
      for (let i = 0; i < 20; i++) { const g = (window as any).__gcs; (bs[i] as HTMLElement).click(); per.push((window as any).__gcs - g); }
      return { per, total: (window as any).__gcs - g0 };
    });
    // 3 bindings per component (.dv, i, u), read twice (the first pass writes): 6 per click,
    // for the 20th click as for the first (0.5.3 re-read earlier clicks' bindings too: 6, 12, 18…).
    expect(new Set(r.per)).toEqual(new Set([6]));
    const before = await page.evaluate(() => (window as any).__gcs);
    await frames(page, 2);
    expect(await page.evaluate(() => (window as any).__gcs) - before).toBe(20 * 3); // frame re-read, once each
    // still correct: the chained attribute (an attribute selector on a written attribute) settled in the same task
    expect(await page.$$eval('.dv', (ds) => ds.slice(0, 20).every((d) => d.getAttribute('data-c') === '1' && d.querySelector('u')!.getAttribute('data-x') === 'on' && d.querySelector('i')!.getAttribute('data-on') === '1'))).toBe(true);
  });

  test('a burst of events before a frame leaves every attribute correct, in the same task and after the frame', async ({ page }) => {
    await open(page, { head: `<style>${CSS} .dv button { attr: disabled var(--on) }</style>`, body: '<span class="dv"><b>t</b><button>x</button><i></i><u></u></span>'.repeat(30) });
    await frames(page, 3);
    const ok = () => page.$$eval('.dv', (ds) => ds.every((d) => {
      const on = getComputedStyle(d).getPropertyValue('--on').trim() === '1';
      return (d.querySelector('button') as HTMLButtonElement).disabled === on && d.getAttribute('data-c') === (on ? '1' : '0') && d.querySelector('u')!.getAttribute('data-x') === (on ? 'on' : 'off');
    }));
    const same = await page.evaluate(() => {
      const bs = document.querySelectorAll<HTMLElement>('.dv b');
      for (let i = 0; i < 45; i++) bs[(i * 7) % bs.length].click();
      return [...document.querySelectorAll('.dv')].every((d) => {
        const on = d.querySelector('i')!.getAttribute('data-on') === '1';
        return (d.querySelector('button') as HTMLButtonElement).disabled === on && d.querySelector('u')!.getAttribute('data-x') === (on ? 'on' : 'off');
      });
    });
    expect(same).toBe(true);
    await frames(page, 2);
    expect(await ok()).toBe(true);
  });
});
