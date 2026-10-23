const pad = document.querySelector('.pad');

pad.addEventListener('pointermove', (e) => {
  const r = pad.getBoundingClientRect();
  pad.style.setProperty('--x', e.clientX - r.left + 'px');
  pad.style.setProperty('--y', e.clientY - r.top + 'px');
});
