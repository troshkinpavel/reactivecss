const menu = document.querySelector('.menu');
const button = menu.querySelector('button');

function setOpen(open) {
  button.setAttribute('aria-expanded', String(open));
}

button.addEventListener('click', () => {
  const open = button.getAttribute('aria-expanded');
  setOpen(open !== 'true');
});

document.addEventListener('click', (e) => {
  if (!menu.contains(e.target)) setOpen(false);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') setOpen(false);
});
