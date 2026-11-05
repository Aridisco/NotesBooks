// Keyboard support for clickable divs (role="button"): Enter or Space does what a click does.
document.addEventListener('keydown', e => {
  const el = e.target;
  if (!el.matches || !el.matches('[role="button"][tabindex]')) return;
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    el.click();
  }
});
