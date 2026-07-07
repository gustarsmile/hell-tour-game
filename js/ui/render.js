export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

export function renderNode(node, handlers, root) {
  root.innerHTML = '';
  const box = el('div', 'scene-box');
  if (node.speaker) box.appendChild(el('div', 'speaker', node.speaker));
  box.appendChild(el('p', 'text', node.text));
  if (node.type === 'line') {
    const btn = el('button', 'btn btn-next', '繼續 ▸');
    btn.addEventListener('click', handlers.onAdvance);
    box.appendChild(btn);
  } else if (node.type === 'choice') {
    const list = el('div', 'choices');
    node.choices.forEach((c, i) => {
      const btn = el('button', 'btn btn-choice', c.text);
      btn.addEventListener('click', () => handlers.onChoose(i));
      list.appendChild(btn);
    });
    box.appendChild(list);
  }
  root.appendChild(box);
}
