// Modal choice dialog built on <dialog> (focus trap, Esc handling and screen-reader role come free).
// Resolves with the `value` of the chosen button. Esc is blocked: the caller needs an answer.
export function askChoice(title, text, choices) {
  return new Promise(resolve => {
    const d = document.createElement('dialog');
    d.className = 'choice';
    d.setAttribute('aria-labelledby', 'choice-title');
    const h = document.createElement('h3');
    h.id = 'choice-title';
    h.textContent = title;
    const p = document.createElement('p');
    p.textContent = text;
    const row = document.createElement('div');
    row.className = 'row';
    choices.forEach(c => {
      const b = document.createElement('button');
      b.className = 'b';
      b.textContent = c.label;
      b.onclick = () => d.close(c.value);
      row.append(b);
    });
    d.append(h, p, row);
    d.addEventListener('cancel', e => e.preventDefault());
    d.addEventListener('close', () => {
      d.remove();
      resolve(d.returnValue);
    });
    document.body.append(d);
    d.showModal();
  });
}
