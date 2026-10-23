const tabs = document.querySelectorAll('[role="tab"]');
const panels = document.querySelectorAll(
  '[role="tabpanel"]'
);

tabs.forEach((tab, i) => {
  tab.addEventListener('click', () => {
    tabs.forEach((t, j) => {
      t.setAttribute('aria-selected', String(i === j));
    });
    panels.forEach((p, j) => {
      p.hidden = i !== j;
    });
  });
});
