const spotlight = document.querySelector('.spotlight');

spotlight.addEventListener('pointermove', (e) => {
  const r = spotlight.getBoundingClientRect();
  spotlight.style.setProperty('--x', e.clientX - r.left + 'px');
  spotlight.style.setProperty('--y', e.clientY - r.top + 'px');
});
