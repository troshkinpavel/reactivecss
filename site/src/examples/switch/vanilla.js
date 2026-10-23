// switch.css styles .switch[aria-checked="true"]
const el = document.querySelector('.switch');

el.addEventListener('click', () => {
  const on = el.getAttribute('aria-checked') !== 'true';
  el.setAttribute('aria-checked', String(on));
});
