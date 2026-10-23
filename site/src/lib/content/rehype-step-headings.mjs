// `## [1] Add the library` → <h2 data-step="1"><span class="step">1</span> Add the library</h2>.
// Runs before Astro assigns heading ids, so the id and the TOC entry include the number.
export function rehypeStepHeadings() {
  return (tree) => {
    const visit = (node) => {
      if (node.type === 'element' && (node.tagName === 'h2' || node.tagName === 'h3')) {
        const first = node.children[0];
        const m = first && first.type === 'text' && /^\[(\d+)\]\s+/.exec(first.value);
        if (m) {
          first.value = first.value.slice(m[0].length);
          node.properties = { ...node.properties, dataStep: m[1] };
          node.children.unshift({ type: 'element', tagName: 'span', properties: { className: ['step'] }, children: [{ type: 'text', value: m[1] }] }, { type: 'text', value: ' ' });
        }
      }
      if (node.children) node.children.forEach(visit);
    };
    visit(tree);
  };
}
