import { getReadPassword } from './db.js';

const STORAGE_KEY = 'attendance_unlocked';
const listeners = new Set();

export function isUnlocked() {
  return sessionStorage.getItem(STORAGE_KEY) === 'true';
}

export function onLockStateChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  listeners.forEach((fn) => {
    try {
      fn(isUnlocked());
    } catch (err) {
      console.error(err);
    }
  });
}

export function lock() {
  sessionStorage.removeItem(STORAGE_KEY);
  notify();
}

/**
 * Verifies the entered password against settings/app.readPassword in Firestore.
 * Returns true and unlocks the session on success; false otherwise.
 */
export async function tryUnlock(passwordAttempt) {
  const stored = await getReadPassword();

  if (stored === null) {
    throw new Error(
      '尚未設定讀取密碼。請先在 Firestore 的 settings/app 文件中新增 readPassword 欄位。'
    );
  }

  if (passwordAttempt === stored) {
    sessionStorage.setItem(STORAGE_KEY, 'true');
    notify();
    return true;
  }
  return false;
}
