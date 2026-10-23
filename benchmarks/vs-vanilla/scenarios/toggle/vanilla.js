for (const t of document.querySelectorAll('.t'))
  t.addEventListener('click', () => t.setAttribute('aria-pressed', t.getAttribute('aria-pressed') === 'true' ? 'false' : 'true'));
