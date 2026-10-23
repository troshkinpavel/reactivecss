// Converts the Claude Design documentation data (design-source/docs-content-*.js) into
// MDX pages (src/content/docs/) and API reference entries (src/content/api/entries.json).
// Run once per design import: `node scripts/convert-design-content.mjs`. It overwrites the
// generated files, so make content edits in the MDX after the import, not in the design data.
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
// The output has been edited since the import (0.5.0 updates). Re-importing replaces it.
if (!process.argv.includes('--force')) {
  console.error('This replaces generated content that has been edited since. Re-run with --force to overwrite.');
  process.exit(1);
}
const ctx = { window: {} };
vm.createContext(ctx);
for (const f of ['docs-content-1', 'docs-content-1b', 'docs-content-1c', 'docs-content-2', 'docs-content-2b', 'docs-content-3', 'docs-content-4']) {
  vm.runInContext(await readFile(new URL(`design-source/${f}.js`, root), 'utf8'), ctx);
}
const D = ctx.window.RCSS_DOCS;

const PAGE_ORDER = ['introduction', 'getting-started', 'installation', 'core-concepts', 'reactive-values', 'state', 'events', 'conditions', 'selectors', 'binding', 'simplify-css', 'history', 'geometry', 'api', 'examples', 'ex-toggle', 'ex-counter', 'ex-accordion', 'ex-tabs', 'ex-form', 'ex-theme', 'ex-dropdown', 'ex-history', 'ex-pointer', 'ex-geometry', 'ex-wave', 'ex-advanced', 'compat', 'limitations', 'troubleshooting', 'changelog'];

/** Design id → content id (also the URL path under /docs/). */
export const slugOf = (id) =>
  id === 'api' ? 'reference' : id.startsWith('api-') ? 'reference/' + id.slice(4)
  : id === 'examples' ? 'examples' : id.startsWith('ex-') ? 'examples/' + id.slice(3) : id;
const hrefOf = (h) => {
  if (!h.startsWith('#')) return h;
  const [page, section] = h.slice(1).split('--');
  return `/docs/${slugOf(page)}/` + (section ? '#' + section : '');
};


/** «code», [text](#link), **bold** → Markdown. Escapes MDX-significant characters in prose. */
function inline(s) {
  const out = [];
  const re = /\[([^\]]+)\]\(([^)]+)\)|«([^»]+)»|\*\*([^*]+)\*\*/g;
  let last = 0, m;
  const prose = (t) => t.replace(/[{}<>]/g, (c) => '\\' + c);
  const code = (t) => (t.includes('`') ? '`` ' + t + ' ``' : '`' + t + '`');
  while ((m = re.exec(s))) {
    out.push(prose(s.slice(last, m.index)));
    if (m[1] !== undefined) {
      const label = m[1].startsWith('«') ? code(m[1].replace(/[«»]/g, '')) : prose(m[1]);
      out.push(`[${label}](${hrefOf(m[2])})`);
    } else if (m[3] !== undefined) out.push(code(m[3]));
    else out.push(`**${prose(m[4])}**`);
    last = re.lastIndex;
  }
  out.push(prose(s.slice(last)));
  return out.join('');
}
const attr = (s) => s.replace(/"/g, '&quot;');

function body(md) {
  const L = md.split('\n'), out = [];
  let i = 0;
  while (i < L.length) {
    const raw = L[i], t = raw.trim();
    let m;
    if (!t) { out.push(''); i++; continue; }
    if ((m = t.match(/^(#{2,3}) (.*)$/))) { out.push(`${m[1]} ${inline(m[2])}`); i++; continue; }
    if (t.startsWith('~~~')) {
      const [lang, label] = t.slice(3).split(/\s+/);
      const code = [];
      i++;
      while (i < L.length && !L[i].trim().startsWith('~~~')) code.push(L[i++]);
      i++;
      out.push('```' + lang + (label ? ' ' + label : ''), ...code, '```');
      continue;
    }
    if (t === '::pair') {
      out.push('<CodePair>', '');
      i++;
      let n = 0;
      while (i < L.length && n < 2) {
        const tt = L[i].trim();
        if (tt.startsWith('~~~')) {
          const [lang, label] = tt.slice(3).split(/\s+/);
          const code = [];
          i++;
          while (i < L.length && !L[i].trim().startsWith('~~~')) code.push(L[i++]);
          i++;
          out.push('```' + lang + (label ? ' ' + label : ''), ...code, '```', '');
          n++;
        } else i++;
      }
      out.push('</CodePair>');
      continue;
    }
    if ((m = t.match(/^::cmp (\S+)/))) { out.push(`<Compare id="${m[1]}" />`); i++; continue; }
    if ((m = t.match(/^::ex (\S+)(?: (compact|standard|expanded))?( controls)?/))) {
      out.push(`<Example id="${m[1]}"${m[2] && m[2] !== 'standard' ? ` size="${m[2]}"` : ''}${m[3] ? ' controls' : ''} />`);
      i++;
      continue;
    }
    if ((m = t.match(/^::(facts|flow) (.*)$/))) {
      const items = m[2].split(/;\s*/).map((x) => { const k = x.indexOf('='); return [x.slice(0, k), x.slice(k + 1)]; });
      const [wrap, item, key] = m[1] === 'facts' ? ['Facts', 'Fact', 'label'] : ['Flow', 'FlowStep', 'title'];
      out.push(`<${wrap}>`, ...items.map(([k, v]) => `  <${item} ${key}="${attr(k)}">${inline(v)}</${item}>`), `</${wrap}>`);
      i++;
      continue;
    }
    if (t === '::cards') {
      i++;
      out.push('<Cards>');
      while (i < L.length && L[i].trim().startsWith('[')) {
        const mm = L[i].trim().match(/^\[([^\]]+)\]\(([^)]+)\)\s*(.*)$/);
        if (mm) out.push(`  <Card href="${hrefOf(mm[2])}" title="${attr(mm[1])}">${inline(mm[3])}</Card>`);
        i++;
      }
      out.push('</Cards>');
      continue;
    }
    if ((m = t.match(/^::related (.*)$/))) { out.push(`<Related ids={${JSON.stringify(m[1].split(/,\s*/).map(slugOf))}} />`); i++; continue; }
    if (t === '::index') { out.push('<ApiIndex />'); i++; continue; }
    if (t === '::examples') { out.push('<ExampleIndex />'); i++; continue; }
    if (t === '::advanced') { out.push('<AdvancedIndex />'); i++; continue; }
    if ((m = t.match(/^!(note|tip|caution|warning|provisional|experimental|outcome)\s+(?:([^:«»]{1,40}):\s)?(.*)$/))) {
      out.push(`<Callout kind="${m[1]}"${m[2] ? ` title="${attr(m[2])}"` : ''}>`, '', inline(m[3]), '', '</Callout>');
      i++;
      continue;
    }
    if (t.startsWith('|')) {
      const rows = [];
      while (i < L.length && L[i].trim().startsWith('|')) rows.push(L[i++].trim().replace(/^\||\|$/g, '').split('|').map((c) => inline(c.trim())));
      const n = rows[0].length;
      out.push('| ' + rows[0].join(' | ') + ' |', '|' + ' --- |'.repeat(n), ...rows.slice(1).map((r) => '| ' + r.concat(Array(n - r.length).fill('')).join(' | ') + ' |'));
      continue;
    }
    if (/^(- |\d+\. )/.test(t)) { out.push(t.replace(/^(- |\d+\. )(.*)$/, (_, mark, rest) => mark + inline(rest))); i++; continue; }
    out.push(inline(t));
    i++;
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

const yaml = (v) => JSON.stringify(v);
await rm(new URL('src/content/docs/', root), { recursive: true, force: true });
for (const p of D.pages) {
  const slug = slugOf(p.id);
  const file = new URL(`src/content/docs/${slug}.mdx`, root);
  await mkdir(new URL('./', file), { recursive: true });
  const fm = [
    '---',
    `title: ${yaml(p.title)}`,
    `description: ${yaml(inline(p.summary).replace(/\\([{}<>])/g, '$1'))}`,
    `group: ${p.group}`,
    `type: ${p.type}`,
    `order: ${PAGE_ORDER.indexOf(p.id)}`,
    ...(p.status ? [`status: ${p.status === 'exp' ? 'experimental' : p.status}`] : []),
    ...(p.uses ? [`uses: ${yaml(p.uses.map(slugOf))}`] : []),
    '---',
    '',
  ];
  await writeFile(file, fm.join('\n') + body(p.md));
}

const FEATURE_KIND = { Function: 'function', Action: 'action', Selector: 'selector', Declaration: 'declaration', Trigger: 'trigger', Scope: 'scope' };
const TRIGGERS = ['click', 'change', 'input', 'pointerenter', 'pointerleave', 'focus', 'blur'];
const md = (s) => inline(s).replace(/\\([{}<>])/g, '$1');
const entries = D.apis.map((a) => {
  const name = a.name.replace(/\(\)$/, '').replace(/:$/, '').replace(/^:/, '');
  const features = a.id === 'api-triggers' ? TRIGGERS.map((t) => 'trigger:' + t) : [`${FEATURE_KIND[a.kind]}:${name}`];
  return {
    id: a.id.slice(4),
    name: a.name,
    category: a.cat,
    features,
    summary: md(a.summary),
    signature: a.sig,
    params: a.params.map(([pname, type, req, desc]) => ({ name: pname, type: md(type), required: req, description: md(desc) })),
    returns: md(a.returns),
    example: a.ex ? { id: a.ex, size: a.exSize || 'standard' } : { label: a.code[0], code: a.code[1] },
    behavior: a.behavior.map(md),
    contexts: a.contexts.map(md),
    limits: a.limits.map(md),
    related: a.related.map(slugOf),
  };
});
await mkdir(new URL('src/content/api/', root), { recursive: true });
await writeFile(new URL('src/content/api/entries.json', root), JSON.stringify(entries, null, 2) + '\n');
console.log(`wrote ${D.pages.length} pages and ${entries.length} API entries`);
