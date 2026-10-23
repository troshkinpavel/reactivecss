const message = document.querySelector('.message');
const words = ['Hello!', 'Bonjour!', 'Hola!', 'Ciao!'];

document.querySelector('.shuffle').addEventListener('click', () => {
  const i = Math.floor(Math.random() * words.length);
  message.textContent = words[i];
});
