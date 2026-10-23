const form = document.querySelector('.signup');
const preview = form.querySelector('.preview');
const nameText = preview.querySelector('.name');
const badge = preview.querySelector('.badge');

form.addEventListener('input', () => {
  const data = new FormData(form);
  nameText.textContent = data.get('name');
  badge.hidden = !data.has('news');
});
