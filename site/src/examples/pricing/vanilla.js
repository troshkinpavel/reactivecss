const billing = document.querySelector('.billing');
const toggle = billing.querySelector('[role="switch"]');
const price = billing.querySelector('.price');
const saving = billing.querySelector('.saving');

toggle.addEventListener('click', () => {
  const annual =
    toggle.getAttribute('aria-checked') !== 'true';
  toggle.setAttribute('aria-checked', String(annual));
  price.textContent = annual
    ? '$96 / year'
    : '$10 / month';
  saving.hidden = !annual;
});
