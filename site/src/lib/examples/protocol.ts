// The postMessage protocol between a documentation page and a sandboxed preview iframe.
// The iframe side is public/preview/bridge.js. Messages are small, versioned and validated
// on arrival; anything that does not match a known shape is dropped.

export const FROM_PREVIEW = 'rcss-preview';
export const FROM_HOST = 'rcss-host';
export const PROTOCOL_VERSION = 1;

/** What the bridge watches, embedded in the iframe document as JSON. */
export interface WatchSpec {
  /** Custom properties to read with getComputedStyle on every element matching `selector`. */
  props: { name: string; selector: string }[];
  /** on: / bind: rules, so an event can be matched to the source lines that react to it. */
  triggers: { line: number; selector: string; events: string[] }[];
}

export interface Reading {
  name: string;
  /** Index among the elements matching the declaring selector. */
  owner: number;
  /** For example `div.item 2`. */
  ownerLabel: string;
  /** Computed value, exactly as getComputedStyle returns it. */
  value: string;
}

export type PreviewMessage =
  | { type: 'ready'; readings: Reading[]; diagnostics: string[] }
  | { type: 'values'; readings: Reading[]; cause: number | null }
  | { type: 'event'; id: number; event: string; target: string; key: string | null; triggers: number[] }
  | { type: 'submit'; method: string; action: string; fields: [string, string][]; omitted: string[] }
  | { type: 'invalid'; field: string; reason: string }
  | { type: 'diagnostics'; messages: string[] }
  /** Height of the preview's content in px, for frames that size to their content. */
  | { type: 'size'; height: number };

export type HostMessage = { type: 'highlight'; selectors: string[] };

const isStr = (v: unknown): v is string => typeof v === 'string' && v.length < 4000;
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isArr = <T>(v: unknown, item: (x: unknown) => x is T, max = 500): v is T[] => Array.isArray(v) && v.length <= max && v.every(item);
const isReading = (r: unknown): r is Reading => {
  const o = r as Reading;
  return !!o && isStr(o.name) && isNum(o.owner) && isStr(o.ownerLabel) && isStr(o.value);
};
const isPair = (p: unknown): p is [string, string] => Array.isArray(p) && p.length === 2 && isStr(p[0]) && isStr(p[1]);

/**
 * persist() in a preview: the frame is sandboxed without allow-same-origin, so storage always
 * throws. The runtime reports it (as code RCSS-K001 from the production bundle, as text from the
 * development one); readers get the decoded message and why it happens here.
 */
export const explainSandbox = (msg: string) => msg.replace(
  /RCSS-K001⟦([^⟧]*)⟧⟦([^⟧]*)⟧⟦([^⟧]*)⟧|persist\("([^"]*)"\): (\w+) is not available \((\w+)\); the state is not persisted\./,
  (_, k1, s1, e1, k2, s2, e2) => `persist("${k1 ?? k2}"): ${s1 ?? s2} is not available (${e1 ?? e2}). Expected in this preview: it runs in a sandboxed frame with no storage, so the state works but is not kept after a reload. On a normal page it is saved.`,
);

/** Returns the message if it is a well-formed preview message, otherwise null. */
export function parsePreviewMessage(data: unknown): PreviewMessage | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (d.source !== FROM_PREVIEW || d.v !== PROTOCOL_VERSION) return null;
  switch (d.type) {
    case 'ready':
      return isArr(d.readings, isReading) && isArr(d.diagnostics, isStr) ? { type: 'ready', readings: d.readings, diagnostics: d.diagnostics.map(explainSandbox) } : null;
    case 'values':
      return isArr(d.readings, isReading) && (d.cause === null || isNum(d.cause)) ? { type: 'values', readings: d.readings, cause: d.cause as number | null } : null;
    case 'event':
      return isNum(d.id) && isStr(d.event) && isStr(d.target) && (d.key === null || isStr(d.key)) && isArr(d.triggers, isNum)
        ? { type: 'event', id: d.id, event: d.event, target: d.target, key: d.key as string | null, triggers: d.triggers } : null;
    case 'submit':
      return isStr(d.method) && isStr(d.action) && isArr(d.fields, isPair) && isArr(d.omitted, isStr)
        ? { type: 'submit', method: d.method, action: d.action, fields: d.fields, omitted: d.omitted } : null;
    case 'invalid':
      return isStr(d.field) && isStr(d.reason) ? { type: 'invalid', field: d.field, reason: d.reason } : null;
    case 'size':
      return isNum(d.height) && d.height >= 0 && d.height < 20000 ? { type: 'size', height: d.height } : null;
    case 'diagnostics':
      return isArr(d.messages, isStr) ? { type: 'diagnostics', messages: d.messages.map(explainSandbox) } : null;
    default:
      return null;
  }
}
