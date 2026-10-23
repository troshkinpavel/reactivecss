const input = document.querySelector('.profile input');
const nameText = document.querySelector('.card .name');

const show = () => {
  nameText.textContent = input.value || 'Your name';
  nameText.classList.toggle('placeholder', !input.value);
};

input.addEventListener('input', show);
show();
