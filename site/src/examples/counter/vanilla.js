const counter = document.querySelector('.counter');
const output = counter.querySelector('output');
const plus = counter.querySelector('.plus');
const minus = counter.querySelector('.minus');
let count = 0;

plus.addEventListener('click', () => {
  output.textContent = ++count;
});

minus.addEventListener('click', () => {
  output.textContent = --count;
});
