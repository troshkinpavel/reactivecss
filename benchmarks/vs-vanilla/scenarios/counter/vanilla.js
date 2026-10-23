for (const c of document.querySelectorAll('.c')) {
  const v = c.querySelector('.v');
  let n = 0;
  c.querySelector('.inc').addEventListener('click', () => { v.textContent = ++n; });
}
