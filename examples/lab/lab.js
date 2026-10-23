// Demo lab tooling (not part of any example, not part of the library). Shows an example in an
// iframe with its source files and, on request, runtime diagnostics read from the example's own
// window.ReactiveCSS and a MutationObserver on its document. Text only: textContent, never HTML.
const $ = (s, r = document) => r.querySelector(s);
const viewer = $('.viewer'), frame = $('.frame'), source = $('.source');
let file = 'README.md', current = '', observer, timer;

function show(name) {
  const item = $(`nav li[data-name="${CSS.escape(name)}"]`);
  if (!item) return;
  current = name;
  for (const li of document.querySelectorAll('nav li[data-name]')) li.setAttribute('aria-current', String(li === item));
  viewer.hidden = false;
  $('.title').textContent = item.querySelector('a').textContent;
  $('.open').href = `../${name}/`;
  frame.src = `../${name}/`;
  frame.title = `Example: ${item.querySelector('a').textContent}`;
  load();
}

async function load() {
  source.textContent = 'Loading…';
  try {
    const r = await fetch(`../${current}/${file}`);
    source.textContent = r.ok ? await r.text() : `${file}: ${r.status}`;
  } catch (e) { source.textContent = `${file}: ${e.message}`; }
}

// ---- diagnostics (optional) ------------------------------------------------------------------
const describe = (el) => el.localName + (el.id ? '#' + el.id : '') + (el.classList.length ? '.' + [...el.classList].join('.') : '');
function watch() {
  observer?.disconnect(); clearInterval(timer);
  if (!$('.diag-toggle').checked) { $('.diagnostics').hidden = true; return; }
  $('.diagnostics').hidden = false;
  const win = frame.contentWindow, doc = frame.contentDocument;
  if (!win || !doc) return;
  const log = $('.log');
  observer = new win.MutationObserver((records) => {
    for (const r of records) {
      if (r.attributeName.startsWith('data-rcss-') || r.attributeName === 'style') continue; // library internals
      const li = document.createElement('li');
      li.textContent = `${describe(r.target)} ${r.attributeName} = ${JSON.stringify(r.target.getAttribute(r.attributeName))}`;
      log.prepend(li);
      while (log.children.length > 50) log.lastChild.remove();
    }
  });
  observer.observe(doc.documentElement, { attributes: true, subtree: true, attributeOldValue: true });
  const tick = () => {
    const api = win.ReactiveCSS;
    if (!api) return;
    const s = api.stats();
    const dl = $('.stats');
    dl.replaceChildren(...['sheets', 'states', 'bindings', 'stateChanges', 'flushes', 'parseMs'].map((k) => {
      const d = document.createElement('div'), t = document.createElement('dt'), v = document.createElement('dd');
      t.textContent = k; v.textContent = typeof s[k] === 'number' ? String(Math.round(s[k] * 100) / 100) : String(s[k]);
      d.append(t, v); return d;
    }));
    const diag = $('.diag');
    diag.replaceChildren(...(api.diagnostics.length ? api.diagnostics : ['none']).map((m) => Object.assign(document.createElement('li'), { textContent: m })));
  };
  tick();
  timer = setInterval(tick, 500);
}

$('.diag-toggle').addEventListener('change', watch);
frame.addEventListener('load', () => { $('.log').replaceChildren(); watch(); });
$('.clear-log').addEventListener('click', () => $('.log').replaceChildren());
$('.width').addEventListener('change', (e) => { frame.style.width = e.target.value ? e.target.value + 'px' : ''; });
for (const tab of document.querySelectorAll('.sources [role=tab]')) {
  tab.addEventListener('click', () => {
    file = tab.dataset.file;
    for (const t of document.querySelectorAll('.sources [role=tab]')) t.setAttribute('aria-selected', String(t === tab));
    load();
  });
}
document.querySelector('nav').addEventListener('click', (e) => {
  const a = e.target.closest('a');
  if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return; // new tab: the standalone page
  e.preventDefault();
  location.hash = a.closest('li').dataset.name;
});
addEventListener('hashchange', () => show(location.hash.slice(1)));
show(location.hash.slice(1) || 'product-configurator');
