const die = document.querySelector('.die');
const greet = document.querySelector('.greet');
const words = ['Hello', 'Hi', 'Hey'];
const roll = () => 1 + Math.floor(Math.random() * 6);

die.textContent = roll();
die.addEventListener('click', () => {
  die.textContent = roll();
});

greet.addEventListener('click', () => {
  const i = Math.floor(Math.random() * words.length);
  greet.textContent = words[i];
});
