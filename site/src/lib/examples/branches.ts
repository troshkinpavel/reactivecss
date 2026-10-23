// Which branch of a single-line when() does not apply, given observed state values.
// Only the simple forms are handled: when(--x, a, b) on a boolean and when(--x == kw, a, b).
// Anything else is left alone rather than guessed.

const WHEN = /when\((--[\w-]+)(?:\s*==\s*([\w-]+))?,\s*((?:"[^"]*"|[^,"()])+?),\s*((?:"[^"]*"|[^)"(])+?)\)/;

export function inactiveBranches(cssLines: string[], values: Map<string, string>): [number, string][] {
  const out: [number, string][] = [];
  cssLines.forEach((line, i) => {
    const m = WHEN.exec(line);
    if (!m) return;
    const v = values.get(m[1]!);
    if (v === undefined) return;
    let yes: boolean;
    if (m[2] !== undefined) yes = v.toLowerCase() === m[2].toLowerCase();
    else if (v === 'true' || v === 'false') yes = v === 'true';
    else return;
    out.push([i, (yes ? m[4]! : m[3]!).trim()]);
  });
  return out;
}
