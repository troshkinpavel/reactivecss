for (const f of document.querySelectorAll('.f')) {
  const o = f.querySelector('.o');
  f.querySelector('.q').addEventListener('input', (e) => { o.textContent = e.target.value; });
}
