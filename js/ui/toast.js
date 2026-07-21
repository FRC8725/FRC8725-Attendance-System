let stackEl = null;

function ensureStack() {
  if (stackEl && document.body.contains(stackEl)) return stackEl;
  stackEl = document.createElement('div');
  stackEl.className = 'toast-stack';
  stackEl.setAttribute('aria-live', 'polite');
  document.body.appendChild(stackEl);
  return stackEl;
}

/**
 * @param {string} message
 * @param {'info'|'success'|'warning'|'danger'} type
 */
export function showToast(message, type = 'info', durationMs = 3200) {
  const stack = ensureStack();
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = message;
  stack.appendChild(el);

  setTimeout(() => {
    el.classList.add('is-leaving');
    setTimeout(() => el.remove(), 200);
  }, durationMs);
}
