const like = document.querySelector('.like');
const count = like.querySelector('.count');
let liked = false;

like.querySelector('button').addEventListener('click', () => {
  liked = !liked;
  like.classList.toggle('liked', liked);
  count.textContent = `${41 + liked} likes`;
});
