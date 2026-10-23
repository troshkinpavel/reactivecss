const reader = document.querySelector('.reader');
const text = reader.querySelector('p');
const sizes = { s: '14px', m: '16px', l: '20px' };
const buttons = Object.keys(sizes).map((cls) => reader.querySelector('.' + cls));

// .current is styled like the selected button in the CSS version.
function select(cls) {
  text.style.fontSize = sizes[cls];
  for (const b of buttons) b.classList.toggle('current', b.classList.contains(cls));
}

for (const cls of Object.keys(sizes)) {
  reader.querySelector('.' + cls).addEventListener('click', () => select(cls));
}
select('m');
