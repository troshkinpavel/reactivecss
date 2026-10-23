// Lab tooling: builds the cross-browser checklist from each example's README (section 8 table and
// section 9 notes). Text only (textContent, DOMParser for the lab index); nothing is stored.
const BROWSERS = ['Chrome', 'Safari', 'Firefox'];
const STATES = [['', 'not tested'], ['pass', 'pass'], ['fail', 'fail'], ['na', 'n/a']];
const main = document.querySelector('.checklist');
const el = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids); return e; };

/** Rows of the first Markdown table after `heading` ("| a | b |" lines, header and rule skipped). */
function table(md, heading) {
  const i = md.indexOf(heading);
  if (i < 0) return [];
  const lines = md.slice(i).split('\n').slice(1);
  const rows = [];
  for (const l of lines) {
    if (!l.startsWith('|')) { if (rows.length) break; continue; }
    // Markdown code and emphasis marks are dropped for display (the cells are plain text).
    rows.push(l.slice(1, -1).split(' | ').map((c) => c.trim().replace(/^\| ?/, '').replace(/ ?\|$/, '').replace(/`|\*\*/g, '')));
  }
  return rows.slice(2); // header + |---|
}

async function build() {
  const index = new DOMParser().parseFromString(await (await fetch('./')).text(), 'text/html');
  const examples = [...index.querySelectorAll('.examples li')].map((li) => [li.dataset.name, li.querySelector('a').textContent]);
  for (const [name, title] of examples) {
    const md = await (await fetch(`../${name}/README.md`)).text();
    const rows = table(md, '## 8.');
    const notes = table(md, '## 9.');
    const sec = el('section', { id: name }, el('h2', {}, el('a', { href: `../${name}/`, textContent: title })));
    const t = el('table', {}, el('tr', {}, el('th', { textContent: 'Action' }), el('th', { textContent: 'Expected' }), ...BROWSERS.map((b) => el('th', { textContent: b }))));
    rows.forEach(([action, expected], r) => {
      const tr = el('tr', {}, el('td', { textContent: action }), el('td', { textContent: expected }));
      for (const b of BROWSERS) {
        const s = el('select', { 'aria-label': `${b}: ${action}` }, ...STATES.map(([v, label]) => el('option', { value: v, textContent: label })));
        s.dataset.example = name; s.dataset.row = String(r); s.dataset.browser = b;
        s.addEventListener('change', () => { s.className = s.value; });
        tr.append(el('td', {}, s));
      }
      t.append(tr);
    });
    sec.append(t);
    if (notes.length) sec.append(el('p', { className: 'notes', textContent: notes.map(([b, n]) => `${b}: ${n}`).join('\n') }));
    main.append(sec);
  }
}

function markdown() {
  const who = document.querySelector('.who').value || '(not given)', versions = document.querySelector('.versions').value || '(not given)';
  const out = [`# Reactive CSS 0.8.1 manual results`, '', `Tester: ${who}. Browsers: ${versions}. Unset cells are **not tested**.`, ''];
  for (const sec of main.querySelectorAll('section')) {
    out.push(`## ${sec.querySelector('h2').textContent}`, '', `| Action | ${BROWSERS.join(' | ')} |`, `|---|${BROWSERS.map(() => '---').join('|')}|`);
    for (const tr of [...sec.querySelectorAll('tr')].slice(1)) {
      const cells = [...tr.querySelectorAll('select')].map((s) => s.value || 'not tested');
      out.push(`| ${tr.cells[0].textContent} | ${cells.join(' | ')} |`);
    }
    out.push('');
  }
  return out.join('\n');
}

document.querySelector('.copy').addEventListener('click', async () => {
  const text = markdown(), area = document.querySelector('.out');
  area.hidden = false; area.value = text; area.select();
  try { await navigator.clipboard.writeText(text); } catch { /* selected in the text area: copy by hand */ }
});
document.querySelector('.print').addEventListener('click', () => print());
build();
