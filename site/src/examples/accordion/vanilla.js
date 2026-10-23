const buttons = document.querySelectorAll(
  '.item > button'
);

buttons.forEach((button) => {
  button.addEventListener('click', () => {
    const open =
      button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', String(!open));
    button.nextElementSibling.hidden = open;
  });
});
