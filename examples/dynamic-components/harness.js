// Test harness for the dynamic-components example. Plain DOM scripting that exercises the
// library's lifecycle; the cards themselves need none of it. Not a Reactive CSS API.
(() => {
  const cards = document.getElementById('cards');
  const stats = document.querySelector('.stats');
  let made = 2, removed = null, extra = null, labels = null;

  const card = () => {
    const n = ++made, d = document.createElement('div');
    d.className = 'counter'; d.id = 'c' + n;
    // Built with DOM methods (no innerHTML): the same structure as the static cards.
    const h = document.createElement('h3'); h.textContent = 'Card ' + n;
    const dec = Object.assign(document.createElement('button'), { type: 'button', className: 'dec', textContent: '−' });
    const num = Object.assign(document.createElement('span'), { className: 'n', textContent: '0' });
    const inc = Object.assign(document.createElement('button'), { type: 'button', className: 'inc', textContent: '+' });
    const label = Object.assign(document.createElement('span'), { className: 'label', textContent: 'count' });
    d.append(h, dec, ' ', num, ' ', inc, ' ', label);
    return d;
  };

  const show = () => {
    const s = window.ReactiveCSS?.stats();
    if (!s) return;
    stats.textContent = `cards: ${cards.children.length} · states: ${s.states} · bindings: ${s.bindings} · sheets: ${s.sheets}` +
      ` · step-2 sheet: ${extra ? 'on' : 'off'} · removed card held by harness: ${removed ? removed.id : 'none'}` +
      `\ndiagnostics: ${window.ReactiveCSS.diagnostics.length ? window.ReactiveCSS.diagnostics.join(' | ') : 'none'}`;
  };

  const actions = {
    mount() { cards.append(card()); },
    remove() { removed = cards.firstElementChild; removed?.remove(); },
    move() { const last = cards.lastElementChild; if (last) cards.prepend(last); },
    reinsert() { if (removed) { cards.append(removed); removed = null; } },
    // An action in the same task as the removal: the state change's queued work must not touch
    // the removed card afterwards (no errors, no leaks).
    pending() { const c = cards.firstElementChild; if (!c) return; c.querySelector('.inc').click(); c.remove(); removed = c; },
    // <link> elements to static files, not <style>: the examples run under a strict CSP.
    sheet() {
      if (extra) { extra.remove(); extra = null; return; }
      extra = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: 'step2.css' });
      document.head.append(extra);
    },
    recompile() {
      // Swapping the href makes the library load and compile the sheet again; the cards' counts
      // (declared in style.css) are kept.
      if (!labels) { labels = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: 'labels-a.css', id: 'labels' }); document.head.append(labels); return; }
      labels.href = labels.getAttribute('href') === 'labels-a.css' ? 'labels-b.css' : 'labels-a.css';
    },
  };
  document.querySelector('.harness').addEventListener('click', (e) => {
    const b = e.target.closest('[data-h]');
    if (!b) return;
    actions[b.dataset.h]();
    requestAnimationFrame(() => requestAnimationFrame(show));
  });
  addEventListener('load', () => requestAnimationFrame(() => requestAnimationFrame(show)));
})();
