// Fenced code in MDX becomes <CodeBlock lang label code />, so every code block on the site
// goes through the same highlighter and component. ```css like.css → lang "css", label "like.css".
export function remarkCodeBlocks() {
  return (tree) => {
    const visit = (node, index, parent) => {
      if (node.type === 'code' && parent) {
        const attrs = [['lang', node.lang || 'txt'], ['code', node.value]];
        if (node.meta) attrs.push(['label', node.meta.trim()]);
        parent.children[index] = {
          type: 'mdxJsxFlowElement',
          name: 'CodeBlock',
          attributes: attrs.map(([name, value]) => ({ type: 'mdxJsxAttribute', name, value })),
          children: [],
        };
        return;
      }
      if (node.children) node.children.forEach((c, i) => visit(c, i, node));
    };
    visit(tree);
  };
}
