const wizard = document.querySelector('.wizard');
const dots = wizard.querySelectorAll('.dot');
const panels = wizard.querySelectorAll('.panel');
const next = wizard.querySelector('.next');
let step = 1;

function show(n) {
  step = n;
  dots.forEach((d, i) => d.classList.toggle('current', i + 1 === step));
  panels.forEach((p, i) => { p.hidden = i + 1 !== step; });
  next.hidden = step === dots.length;
}

dots.forEach((d, i) => d.addEventListener('click', () => show(i + 1)));
next.addEventListener('click', () => show(step + 1));
show(1);
