// Preview bridge: runs inside the sandboxed example iframe, next to the real Reactive CSS
// runtime. It only observes. It reads custom properties with getComputedStyle after the
// runtime writes them, reports native events and form submissions, and never touches the
// library's internals or public API. Protocol: src/lib/examples/protocol.ts.
(() => {
  'use strict';
  const SOURCE = 'rcss-preview', HOST = 'rcss-host', V = 1;
  let spec = { props: [], triggers: [] };
  try { spec = JSON.parse(document.getElementById('rcss-watch').textContent); } catch (e) { /* empty spec */ }

  const post = (type, data) => parent.postMessage(Object.assign({ source: SOURCE, v: V, type }, data), '*');
  const label = (el) => {
    if (!el || el.nodeType !== 1) return 'document';
    const cls = el.classList.length ? '.' + el.classList[0] : '';
    return el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + cls;
  };
  const safe = (fn, fallback) => { try { return fn(); } catch (e) { return fallback; } };

  let owners = [];
  const last = new Map();
  function collect() {
    owners = [];
    for (const p of spec.props) {
      const els = p.selector === ':root' ? [document.documentElement] : safe(() => [...document.querySelectorAll(p.selector)], []);
      els.forEach((el, i) => owners.push({ name: p.name, el, owner: i, ownerLabel: label(el) + (els.length > 1 ? ' ' + (i + 1) : '') }));
    }
  }
  function read(all) {
    const out = [];
    for (const o of owners) {
      if (!o.el.isConnected) continue;
      const value = getComputedStyle(o.el).getPropertyValue(o.name).trim();
      const key = o.name + '@' + o.owner;
      if (all || last.get(key) !== value) { last.set(key, value); out.push({ name: o.name, owner: o.owner, ownerLabel: o.ownerLabel, value }); }
    }
    return out;
  }

  let lastEvent = null, lastEventAt = 0, scheduled = false, diagCount = 0;
  const diagnostics = () => safe(() => (window.ReactiveCSS && window.ReactiveCSS.diagnostics || []).map((d) => String(d && d.message || d)), []);
  function flush() {
    scheduled = false;
    reportSize();
    const readings = read(false);
    const cause = lastEvent !== null && performance.now() - lastEventAt < 400 ? lastEvent : null;
    if (readings.length) post('values', { readings, cause });
    const d = diagnostics();
    if (d.length !== diagCount) { diagCount = d.length; post('diagnostics', { messages: d.slice(-20) }); }
  }
  // Two frames, so the runtime has written its values. Browsers pause animation frames in
  // off-screen cross-origin frames, so a timer stands in when no frame comes.
  function afterFrames(fn) {
    let done = false;
    const run = () => { if (!done) { done = true; fn(); } };
    requestAnimationFrame(() => requestAnimationFrame(run));
    setTimeout(run, 120);
  }
  function schedule() { if (!scheduled) { scheduled = true; afterFrames(flush); } }

  // Which on: / bind: rules an event reaches, by the same selector the stylesheet uses.
  const BUBBLING = new Set(['click', 'input', 'change']);
  function triggered(e) {
    const t = e.target && e.target.nodeType === 1 ? e.target : null;
    if (!t) return [];
    return spec.triggers.filter((tr) => tr.events.some((ev) => {
      if (ev === e.type && BUBBLING.has(ev)) return !!safe(() => t.closest(tr.selector), null);
      if (ev === e.type) return safe(() => t.matches(tr.selector), false);
      if (e.type === 'keydown' && ev.startsWith('key:')) return ev.slice(4).split('+').pop() === e.key && !!safe(() => t.closest(tr.selector), null);
      if (ev === 'outside:' + e.type) return !safe(() => t.closest(tr.selector), null) && !!safe(() => document.querySelector(tr.selector), null);
      return false;
    })).map((tr) => tr.line);
  }

  let id = 0;
  const onEvent = (e) => {
    if (e.type === 'keydown' && e.key.length === 1) return; // typing is reported through input events
    lastEvent = ++id; lastEventAt = performance.now();
    post('event', { id, event: e.type, target: label(e.target), key: e.type === 'keydown' ? e.key : null, triggers: triggered(e) });
    schedule();
  };
  for (const type of ['click', 'input', 'change', 'keydown', 'pointerdown', 'focusin', 'reset', 'pointerenter', 'pointerleave', 'focus', 'blur']) {
    window.addEventListener(type, (e) => {
      if ((type === 'pointerdown' || type === 'focusin') && !spec.triggers.some((t) => t.events.includes('outside:' + type))) return;
      if ((type === 'pointerenter' || type === 'pointerleave' || type === 'focus' || type === 'blur') && !spec.triggers.some((t) => t.events.includes(type))) return;
      onEvent(e);
    }, true);
  }

  // Forms: validation and submission stay native. This page has no server, so the submit is
  // stopped and the data the browser would send is reported instead (CSP also blocks it).
  window.addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.target;
    const fields = safe(() => [...new FormData(form)].map(([k, v]) => [k, String(v)]), []);
    const sent = new Set(fields.map((f) => f[0]));
    const omitted = [...form.querySelectorAll('input[type="checkbox"][name]')].map((i) => i.name).filter((n) => !sent.has(n));
    post('submit', { method: (form.getAttribute('method') || 'get').toUpperCase(), action: form.getAttribute('action') || '', fields, omitted });
  }, true);
  window.addEventListener('invalid', (e) => {
    const v = e.target.validity, reason = v ? Object.keys(Object.getPrototypeOf(v)).find((k) => k !== 'valid' && v[k]) || 'invalid' : 'invalid';
    post('invalid', { field: e.target.name || label(e.target), reason });
  }, true);

  // Host requests: outline the parts of the preview an expression affects.
  window.addEventListener('message', (e) => {
    if (e.source !== parent || !e.data || e.data.source !== HOST || e.data.v !== V) return;
    if (e.data.type === 'highlight' && Array.isArray(e.data.selectors)) {
      document.querySelectorAll('[data-rcss-inspect]').forEach((el) => el.removeAttribute('data-rcss-inspect'));
      for (const s of e.data.selectors.slice(0, 50)) if (typeof s === 'string') safe(() => document.querySelectorAll(s), []).forEach((el) => el.setAttribute('data-rcss-inspect', ''));
    }
  });

  window.addEventListener('error', (e) => post('diagnostics', { messages: [String(e.message)] }));

  // Content height, measured from the body's children, so it can shrink as well as grow.
  let lastHeight = -1;
  function reportSize() {
    const body = document.body;
    if (!body) return;
    let bottom = 0;
    for (const el of body.children) if (el.tagName !== 'SCRIPT') bottom = Math.max(bottom, el.getBoundingClientRect().bottom + parseFloat(getComputedStyle(el).marginBottom));
    const height = Math.ceil(bottom + parseFloat(getComputedStyle(body).paddingBottom) + window.scrollY);
    if (height !== lastHeight) { lastHeight = height; post('size', { height }); }
  }

  function start() {
    const style = document.createElement('style');
    style.textContent = '[data-rcss-inspect]{outline:2px solid oklch(0.6 0.2 35)!important;outline-offset:2px}';
    document.head.appendChild(style);
    collect();
    new ResizeObserver(reportSize).observe(document.body);
    for (const el of document.body.children) new ResizeObserver(reportSize).observe(el);
    new MutationObserver((records) => {
      if (records.some((r) => r.type === 'childList')) collect();
      schedule();
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class', 'checked', 'value'], childList: true, subtree: true });
    // The runtime writes its first values in the next frames.
    afterFrames(() => {
      const d = diagnostics();
      diagCount = d.length;
      post('ready', { readings: read(true), diagnostics: d.slice(-20) });
      reportSize();
    });
  }
  // Deferred scripts (the runtime) run before DOMContentLoaded.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
