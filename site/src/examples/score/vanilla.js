const score = document.querySelector('.score');
const value = score.querySelector('.value');
const before = score.querySelector('.before');
const trend = score.querySelector('.trend');
let current = 10;

function change(delta) {
  before.textContent = current;
  current += delta;
  value.textContent = current;
  trend.textContent = delta > 0 ? '▲ up' : '▼ down';
  value.classList.remove('nudge');
  void value.offsetWidth; // restart the animation
  value.classList.add('nudge');
}

score.querySelector('.up').addEventListener('click', () => change(1));
score.querySelector('.down').addEventListener('click', () => change(-1));
