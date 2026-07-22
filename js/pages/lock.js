import { tryUnlock } from '../services/auth-gate.js';
import { showToast } from '../ui/toast.js';

const SCOPE_TEXT = {
  general: {
    title: '請先解鎖',
    sub: '此頁面需要輸入讀取密碼才能進入',
    label: '讀取密碼',
  },
  scan: {
    title: '請先解鎖讀卡機',
    sub: '此裝置需要輸入讀卡機專用密碼才能進行點名讀卡',
    label: '讀卡機密碼',
  },
};

export async function mountPage(context) {
  const scope = context.lockScope || 'general';
  const text = SCOPE_TEXT[scope] || SCOPE_TEXT.general;

  document.getElementById('lock-title').textContent = text.title;
  document.getElementById('lock-sub').textContent = text.sub;
  document.getElementById('lock-password-label').textContent = text.label;

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

    tryUnlock(value, scope)
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
