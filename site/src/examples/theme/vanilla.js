const themes = ['light', 'dark', 'sepia'];
const root = document.documentElement;
const button = document.querySelector('.theme-button');

button.addEventListener('click', () => {
  const current = root.dataset.theme || 'light';
  const next = themes.indexOf(current) + 1;
  root.dataset.theme = themes[next % themes.length];
});
