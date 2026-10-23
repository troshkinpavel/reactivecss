// ── Profile ─────────────────────────────────
// CSS can't print what someone types, so the name is copied by hand.
const form = document.querySelector('form.control-center');
const nameInput = form.elements.displayName;
const nameOutput = form.querySelector('.preview .name');

const showName = () => {
  nameOutput.textContent = nameInput.value;
};

nameInput.addEventListener('input', showName);

// ── Reset ───────────────────────────────────
// Controls change after the reset event, so read them a task later.
form.addEventListener('reset', () => setTimeout(showName));
