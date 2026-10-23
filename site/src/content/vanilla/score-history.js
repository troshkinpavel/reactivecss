// Score history in plain JavaScript: the same markup and behavior as the library's
// examples/score-history demo, with ordinary DOM APIs. Runs without Reactive CSS.
for (const board of document.querySelectorAll('.score')) {
  const $ = (s) => board.querySelector(s);
  const current = $('.current'), reset = $('.reset');
  let points = 0;

  board.dataset.direction = 'none';
  reset.disabled = true;
  $('.history').hidden = true;

  function set(value) {
    if (value === points) return; // an unchanged value is not a change
    const prev = points;
    points = value;
    const up = points > prev;
    current.textContent = points;
    $('.prev').textContent = prev;
    $('.delta').textContent = points - prev;
    $('.history').hidden = false;
    $('.nochange').hidden = true;
    $('.direction').textContent = up ? '▲ up' : '▼ down';
    board.dataset.direction = up ? 'up' : 'down';
    reset.disabled = points === 0;
    // Restart the keyframes on every change, also for repeated changes in one direction.
    current.classList.remove('bump', 'dip');
    void current.offsetWidth;
    current.classList.add(up ? 'bump' : 'dip');
  }

  $('.up').addEventListener('click', () => set(points + 1));
  $('.down').addEventListener('click', () => set(points - 1));
  reset.addEventListener('click', () => set(0));
}
