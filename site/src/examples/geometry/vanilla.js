const wrap = document.querySelector('.geo-wrap');
const card = wrap.querySelector('.geo');
let size = 320;

const observer = new ResizeObserver(([entry]) => {
  const width = entry.borderBoxSize[0].inlineSize;
  card.style.setProperty('--w', width + 'px');
});
observer.observe(card);

function resize(delta) {
  size += delta;
  card.style.width = size + 'px';
}

wrap
  .querySelector('.narrower')
  .addEventListener('click', () => resize(-40));
wrap
  .querySelector('.wider')
  .addEventListener('click', () => resize(40));
