// Test harness for the stylesheet lab: plain DOM scripting on <link> elements (CSP-friendly:
// no inline styles). Not a Reactive CSS API; the lab's behavior is all in the stylesheets.
(() => {
  const log = document.querySelector('.log');
  const $ = (id) => document.getElementById(id);
  let inserted = null;
  const say = (msg) => requestAnimationFrame(() => requestAnimationFrame(() => {
    const s = window.ReactiveCSS?.stats();
    log.textContent = `${msg}\nsheets: ${s?.sheets} · states: ${s?.states} · n: ${getComputedStyle($('lab')).getPropertyValue('--n').trim()}` +
      ` · diagnostics: ${window.ReactiveCSS?.diagnostics.length ? window.ReactiveCSS.diagnostics.join(' | ') : 'none'}`;
  }));
  const swap = (link, a, b) => { link.href = link.getAttribute('href') === a ? b : a; return link.getAttribute('href'); };
  const actions = {
    extra() { $('extra').disabled = !$('extra').disabled; return `extra.css disabled = ${$('extra').disabled}`; },
    media() { const l = $('extra'); l.media = l.media === '(max-width: 1px)' ? 'all' : '(max-width: 1px)'; return `extra.css media = ${l.media}`; },
    insert() {
      if (inserted) { inserted.remove(); inserted = null; return 'inserted.css removed'; }
      inserted = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: 'inserted.css', id: 'inserted' });
      document.head.append(inserted);
      return 'inserted.css added';
    },
    labels() { return `labels sheet now ${swap($('labels'), 'labels-v1.css', 'labels-v2.css')}`; },
    decl() { return `state sheet now ${swap($('decl'), 'state-v1.css', 'state-v2.css')}`; },
    refresh() { window.ReactiveCSS?.refresh(); return 'ReactiveCSS.refresh() called'; },
  };
  document.querySelector('.harness').addEventListener('click', (e) => {
    const b = e.target.closest('[data-h]');
    if (b) say(actions[b.dataset.h]());
  });
})();
