// src/core/registry.ts
var functions = /* @__PURE__ */ new Map();
var selectors = /* @__PURE__ */ new Map();
var NAME = /^[a-z][a-z0-9-]*$/;
function defineFunction(def) {
  if (!NAME.test(def.name)) throw new Error(`Invalid function name "${def.name}"`);
  functions.set(def.name.toLowerCase(), def);
}
function defineSelector(def) {
  if (!NAME.test(def.name)) throw new Error(`Invalid selector name "${def.name}"`);
  selectors.set(def.name.toLowerCase(), def);
}
var runtimeStats = { sheets: 0, bindings: 0, sources: 0, parseMs: 0 };
var refreshers = /* @__PURE__ */ new Set();

// src/core/log.ts
var dev = true;
var diagnostics = [];
var summarized = false;
function warn(message) {
  if (diagnostics.includes(message)) return;
  diagnostics.push(message);
  if (dev) console.warn("[reactive-css] " + message);
  else if (!summarized) {
    summarized = true;
    setTimeout(() => console.warn(`[reactive-css] ${diagnostics.length} issue(s). See ReactiveCSS.diagnostics, or load reactive-css.js for details.`));
  }
}
function note(message) {
  if (diagnostics.includes(message)) return;
  diagnostics.push(message);
  if (dev) console.info("[reactive-css] " + message);
}

// src/functions/values.ts
var NUMBER = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)([a-z%]*)$/i;
function parseNumber(s) {
  const m = NUMBER.exec(s.trim());
  return m ? { v: +m[1], unit: m[2].toLowerCase() } : void 0;
}
var fmt = (v) => String(+v.toFixed(4) || 0);
var isStatic = (a) => a.parts.every((p) => typeof p === "string");
function numericRange(min, max, step) {
  const a = parseNumber(min);
  const b = parseNumber(max);
  if (!a || !b) return void 0;
  const unit = a.unit === b.unit ? a.unit : a.v === 0 && !a.unit ? b.unit : b.v === 0 && !b.unit ? a.unit : void 0;
  if (unit === void 0) return void 0;
  let s;
  if (step !== void 0) {
    const n = parseNumber(step);
    if (!n || n.unit !== unit && !(n.unit === "" && n.v === 0)) throw new Error(`step "${step}" must use the same unit as min and max`);
    if (n.v <= 0) throw new Error("step must be greater than 0");
    s = n.v;
  }
  return { min: a.v, max: b.v, step: s, unit };
}
function randomValue(min, max, step, r) {
  const n = numericRange(min, max, step);
  if (n) return fromRange(n, r);
  if (step !== void 0) throw new Error("`by` steps need min and max as plain numbers in one unit");
  return `calc(${min} + (${max} - ${min}) * ${fmt(r)})`;
}
function fromRange(n, r) {
  let v = n.min;
  if (n.max > n.min) {
    v = n.step ? n.min + Math.floor(r * (Math.floor((n.max - n.min) / n.step + 1e-9) + 1)) * n.step : n.min + r * (n.max - n.min);
  }
  return fmt(v) + n.unit;
}
defineFunction({
  name: "random",
  kind: "generator",
  compile(args) {
    let first = 0;
    let shared = false;
    const head = args[0]?.text.toLowerCase() ?? "";
    if (args.length > 2 && isStatic(args[0]) && /^(auto|element-shared|--|fixed\b)/.test(head)) {
      if (head.startsWith("--") || head.startsWith("fixed"))
        throw new Error(`"${args[0].text}" (named or fixed random values) is not supported yet`);
      shared = head === "element-shared";
      first = 1;
    }
    const rest = args.length - first;
    if (rest < 2 || rest > 3) throw new Error("expected random(min, max) or random(min, max, by step)");
    let step;
    if (rest === 3) {
      const m = /^by\s+(.+)$/i.exec(args[first + 2].text);
      if (!m || !isStatic(args[first + 2])) throw new Error('the third argument must be "by <step>". To re-roll over time use live(random(...), 2s)');
      step = m[1];
    }
    const [min, max] = [args[first], args[first + 1]];
    let range;
    if (isStatic(min) && isStatic(max)) {
      randomValue(min.text, max.text, step, 0);
      range = numericRange(min.text, max.text, step);
      if (range && range.max < range.min) warn(`random(${min.text}, ${max.text}): max is below min, so the result is always min.`);
    }
    return { shared, first, step, range };
  },
  create(_ctx, args, d) {
    let value;
    const roll = d.range ? () => fromRange(d.range, Math.random()) : () => randomValue(args[d.first].get(), args[d.first + 1].get(), d.step, Math.random());
    if (d.shared) return { get: () => d.sharedValue ??= roll() };
    return {
      get: () => value ??= roll(),
      reset: () => {
        value = void 0;
      }
    };
  }
});
defineFunction({
  name: "pick",
  kind: "generator",
  compile(args) {
    if (args.length === 0) throw new Error("expected at least one value");
  },
  create(_ctx, args) {
    let index;
    return {
      get: () => args[index ??= Math.floor(Math.random() * args.length)].get(),
      reset: () => {
        index = void 0;
      }
    };
  }
});

// src/core/scheduler.ts
var groups = /* @__PURE__ */ new Map();
var dirtyJobs = /* @__PURE__ */ new Set();
var frameTasks = /* @__PURE__ */ new Set();
var timer;
var raf = 0;
var counters = { flushes: 0, lastFlushMs: 0, totalFlushMs: 0, ticks: 0 };
var now = () => performance.now();
var hidden = () => typeof document !== "undefined" && document.visibilityState === "hidden";
function arm() {
  clearTimeout(timer);
  timer = void 0;
  if (hidden() || groups.size === 0) return;
  let next = Infinity;
  for (const g of groups.values()) next = Math.min(next, g.next);
  timer = setTimeout(tick, Math.max(0, next - now()));
}
function tick() {
  const t = now();
  for (const g of groups.values()) {
    if (g.next > t + 1) continue;
    counters.ticks++;
    for (const fn of [...g.fns]) fn();
    g.next += g.ms;
    if (g.next <= t) g.next = t + g.ms;
  }
  arm();
}
function every(ms, fn) {
  let g = groups.get(ms);
  if (!g) {
    g = { ms, next: now() + ms, fns: /* @__PURE__ */ new Set() };
    groups.set(ms, g);
    arm();
  }
  g.fns.add(fn);
  return () => {
    g.fns.delete(fn);
    if (g.fns.size === 0 && groups.get(ms) === g) {
      groups.delete(ms);
      arm();
    }
  };
}
function request() {
  if (!raf) raf = requestAnimationFrame(flush);
}
function dirty(job) {
  dirtyJobs.add(job);
  request();
}
function cancel(job) {
  dirtyJobs.delete(job);
}
function frame(fn) {
  frameTasks.add(fn);
  request();
}
function flush() {
  const t = now();
  raf = 0;
  for (const fn of [...frameTasks]) {
    frameTasks.delete(fn);
    fn();
  }
  const writes = [];
  for (const job of dirtyJobs) {
    const w = job.compute();
    if (w) writes.push(w);
  }
  dirtyJobs.clear();
  for (const w of writes) w();
  counters.flushes++;
  counters.lastFlushMs = now() - t;
  counters.totalFlushMs += counters.lastFlushMs;
}
function subscriptionCount() {
  let n = 0;
  for (const g of groups.values()) n += g.fns.size;
  return n;
}
function groupCount() {
  return groups.size;
}
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (!hidden()) {
      const t = now();
      for (const g of groups.values()) if (g.next < t) g.next = t;
    }
    arm();
  });
}

// src/functions/live.ts
var DEFAULT_INTERVAL = 1e3;
var MIN_INTERVAL = 50;
function parseTime(s) {
  const m = /^(\d*\.?\d+)(ms|s)$/i.exec(s.trim());
  return m ? +m[1] * (m[2].toLowerCase() === "s" ? 1e3 : 1) : void 0;
}
defineFunction({
  name: "live",
  kind: "operator",
  compile(args) {
    if (args.length < 1 || args.length > 2) throw new Error("expected live(expression) or live(expression, interval)");
    if (args.length === 1) return DEFAULT_INTERVAL;
    const t = args[1].parts.length === 1 && typeof args[1].parts[0] === "string" ? parseTime(args[1].text) : void 0;
    if (t === void 0) throw new Error(`interval "${args[1].text}" must be a time like 500ms or 2s`);
    if (t < MIN_INTERVAL) {
      warn(`live(): interval ${args[1].text} is below the ${MIN_INTERVAL}ms minimum; using ${MIN_INTERVAL}ms.`);
      return MIN_INTERVAL;
    }
    return t;
  },
  create(ctx, args, ms) {
    const stop2 = every(ms, () => {
      args[0].reset();
      ctx.notify();
    });
    return { get: () => args[0].get(), dispose: stop2 };
  }
});

// src/functions/sources.ts
var word = (a) => a && a.parts.length <= 1 ? a.text.toLowerCase() : void 0;
var EVENTS = /* @__PURE__ */ new Set([
  "click",
  "dblclick",
  "contextmenu",
  "pointerenter",
  "pointerleave",
  "pointerdown",
  "pointerup",
  "mouseenter",
  "mouseleave",
  "focus",
  "blur",
  "focusin",
  "focusout",
  "input",
  "change",
  "keydown",
  "keyup",
  "animationend",
  "animationiteration",
  "transitionend",
  "toggle"
]);
defineFunction({
  name: "on",
  kind: "event",
  compile(args) {
    if (args.length !== 2) throw new Error("expected on(event, expression)");
    const ev = word(args[0]);
    if (!ev || !EVENTS.has(ev)) throw new Error(`unsupported event "${args[0].text}". Supported: ${[...EVENTS].join(", ")}`);
    return ev;
  },
  // Evaluates once when bound, then again on every event on the element itself.
  create(ctx, args, ev) {
    const handler = () => {
      args[1].reset();
      ctx.notify();
    };
    ctx.el.addEventListener(ev, handler, { passive: true });
    runtimeStats.sources++;
    return {
      get: () => args[1].get(),
      dispose: () => {
        ctx.el.removeEventListener(ev, handler);
        runtimeStats.sources--;
      }
    };
  }
});
var pointer = { x: 0, y: 0 };
var pointerSubs = /* @__PURE__ */ new Set();
var notifyPointer = () => pointerSubs.forEach((fn) => fn());
var onMove = (e) => {
  pointer.x = e.clientX;
  pointer.y = e.clientY;
  frame(notifyPointer);
};
defineFunction({
  name: "mouse",
  kind: "source",
  compile(args) {
    const axis = word(args[0]);
    const mode = args.length > 1 ? word(args[1]) : "viewport";
    if (args.length > 2 || axis !== "x" && axis !== "y") throw new Error('expected mouse(x) or mouse(y), optionally with "viewport" or "local"');
    if (mode !== "viewport" && mode !== "local") throw new Error(`unknown coordinate mode "${args[1].text}"; use viewport or local`);
    return { axis, local: mode === "local" };
  },
  create(ctx, _args, d) {
    const notify = () => ctx.notify();
    if (!pointerSubs.size) addEventListener("pointermove", onMove, { passive: true });
    pointerSubs.add(notify);
    runtimeStats.sources++;
    return {
      get() {
        let v = pointer[d.axis];
        if (d.local) v -= ctx.el.getBoundingClientRect()[d.axis === "x" ? "left" : "top"];
        return fmt(v) + "px";
      },
      dispose() {
        pointerSubs.delete(notify);
        if (!pointerSubs.size) removeEventListener("pointermove", onMove);
        runtimeStats.sources--;
      }
    };
  }
});
var observers = /* @__PURE__ */ new Map();
function observeVisibility(el, threshold, fn) {
  let s = observers.get(threshold);
  if (!s) {
    const subs = /* @__PURE__ */ new Map();
    const io = new IntersectionObserver((entries2) => {
      for (const e of entries2) {
        const visible = e.isIntersecting && e.intersectionRatio >= threshold;
        subs.get(e.target)?.forEach((f) => f(visible));
      }
    }, { threshold: threshold || 0 });
    observers.set(threshold, s = { io, subs });
  }
  let set = s.subs.get(el);
  if (!set) {
    s.subs.set(el, set = /* @__PURE__ */ new Set());
    s.io.observe(el);
  }
  set.add(fn);
  const shared = s;
  return () => {
    set.delete(fn);
    if (set.size) return;
    shared.subs.delete(el);
    shared.io.unobserve(el);
    if (!shared.subs.size) {
      shared.io.disconnect();
      observers.delete(threshold);
    }
  };
}
defineFunction({
  name: "visible",
  kind: "source",
  compile(args) {
    if (args.length > 1) throw new Error("expected visible() or visible(<number between 0 and 1>)");
    if (!args.length) return 0;
    const t = Number(word(args[0]));
    if (!(t >= 0 && t <= 1)) throw new Error(`threshold "${args[0].text}" must be a number between 0 and 1`);
    return t;
  },
  // 0 until the browser reports the element as visible (at least `threshold` of it), then 1.
  create(ctx, _args, threshold) {
    let visible = false;
    const stop2 = observeVisibility(ctx.el, threshold, (v) => {
      if (v !== visible) {
        visible = v;
        ctx.notify();
      }
    });
    runtimeStats.sources++;
    return {
      get: () => visible ? "1" : "0",
      dispose: () => {
        stop2();
        runtimeStats.sources--;
      }
    };
  }
});
defineFunction({
  name: "viewport",
  kind: "native",
  compile(args) {
    const v = word(args[0]);
    if (args.length !== 1 || v !== "width" && v !== "height") throw new Error("expected viewport(width) or viewport(height)");
    return v;
  },
  // Dynamic viewport units track window.innerWidth / innerHeight natively: no runtime needed.
  native: (_args, v) => v === "width" ? "100dvw" : "100dvh"
});

// src/core/tokenizer.ts
var isWs = (c) => c === " " || c === "	" || c === "\n" || c === "\r" || c === "\f";
var isNameStart = (c) => /[a-zA-Z_]/.test(c) || c.charCodeAt(0) >= 128;
var isName = (c) => /[a-zA-Z0-9_-]/.test(c) || c.charCodeAt(0) >= 128;
var isHex = (c) => /[0-9a-fA-F]/.test(c);
var validEscape = (s, i) => s[i] === "\\" && i + 1 < s.length && s[i + 1] !== "\n";
function escape(s, i) {
  if (isHex(s[i])) {
    let j = i;
    while (j < s.length && j - i < 6 && isHex(s[j])) j++;
    const cp = parseInt(s.slice(i, j), 16);
    if (isWs(s[j] ?? "")) j++;
    return [cp === 0 || cp > 1114111 ? "\uFFFD" : String.fromCodePoint(cp), j];
  }
  return [s[i], i + 1];
}
function startsIdent(s, i) {
  const c = s[i] ?? "";
  if (c === "-") return isNameStart(s[i + 1] ?? "") || s[i + 1] === "-" || validEscape(s, i + 1);
  return isNameStart(c) || validEscape(s, i);
}
function tokenize(s) {
  const out = [];
  let i = 0;
  const push = (type, start2, value = "") => out.push({ type, start: start2, end: i, value });
  while (i < s.length) {
    const start2 = i;
    const c = s[i];
    if (c === "/" && s[i + 1] === "*") {
      const close = s.indexOf("*/", i + 2);
      i = close < 0 ? s.length : close + 2;
      push("comment", start2);
    } else if (isWs(c)) {
      while (i < s.length && isWs(s[i])) i++;
      push("ws", start2);
    } else if (c === '"' || c === "'") {
      i++;
      let body = "";
      while (i < s.length && s[i] !== c && s[i] !== "\n") {
        if (s[i] === "\\") {
          if (s[i + 1] === "\n") {
            i += 2;
            continue;
          }
          if (i + 1 >= s.length) {
            i++;
            break;
          }
          const [ch, next] = escape(s, i + 1);
          body += ch;
          i = next;
        } else body += s[i++];
      }
      if (s[i] === c) i++;
      push("string", start2, body);
    } else if (startsIdent(s, i)) {
      let name = "";
      while (i < s.length) {
        if (validEscape(s, i)) {
          const [ch, next] = escape(s, i + 1);
          name += ch;
          i = next;
        } else if (isName(s[i])) name += s[i++];
        else break;
      }
      if (s[i] === "(") {
        i++;
        if (name.toLowerCase() === "url") {
          let j = i;
          while (isWs(s[j] ?? "")) j++;
          if (s[j] !== '"' && s[j] !== "'") {
            let body = "";
            while (i < s.length && s[i] !== ")") {
              if (validEscape(s, i)) {
                const [ch, next] = escape(s, i + 1);
                body += ch;
                i = next;
              } else body += s[i++];
            }
            if (s[i] === ")") i++;
            push("url", start2, body.trim());
            continue;
          }
        }
        push("function", start2, name.toLowerCase());
      } else push("ident", start2, name);
    } else if ("()[]{};:,".includes(c)) {
      i++;
      push(c, start2, c);
    } else {
      i++;
      push("delim", start2, c);
    }
  }
  return out;
}
function matching(tokens, open) {
  let depth = 0;
  for (let i = open; i < tokens.length; i++) {
    const t = tokens[i].type;
    if (t === "(" || t === "[" || t === "{" || t === "function") depth++;
    else if (t === ")" || t === "]" || t === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return tokens.length;
}

// src/core/elements.ts
var entries = /* @__PURE__ */ new Map();
var memberOf = /* @__PURE__ */ new WeakMap();
var observer;
var filter = /* @__PURE__ */ new Set();
var subtree = (root) => [root, ...root.querySelectorAll("*")];
function join(e, el) {
  if (e.members.has(el)) return;
  e.members.add(el);
  let s = memberOf.get(el);
  if (!s) memberOf.set(el, s = /* @__PURE__ */ new Set());
  s.add(e);
  try {
    e.w.add(el);
  } catch (err) {
    warn(`Internal error while binding an element: ${err.message}`);
  }
}
function leave(e, el) {
  if (!e.members.delete(el)) return;
  memberOf.get(el)?.delete(e);
  try {
    e.w.remove(el);
  } catch (err) {
    warn(`Internal error while unbinding an element: ${err.message}`);
  }
}
function reconcile(e, root, removals) {
  const sel = e.w.selector;
  if (root.matches(sel)) join(e, root);
  for (const el of root.querySelectorAll(sel)) join(e, el);
  if (removals) {
    for (const m of [...e.members]) if (root.contains(m) && !m.matches(sel)) leave(e, m);
  }
}
function siblingSensitive(sel) {
  return tokenize(sel).some((t) => t.type === "delim" && (t.value === "+" || t.value === "~") || (t.type === "ident" || t.type === "function") && /^(nth-|first-|last-|only-)/i.test(t.value));
}
function attributesOf(sel) {
  const t = tokenize(sel);
  const out = [];
  t.forEach((tok, i) => {
    if (tok.type !== "[") return;
    let j = i + 1;
    while (t[j]?.type === "ws") j++;
    if (t[j]?.type === "ident") out.push(t[j].value.toLowerCase());
  });
  return out;
}
function observe() {
  const next = /* @__PURE__ */ new Set(["class", "id"]);
  for (const e of entries.values()) for (const a of attributesOf(e.w.selector)) next.add(a);
  next.delete("style");
  for (const a of next) if (a.startsWith("data-rcss")) next.delete(a);
  if (observer && [...next].every((a) => filter.has(a))) return;
  filter = next;
  if (observer) {
    handle(observer.takeRecords());
    observer.disconnect();
  }
  observer ??= new MutationObserver(handle);
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: [...filter] });
}
function handle(records2) {
  const added = /* @__PURE__ */ new Set();
  const changed = /* @__PURE__ */ new Set();
  const parents = /* @__PURE__ */ new Set();
  for (const r of records2) {
    if (r.type === "attributes") {
      changed.add(r.target);
      if (r.target.parentElement) parents.add(r.target.parentElement);
      continue;
    }
    if (r.target instanceof Element) parents.add(r.target);
    for (const n of r.removedNodes) {
      if (!(n instanceof Element)) continue;
      const moved = n.isConnected;
      for (const el of subtree(n)) {
        for (const e of [...memberOf.get(el) ?? []]) {
          if (!moved) leave(e, el);
          else e.w.move?.(el);
        }
      }
    }
    for (const n of r.addedNodes) if (n instanceof Element && n.isConnected) added.add(n);
  }
  for (const e of entries.values()) {
    for (const el of added) reconcile(e, el, false);
    for (const el of changed) if (el.isConnected) reconcile(e, el, true);
    if (e.sibling) {
      for (const p of parents) if (p.isConnected) reconcile(e, p, true);
    }
  }
}
function watch(w) {
  try {
    document.querySelector(w.selector);
  } catch {
    warn(`Unsupported selector "${w.selector}"; its reactive declarations are ignored.`);
    return;
  }
  const e = { w, members: /* @__PURE__ */ new Set(), sibling: siblingSensitive(w.selector) };
  entries.set(w, e);
  observe();
  reconcile(e, document.documentElement, false);
}
function unwatch(w) {
  const e = entries.get(w);
  if (!e) return;
  entries.delete(w);
  for (const el of [...e.members]) leave(e, el);
}
function membersOf(w) {
  return entries.get(w)?.members ?? /* @__PURE__ */ new Set();
}
function stopObserving() {
  observer?.disconnect();
  observer = void 0;
  for (const w of [...entries.keys()]) unwatch(w);
}

// src/selectors/just-checked.ts
var CHECKED = "data-rcss-just-checked";
var UNCHECKED = "data-rcss-just-unchecked";
var known = /* @__PURE__ */ new WeakMap();
var controls = {
  selector: 'input[type="checkbox" i], input[type="radio" i]',
  add: (el) => known.set(el, el.checked),
  remove: () => {
  }
};
function check(el, assumedPrevious) {
  const prev = known.get(el) ?? assumedPrevious;
  known.set(el, el.checked);
  if (prev === void 0 || prev === el.checked) return;
  el.toggleAttribute(CHECKED, el.checked);
  el.toggleAttribute(UNCHECKED, !el.checked);
}
function onChange(e) {
  const el = e.target;
  if (!(el instanceof HTMLInputElement) || el.type !== "checkbox" && el.type !== "radio") return;
  if (el.type === "radio" && el.name) {
    const group = el.form ? [...el.form.elements] : [...el.getRootNode().querySelectorAll("input")];
    for (const r of group)
      if (r instanceof HTMLInputElement && r.type === "radio" && r.name === el.name && r.form === el.form && r !== el) check(r);
  }
  check(el, !el.checked);
}
function onReset(e) {
  const form = e.target;
  if (form instanceof HTMLFormElement) setTimeout(() => {
    for (const c of form.elements) if (c instanceof HTMLInputElement) check(c);
  });
}
var refresh = () => membersOf(controls).forEach((el) => check(el));
var users = 0;
function install() {
  if (users++ === 0) {
    watch(controls);
    document.addEventListener("change", onChange, true);
    document.addEventListener("reset", onReset, true);
    refreshers.add(refresh);
  }
  return () => {
    if (--users) return;
    membersOf(controls).forEach((el) => {
      el.removeAttribute(CHECKED);
      el.removeAttribute(UNCHECKED);
    });
    unwatch(controls);
    document.removeEventListener("change", onChange, true);
    document.removeEventListener("reset", onReset, true);
    refreshers.delete(refresh);
  };
}
for (const [name, attr] of [["just-checked", CHECKED], ["just-unchecked", UNCHECKED]]) {
  defineSelector({
    name,
    kind: "state",
    functional: false,
    compile(_arg, _compound, sheet) {
      sheet.setup.push(install);
      return `[${attr}]`;
    }
  });
}

// src/selectors/nth-var.ts
var uses = /* @__PURE__ */ new Set();
var groups2 = /* @__PURE__ */ new Map();
var pending = /* @__PURE__ */ new Set();
var rebuild = false;
var observer2;
function schedule(g) {
  if (g) pending.add(g);
  frame(run);
}
function add(use, el) {
  const parent = el.parentElement;
  if (!parent) return;
  use.members.set(el, parent);
  let g = groups2.get(parent);
  if (!g) {
    groups2.set(parent, g = { parent, count: 0 });
    rebuild = true;
  }
  g.count++;
  schedule(g);
}
function remove(use, el) {
  const parent = use.members.get(el);
  if (!parent) return;
  use.members.delete(el);
  el.removeAttribute(use.attr);
  const g = groups2.get(parent);
  if (g && --g.count === 0) {
    groups2.delete(parent);
    pending.delete(g);
    rebuild = true;
    schedule();
  } else if (g) schedule(g);
}
function onMutations(records2) {
  for (const r of records2) {
    if (r.type === "attributes" && r.attributeName?.startsWith("data-rcss")) continue;
    const t = r.target;
    if (r.type === "childList") {
      const g = groups2.get(t);
      if (g) pending.add(g);
    } else for (const g of groups2.values()) if (t.contains(g.parent)) pending.add(g);
  }
  if (pending.size) schedule();
}
function observeGroups() {
  rebuild = false;
  if (observer2) {
    onMutations(observer2.takeRecords());
    observer2.disconnect();
  }
  observer2 ??= new MutationObserver(onMutations);
  const targets = /* @__PURE__ */ new Map();
  for (const parent of groups2.keys()) {
    targets.set(parent, true);
    for (let a = parent.parentElement; a && !targets.has(a); a = a.parentElement) targets.set(a, false);
  }
  targets.forEach((childList, el) => observer2.observe(el, { attributes: true, childList }));
}
function run() {
  if (rebuild) observeGroups();
  const reads = [...pending].filter((g) => g.parent.isConnected).map((g) => {
    const cs = getComputedStyle(g.parent);
    const values = /* @__PURE__ */ new Map();
    for (const u of uses) if (!values.has(u.varName)) values.set(u.varName, Number(cs.getPropertyValue(u.varName).trim() || NaN));
    return [g, values];
  });
  pending.clear();
  for (const [g, values] of reads) {
    const children = g.parent.children;
    for (let i = 0; i < children.length; i++) {
      const c = children[i];
      for (const u of uses) {
        if (u.members.get(c) !== g.parent) continue;
        const want = values.get(u.varName) === i + 1;
        if (c.hasAttribute(u.attr) !== want) c.toggleAttribute(u.attr, want);
      }
    }
  }
}
refreshers.add(() => {
  groups2.forEach((g) => pending.add(g));
  schedule();
});
var counter = 0;
defineSelector({
  name: "nth-var",
  kind: "structural",
  functional: true,
  compile(arg, compound, sheet) {
    if (!/^--[^\s,()]+$/.test(arg)) throw new Error(`:nth-var() expects a custom property name like --active, got "${arg}"`);
    if (!compound.replace(/:is\(\*\)/g, "").trim())
      throw new Error(":nth-var() needs a type, class or attribute selector on the same element, e.g. .slide:nth-var(--active)");
    const use = { varName: arg, attr: `data-rcss-nth-${counter++}`, members: /* @__PURE__ */ new Map() };
    sheet.setup.push(() => {
      uses.add(use);
      const w = {
        selector: compound,
        add: (el) => add(use, el),
        remove: (el) => remove(use, el),
        move: (el) => {
          remove(use, el);
          add(use, el);
        }
      };
      watch(w);
      return () => {
        unwatch(w);
        uses.delete(use);
      };
    });
    return `[${use.attr}]`;
  }
});

// src/core/parser.ts
var VAR_PREFIX = "--rcss-";
var varCounter = 0;
var GROUPING = /* @__PURE__ */ new Set(["media", "supports", "layer", "container", "scope", "starting-style", "document"]);
var STATEFUL = /* @__PURE__ */ new Set([
  "hover",
  "active",
  "focus",
  "focus-visible",
  "focus-within",
  "target",
  "target-within",
  "visited",
  "link",
  "any-link",
  "checked",
  "indeterminate",
  "default",
  "disabled",
  "enabled",
  "valid",
  "invalid",
  "user-valid",
  "user-invalid",
  "in-range",
  "out-of-range",
  "required",
  "optional",
  "read-only",
  "read-write",
  "placeholder-shown",
  "autofill",
  "open",
  "closed",
  "popover-open",
  "modal",
  "fullscreen",
  "picture-in-picture",
  "playing",
  "paused",
  "seeking",
  "buffering",
  "stalled",
  "muted",
  "volume-locked",
  "has",
  "scope",
  "empty",
  "blank",
  "state",
  "before",
  "after",
  "first-line",
  "first-letter",
  "current",
  "past",
  "future"
]);
function compile(source, baseURL) {
  const tokens = tokenize(source);
  const repl = [];
  const edits = [];
  const rules = [];
  const runtime = { setup: [] };
  const raw = (i) => repl[i] ?? source.slice(tokens[i].start, tokens[i].end);
  const text = (a, b) => {
    let s = "";
    for (let i = a; i < b; i++) s += tokens[i].type === "comment" ? " " : raw(i);
    return s.replace(/\s+/g, " ").trim();
  };
  const snippet = (a, b) => {
    const s = text(a, b);
    return s.length > 90 ? s.slice(0, 87) + "..." : s;
  };
  const significant = (i, end) => {
    while (i < end && (tokens[i].type === "ws" || tokens[i].type === "comment")) i++;
    return i;
  };
  const boundary = (i, end) => {
    for (; i < end; i++) {
      const t = tokens[i].type;
      if (t === "{" || t === ";") return i;
      if (t === "(" || t === "[" || t === "function") i = matching(tokens, i);
    }
    return end;
  };
  if (baseURL) rewriteURLs(tokens, repl, baseURL);
  function parseCall(open, close, nested) {
    const name = tokens[open].value;
    const def = functions.get(name);
    const args = [];
    let start2 = open + 1;
    const flush2 = (end) => {
      const parts = [];
      let buf = "";
      for (let i = start2; i < end; i++) {
        const t = tokens[i];
        if (t.type === "function" && functions.has(t.value)) {
          const c = matching(tokens, i);
          const node = parseCall(i, c, true);
          if (typeof node === "string") buf += node;
          else {
            if (buf) parts.push(buf);
            buf = "";
            parts.push(node);
          }
          i = c;
        } else buf += t.type === "comment" ? " " : raw(i);
      }
      if (buf) parts.push(buf);
      if (typeof parts[0] === "string") parts[0] = parts[0].trimStart();
      const last = parts.length - 1;
      if (typeof parts[last] === "string") parts[last] = parts[last].trimEnd();
      args.push({ parts: parts.filter((p) => p !== ""), text: text(start2, end) });
    };
    for (let i = start2; i < close; i++) {
      const t = tokens[i].type;
      if (t === ",") {
        flush2(i);
        start2 = i + 1;
      } else if (t === "(" || t === "[" || t === "{" || t === "function") i = matching(tokens, i);
    }
    flush2(close);
    if (args.length === 1 && args[0].parts.length === 0) args.length = 0;
    let data;
    try {
      data = def.compile?.(args);
    } catch (e) {
      throw new Error(`${name}(): ${e.message}`);
    }
    const native = def.native?.(args, data, nested);
    if (native !== void 0) return native;
    if (!def.create) throw new Error(`${name}() cannot be used here`);
    return { name, def, args, data };
  }
  function declaration(from, to, rule) {
    let colon = from;
    while (colon < to && tokens[colon].type !== ":") colon++;
    const local = [];
    const decls = [];
    try {
      for (let i = colon + 1; i < to; i++) {
        const t = tokens[i];
        if (t.type !== "function" || !functions.has(t.value)) continue;
        if (!rule) throw new Error("reactive functions are only supported inside style rules");
        const close = matching(tokens, i);
        const node = parseCall(i, close, false);
        if (typeof node === "string") local.push({ from: i, to: close + 1, text: node });
        else {
          const varName = VAR_PREFIX + (++varCounter).toString(36);
          local.push({ from: i, to: close + 1, text: `var(${varName})` });
          decls.push({ varName, call: node });
        }
        i = close;
      }
    } catch (e) {
      warn(`${e.message} in "${snippet(from, to)}". Declaration left unchanged.`);
      return;
    }
    edits.push(...local);
    if (decls.length) {
      if (!rules.includes(rule)) rules.push(rule);
      rule.decls.push(...decls);
    }
  }
  function selector(from, to, parent) {
    const local = [];
    try {
      for (let i = from; i < to; i++) {
        if (tokens[i].type !== ":" || tokens[i - 1]?.type === ":") continue;
        const t = tokens[i + 1];
        const def = t && (t.type === "ident" || t.type === "function") ? selectors.get(t.value.toLowerCase()) : void 0;
        if (!def) continue;
        if (def.functional !== (t.type === "function")) throw new Error(`:${def.name} ${def.functional ? "needs" : "takes no"} arguments`);
        const end = def.functional ? matching(tokens, i + 1) + 1 : i + 2;
        const arg = def.functional ? text(i + 2, end - 1) : "";
        const [cFrom, cTo] = compound(from, to, i);
        const candidate = resolveNesting(parent, strip(cFrom, i) + strip(end, cTo));
        local.push({ from: i, to: end, text: def.compile(arg, candidate, runtime) });
        i = end - 1;
      }
    } catch (e) {
      warn(`${e.message} in selector "${snippet(from, to)}". Rule left unchanged.`);
      return null;
    }
    edits.push(...local);
    return resolveNesting(parent, strip(from, to));
  }
  function compound(from, to, at) {
    const isCombinator = (i) => {
      const t = tokens[i];
      return t.type === "ws" || t.type === "," || t.type === "delim" && ">+~".includes(t.value);
    };
    let a = at;
    while (a > from && !isCombinator(a - 1)) {
      a--;
      if (tokens[a].type === ")" || tokens[a].type === "]") a = openerOf(a, from);
    }
    let b = at;
    while (b < to && !isCombinator(b)) {
      if (tokens[b].type === "(" || tokens[b].type === "[" || tokens[b].type === "function") b = matching(tokens, b);
      b++;
    }
    return [a, b];
  }
  function openerOf(close, from) {
    let depth = 0;
    for (let i = close; i >= from; i--) {
      const t = tokens[i].type;
      if (t === ")" || t === "]") depth++;
      else if (t === "(" || t === "[" || t === "function") {
        if (--depth === 0) return i;
      }
    }
    return from;
  }
  function strip(a, b) {
    let s = "";
    let negated = 0;
    const closers = [];
    for (let i = a; i < b; i++) {
      const t = tokens[i];
      if (t.type === ":" && negated === 0) {
        const pe = tokens[i + 1]?.type === ":";
        const n = tokens[i + (pe ? 2 : 1)];
        if (n && (n.type === "ident" || n.type === "function")) {
          const name = n.value.toLowerCase();
          if (pe || STATEFUL.has(name) || selectors.has(name)) {
            const nameIdx = i + (pe ? 2 : 1);
            i = n.type === "function" ? matching(tokens, nameIdx) : nameIdx;
            s += ":is(*)";
            continue;
          }
        }
      }
      if (t.type === "function" || t.type === "(") {
        const isNot = t.type === "function" && t.value === "not";
        closers.push(isNot);
        if (isNot) negated++;
      } else if (t.type === ")" && closers.pop()) negated--;
      s += t.type === "comment" ? " " : raw(i);
    }
    return s.replace(/\s+/g, " ").trim();
  }
  function block(from, to, rule) {
    let i = from;
    while (i < to) {
      i = significant(i, to);
      if (i >= to) break;
      const t = tokens[i];
      if (t.type === ";") {
        i++;
        continue;
      }
      if (t.type === "delim" && t.value === "@" && tokens[i + 1]?.type === "ident") {
        const name = tokens[i + 1].value.toLowerCase();
        const b2 = boundary(i + 2, to);
        if (b2 >= to || tokens[b2].type === ";") {
          i = b2 + 1;
          continue;
        }
        const close = matching(tokens, b2);
        if (GROUPING.has(name)) block(b2 + 1, close, rule);
        else if (hasReactiveSyntax(source.slice(t.start, tokens[close]?.end ?? source.length)))
          warn(`Reactive syntax inside @${name} is not supported; that block is left unchanged.`);
        i = close + 1;
        continue;
      }
      const b = boundary(i, to);
      if (b < to && tokens[b].type === "{") {
        const close = matching(tokens, b);
        const match = selector(i, b, rule?.match ?? null);
        if (match !== null) block(b + 1, close, { match, decls: [] });
        i = close + 1;
      } else {
        declaration(i, b, rule);
        i = b + 1;
      }
    }
  }
  block(0, tokens.length, null);
  edits.sort((a, b) => a.from - b.from);
  let css = "";
  for (let i = 0, e = 0; i < tokens.length; ) {
    if (edits[e]?.from === i) {
      css += edits[e].text;
      i = edits[e++].to;
    } else css += raw(i++);
  }
  return { css, rules, runtime, changed: edits.length > 0 || runtime.setup.length > 0 };
}
function resolveNesting(parent, sel) {
  if (!parent) return sel;
  const tokens = tokenize(sel);
  const parts = [];
  let start2 = 0;
  const push = (end) => {
    let s = "";
    let amp = false;
    for (let i = start2; i < end; i++) {
      const t = tokens[i];
      if (t.type === "delim" && t.value === "&") {
        s += `:is(${parent})`;
        amp = true;
      } else s += sel.slice(t.start, t.end);
    }
    s = s.trim();
    if (s) parts.push(amp ? s : `:is(${parent}) ${s}`);
  };
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].type === ",") {
      push(i);
      start2 = i + 1;
    } else if (tokens[i].type === "(" || tokens[i].type === "function" || tokens[i].type === "[") i = matching(tokens, i);
  }
  push(tokens.length);
  return parts.join(", ");
}
var quick;
var quickKey = -1;
function hasReactiveSyntax(css) {
  if (quickKey !== functions.size * 1e3 + selectors.size) {
    quickKey = functions.size * 1e3 + selectors.size;
    quick = new RegExp(
      `(?:^|[^\\w-])(?:${[...functions.keys()].join("|")})\\(|:(?:${[...selectors.keys()].join("|")})(?![\\w-])`,
      "i"
    );
  }
  return quick.test(css);
}
var URL_FUNCTIONS = /* @__PURE__ */ new Set(["url", "src", "image-set", "-webkit-image-set"]);
function rewriteURLs(tokens, repl, base) {
  const abs = (u) => {
    if (!u || u.startsWith("#")) return void 0;
    try {
      return `"${new URL(u, base).href}"`;
    } catch {
      return void 0;
    }
  };
  const stack = [];
  let prev1, prev2;
  tokens.forEach((t, i) => {
    if (t.type === "url") {
      const u = abs(t.value);
      if (u) repl[i] = `url(${u})`;
    } else if (t.type === "string") {
      const atImport = prev1?.type === "ident" && prev1.value.toLowerCase() === "import" && prev2?.value === "@";
      if (atImport || URL_FUNCTIONS.has(stack[stack.length - 1])) {
        const u = abs(t.value);
        if (u) repl[i] = u;
      }
    }
    if (t.type === "function") stack.push(t.value);
    else if (t.type === "(") stack.push("");
    else if (t.type === ")") stack.pop();
    if (t.type !== "ws" && t.type !== "comment") {
      prev2 = prev1;
      prev1 = t;
    }
  });
}

// src/core/engine.ts
function argInstance(a, ctx) {
  if (a.parts.every((p) => typeof p === "string")) {
    const text = a.parts.join("");
    return { text, get: () => text, reset() {
    }, dispose() {
    } };
  }
  const parts = a.parts.map((p) => typeof p === "string" ? p : instantiate(p, ctx));
  const calls = parts.filter((p) => typeof p !== "string");
  return {
    get: () => parts.map((p) => typeof p === "string" ? p : p.get()).join(""),
    reset: () => calls.forEach((c) => c.reset?.()),
    dispose: () => calls.forEach((c) => c.dispose?.())
  };
}
function instantiate(node, ctx) {
  const args = node.args.map((a) => argInstance(a, ctx));
  const inst = node.def.create(ctx, args, node.data);
  return {
    get: () => inst.get(),
    reset: () => {
      inst.reset?.();
      args.forEach((a) => a.reset());
    },
    dispose: () => {
      inst.dispose?.();
      args.forEach((a) => a.dispose());
    }
  };
}
function bind(el, decl) {
  const b = {
    el,
    varName: decl.varName,
    inst: void 0,
    compute() {
      if (!el.isConnected) return;
      let v;
      try {
        v = b.inst.get();
      } catch (e) {
        warn(`${decl.call.name}() failed: ${e.message}`);
        return;
      }
      if (v === b.last) return;
      b.last = v;
      return () => el.style.setProperty(b.varName, v);
    }
  };
  b.inst = instantiate(decl.call, { el, notify: () => dirty(b) });
  b.compute()?.();
  runtimeStats.bindings++;
  return b;
}
function unbind(b) {
  b.inst.dispose?.();
  cancel(b);
  b.el.style.removeProperty(b.varName);
  runtimeStats.bindings--;
}
function ruleWatcher(rule) {
  const bound = /* @__PURE__ */ new WeakMap();
  return {
    selector: rule.match,
    add(el) {
      if ("style" in el) bound.set(el, rule.decls.map((d) => bind(el, d)));
    },
    remove(el) {
      bound.get(el)?.forEach(unbind);
      bound.delete(el);
    }
  };
}
var records = /* @__PURE__ */ new Map();
var loads = /* @__PURE__ */ new WeakMap();
function setDisabled(el, disabled) {
  if (el instanceof HTMLLinkElement) el.disabled = disabled;
  else if (el.sheet) el.sheet.disabled = disabled;
}
function readable(href, link) {
  const u = new URL(href, location.href);
  return u.origin === location.origin || u.protocol === "data:" || u.protocol === "blob:" || link.crossOrigin !== null;
}
async function load(el) {
  const token = {};
  loads.set(el, token);
  if (!records.has(el) && (el instanceof HTMLLinkElement ? el.disabled : el.sheet?.disabled)) return;
  let text;
  let base;
  if (el instanceof HTMLLinkElement) {
    if (!el.href) return;
    if (!readable(el.href, el)) {
      note(`Skipped cross-origin stylesheet ${el.href}. If it contains Reactive CSS, serve it with CORS and add the crossorigin attribute to the <link>.`);
      drop(el);
      return;
    }
    try {
      const res = await fetch(el.href, { credentials: el.crossOrigin === "use-credentials" ? "include" : "same-origin" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      text = await res.text();
    } catch (e) {
      if (loads.get(el) === token)
        warn(`Cannot read stylesheet ${el.href} (${e.message}). Reactive CSS needs the stylesheet source: serve the page over http(s) and cross-origin sheets with CORS.`);
      return;
    }
    base = el.href;
  } else text = el.textContent ?? "";
  if (loads.get(el) !== token || !el.isConnected) return;
  apply(el, text, base);
}
function apply(el, text, base) {
  drop(el);
  if (!hasReactiveSyntax(text)) return;
  const t0 = performance.now();
  const c = compile(text, base);
  runtimeStats.parseMs += performance.now() - t0;
  if (!c.changed) return;
  const gen = document.createElement("style");
  gen.setAttribute("data-rcss", "");
  const media = el.getAttribute("media");
  if (media) gen.media = media;
  if (el.nonce) gen.nonce = el.nonce;
  gen.textContent = c.css;
  el.after(gen);
  setDisabled(el, true);
  const rec = { gen, watchers: c.rules.map(ruleWatcher), cleanups: [] };
  records.set(el, rec);
  runtimeStats.sheets++;
  rec.cleanups = c.runtime.setup.map((fn) => fn());
  rec.watchers.forEach(watch);
  flush();
}
function drop(el) {
  const rec = records.get(el);
  if (!rec) return;
  records.delete(el);
  rec.watchers.forEach(unwatch);
  rec.cleanups.forEach((fn) => fn());
  rec.gen.remove();
  setDisabled(el, false);
  runtimeStats.sheets--;
}
var sourceObserver;
var sources = {
  selector: 'style:not([data-rcss]), link[rel~="stylesheet" i]:not([rel~="alternate" i])',
  add(el) {
    sourceObserver.observe(el, el instanceof HTMLLinkElement ? { attributes: true, attributeFilter: ["href", "media"] } : { attributes: true, attributeFilter: ["media"], childList: true, characterData: true, subtree: true });
    load(el);
  },
  remove(el) {
    loads.delete(el);
    drop(el);
  }
};
var started = false;
function start() {
  if (started || typeof document === "undefined") return;
  started = true;
  sourceObserver = new MutationObserver((recs) => {
    const changed = /* @__PURE__ */ new Set();
    for (const r of recs) {
      const n = r.target.nodeType === 1 ? r.target : r.target.parentElement;
      const src = n?.closest("style, link");
      if (src) changed.add(src);
    }
    changed.forEach(load);
  });
  watch(sources);
}
function stop() {
  if (!started) return;
  started = false;
  unwatch(sources);
  sourceObserver?.disconnect();
  stopObserving();
}
function refresh2() {
  refreshers.forEach((fn) => fn());
  flush();
}
function stats() {
  return {
    ...runtimeStats,
    scheduled: subscriptionCount(),
    intervals: groupCount(),
    ...counters
  };
}

// src/index.ts
var version = "0.1.0";
export {
  compile,
  defineFunction,
  defineSelector,
  diagnostics,
  refresh2 as refresh,
  start,
  stats,
  stop,
  version
};
//# sourceMappingURL=index.js.map
