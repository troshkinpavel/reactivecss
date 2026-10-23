const inputs = document.querySelectorAll('.task input');

inputs.forEach((input) => {
  input.addEventListener('change', () => {
    const label = input.nextElementSibling;
    label.classList.remove('pop', 'settle');
    void label.offsetWidth; // restart the animation
    label.classList.add(input.checked ? 'pop' : 'settle');
  });
});
