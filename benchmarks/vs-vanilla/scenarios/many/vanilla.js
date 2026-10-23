// One delegated listener for every counter (the efficient way to handle 1,000 elements).
document.addEventListener('click', (e) => {
  const b = e.target.closest('.inc');
  if (!b) return;
  const v = b.nextElementSibling;
  v.textContent = +v.textContent + 1;
});
