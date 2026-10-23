const counter = document.querySelector('.counter');
const output = counter.querySelector('output');
const chips = [...counter.querySelectorAll('.trail span')];
let count = 0;

function update(delta) {
  count += delta;
  output.textContent = count;
  output.classList.remove('up', 'down');
  void output.offsetWidth; // restart the animation
  output.classList.add(delta > 0 ? 'up' : 'down');
  showTrail();
}

// The strip shows -5 up to the current number.
function showTrail() {
  chips.forEach((chip, i) => {
    chip.hidden = i - 5 > count;
    chip.classList.toggle('current', i - 5 === count);
  });
}

counter
  .querySelector('.plus')
  .addEventListener('click', () => update(1));
counter
  .querySelector('.minus')
  .addEventListener('click', () => update(-1));
showTrail();
