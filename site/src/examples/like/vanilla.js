// like.css styles .like[aria-pressed="true"]
const button = document.querySelector('.like');

button.addEventListener('click', () => {
  const liked =
    button.getAttribute('aria-pressed') === 'true';
  button.setAttribute('aria-pressed', String(!liked));
});
