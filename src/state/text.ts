// text: <value> (experimental, 0.5.1): writes a reactive scalar into the element's own DOM text.
//
// - The declaration is compiled to `--rcss-text: <value>` in the same rule (a registered,
//   non-inherited property), so the browser's cascade picks the winning text: declaration:
//   specificity, order, layers, media, :when(), !important. Reactive functions in the value
//   (previous(), direction(), when()) are bindings like anywhere else.
// - The computed value must be one string, number or keyword. It is written with the Text
//   node API (`data`), never parsed as HTML.
// - Ownership: only an element that is empty or holds exactly one text node. Its text node is
//   reused (or one is created) and restored when no text: declaration applies any more. If
//   anything else changes that text or adds children, the binding yields: it stops writing and
//   does not restore. Elements with child elements are never touched (diagnostic).
// - Updates: read in the late phase of the frame flush (after this frame's writes) when a state
//   changes inside an ancestor-or-self owner, when the element starts or stops matching a text:
//   rule, and on ReactiveCSS.refresh(). Other cascade changes (a class that changes which rule
//   wins, media queries) are picked up on the next of these.

import { late, type Job } from '../core/scheduler';
import { warn, dev, probes } from '../core/log';
import { runtimeStats, refreshers, sheetChangeHooks, runtimes } from '../core/registry';
import { hasReactiveSyntax } from '../core/parser';
import type { Watcher } from '../core/elements';
import { stateChangeHooks, describeElement, within } from './state';
import { textOf } from './textof';
export { textOf };

const PROP = '--rcss-text';
let registered = false;
const bindings = new Map<Element, TextBinding>();
if (dev) probes.textBindings = () => bindings.size;

class TextBinding implements Job {
  queued?: boolean;
  rules = 0;
  private node?: Text;
  private created = false;
  private original = '';
  /** What we last wrote; undefined while the original content is shown. */
  private written?: string;
  private next: string | null = null;
  /** Gave up ownership: the content was not ours to change, or someone else changed it. */
  private yielded = false;

  constructor(readonly el: Element) {
    const kids = el.childNodes;
    if (!(kids.length === 0 || (kids.length === 1 && kids[0].nodeType === Node.TEXT_NODE))) {
      this.yielded = true;
      warn(`text: on ${describeElement(this.el)} is ignored: the element has other content (child elements or several nodes). Put the text in its own element, e.g. <span class="label"></span>, and target that.`);
    }
  }

  compute() {
    if (this.yielded || !this.el.isConnected) return false;
    const v = textOf(getComputedStyle(this.el).getPropertyValue(PROP));
    if (v === undefined) {
      if (hasReactiveSyntax(getComputedStyle(this.el).getPropertyValue(PROP))) return false; // another sheet is not compiled yet: read again after it
      warn(`text: on ${describeElement(this.el)} needs one value (a string, a number or a keyword); "${getComputedStyle(this.el).getPropertyValue(PROP).trim().slice(0, 60)}" is not shown.`);
      return false;
    }
    this.next = v;
    return v !== (this.written ?? null);
  }

  /** Someone else changed the text or the children since our last write. */
  private foreign() {
    if (this.written === undefined) return false;
    return this.node!.parentNode !== this.el || this.el.childNodes.length !== 1 || this.node!.data !== this.written;
  }

  write() {
    if (this.yielded) return;
    if (this.foreign()) { this.yield(); return; }
    if (this.next === null) { this.restore(); return; }
    if (this.written === undefined) {
      const first = this.el.firstChild as Text | null;
      if (first && (first.nodeType !== Node.TEXT_NODE || this.el.childNodes.length > 1)) { this.yield(); return; }
      this.created = !first;
      this.node = first ?? document.createTextNode('');
      this.original = first ? first.data : '';
      if (this.created) this.el.append(this.node);
    }
    this.node!.data = this.next; // a Text node: never parsed as HTML
    this.written = this.next;
  }

  private yield() {
    this.yielded = true;
    warn(`text: on ${describeElement(this.el)} stopped: its text or children were changed by something else, which now owns them.`);
  }

  /** Back to the original content (unless someone else took the text over). */
  restore() {
    if (this.written === undefined || this.yielded || this.foreign()) return;
    if (this.created) this.node!.remove();
    else this.node!.data = this.original;
    this.written = undefined;
    this.node = undefined;
  }

  dispose() {
    this.restore();
    this.yielded = true; // a queued job does nothing after this
  }
}

function register() {
  if (registered) return;
  registered = true;
  // Not inherited: a text: rule on a parent must not reach a child's binding.
  try { CSS.registerProperty({ name: PROP, syntax: '*', inherits: false }); } catch (e) {
    if (!(e instanceof DOMException && e.name === 'InvalidModificationError'))
      warn('text: needs CSS.registerProperty() (Chrome 78+, Safari 16.4+, Firefox 128+); a text: rule on an element would also apply to its descendants.');
  }
  stateChangeHooks.add((c) => within(bindings, c.owner, (b) => late(b)));
  refreshers.add(() => bindings.forEach((b) => late(b)));
  sheetChangeHooks.add(() => bindings.forEach((b) => late(b)));
}

/** Watcher for a rule with `text:`: every matching element gets (a share of) one TextBinding. */
export function textWatcher(match: string): Watcher {
  register();
  return {
    selector: match,
    add(el) {
      let b = bindings.get(el);
      if (!b) { bindings.set(el, (b = new TextBinding(el))); runtimeStats.bindings++; }
      b.rules++;
      late(b);
    },
    remove(el) {
      const b = bindings.get(el);
      if (!b || --b.rules) { if (b) late(b); return; }
      bindings.delete(el);
      runtimeStats.bindings--;
      b.dispose();
    },
  };
}

// Feature runtime (src/features): the parser and the engine find it here.
runtimes.text = textWatcher;
