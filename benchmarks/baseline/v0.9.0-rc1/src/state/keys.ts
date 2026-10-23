// Key specs for key(): "Escape", "ArrowRight", "ctrl+k", "shift+Tab", "Space". Pure.

export interface KeySpec { key: string; ctrl: boolean; shift: boolean; alt: boolean; meta: boolean; printable: boolean }

const ALIASES: Record<string, string> = { space: ' ', esc: 'escape', spacebar: ' ', del: 'delete', up: 'arrowup', down: 'arrowdown', left: 'arrowleft', right: 'arrowright' };

export function parseKey(text: string): KeySpec {
  const parts = text.trim().split('+').map((p) => p.trim());
  let key = parts.pop()!.toLowerCase();
  if (!key) throw new Error(`"${text}" is not a key; write for example Escape, ArrowRight or ctrl+k`);
  key = ALIASES[key] ?? key;
  const spec: KeySpec = { key, ctrl: false, shift: false, alt: false, meta: false, printable: [...key].length === 1 };
  for (const m of parts) {
    const k = m.toLowerCase() as 'ctrl' | 'shift' | 'alt' | 'meta';
    if (!['ctrl', 'shift', 'alt', 'meta'].includes(k)) throw new Error(`unknown modifier "${m}" in "${text}" (use ctrl, shift, alt, meta)`);
    spec[k] = true;
  }
  return spec;
}

/** Exact modifiers; shift is only required to be absent for non-printable keys (it changes printable ones). */
export function keyMatches(spec: KeySpec, e: KeyboardEvent): boolean {
  if (e.key.toLowerCase() !== spec.key) return false;
  if (e.ctrlKey !== spec.ctrl || e.altKey !== spec.alt || e.metaKey !== spec.meta) return false;
  return spec.printable ? !spec.shift || e.shiftKey : e.shiftKey === spec.shift;
}
