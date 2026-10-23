const cart = document
  .querySelector('.cart');
let items = 1;

const add = cart.querySelector('.add');

add.addEventListener('click', () => {
  items++;
  cart.classList.toggle(
    'free-shipping',
    items >= 3
  );
});
