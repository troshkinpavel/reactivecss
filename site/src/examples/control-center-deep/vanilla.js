// ── Elements ────────────────────────────────
const root = document.querySelector('.control-center');
const $ = (selector) => root.querySelector(selector);

const notifySwitch = $('.notify-switch');
const densityButton = $('.density-button');
const digest = $('.digest');
const output = $('.goal output');
const minus = $('.goal .minus');
const plus = $('.goal .plus');

// ── Appearance ──────────────────────────────
// Theme and accent buttons carry data-set="theme:dark".
root.addEventListener('click', (event) => {
  const option = event.target.closest('[data-set]');
  if (!option) return;
  const [key, value] = option.dataset.set.split(':');
  root.dataset[key] = value;
  root.querySelectorAll('[data-set^="' + key + ':"]').forEach((b) => {
    b.setAttribute('aria-pressed', String(b === option));
  });
});

densityButton.addEventListener('click', () => {
  const compact = root.dataset.density !== 'compact';
  root.dataset.density = compact ? 'compact' : 'comfortable';
  densityButton.textContent = compact ? 'Compact' : 'Comfortable';
});

// ── Notifications ───────────────────────────
notifySwitch.addEventListener('click', () => {
  const on = notifySwitch.getAttribute('aria-checked') !== 'true';
  notifySwitch.setAttribute('aria-checked', String(on));
  root.dataset.notify = String(on);
  $('.status').textContent = on ? 'On' : 'Muted';
  digest.disabled = !on;
});

digest.addEventListener('change', (event) => {
  $('.preview .schedule').textContent = event.target.value;
});

// ── Profile ─────────────────────────────────
$('.profile input[type="text"]').addEventListener('input', (event) => {
  $('.preview .name').textContent = event.target.value;
});

$('.profile input[type="checkbox"]').addEventListener('change', (event) => {
  root.dataset.round = String(event.target.checked);
});

// ── Focus goal and history ──────────────────
let goal = 4;

function setGoal(next) {
  const up = next > goal;
  $('.goal .history').textContent =
    (up ? '↑ up' : '↓ down') + ' was ' + goal;
  goal = next;
  output.textContent = goal;
  root.style.setProperty('--goal', goal);
  minus.disabled = goal <= 1;
  plus.disabled = goal >= 10;
  output.classList.remove('rise', 'fall');
  void output.offsetWidth; // restart the animation
  output.classList.add(up ? 'rise' : 'fall');
}

plus.addEventListener('click', () => setGoal(goal + 1));
minus.addEventListener('click', () => setGoal(goal - 1));
