import { tryUnlock } from '../services/auth-gate.js';
import { showToast } from '../ui/toast.js';

export async function mountPage(context) {
  const form = document.getElementById('lock-form');
  const input = document.getElementById('lock-password');
  const errorEl = document.getElementById('lock-error');

  function showError(message) {
    errorEl.textContent = message;
    errorEl.style.display = 'block';
  }

  function onSubmit(e) {
    e.preventDefault();
    errorEl.style.display = 'none';
    const value = input.value.trim();
    if (!value) {
      showError('請輸入密碼');
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    tryUnlock(value)
      .then((ok) => {
        if (ok) {
          showToast('已解鎖', 'success');
          context.navigate(context.resumePath || '/summary');
        } else {
          showError('密碼錯誤，請再試一次');
          input.value = '';
          input.focus();
        }
      })
      .catch((err) => {
        showError(err.message || '驗證密碼時發生錯誤');
      })
      .finally(() => {
        submitBtn.disabled = false;
      });
  }

  form.addEventListener('submit', onSubmit);

  return () => {
    form.removeEventListener('submit', onSubmit);
  };
}
