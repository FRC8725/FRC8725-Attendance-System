import { getReadPassword, getScanPassword } from './db.js';

// 兩組獨立的鎖定範圍：
//   'general' 給場次管理／成員管理／活動紀錄／好寶寶系統使用，密碼存在 settings/app.readPassword，
//             解鎖狀態存在 sessionStorage（關閉分頁就需要重新輸入）。
//   'scan'    專門給「點名讀卡」頁面使用，密碼是獨立的 settings/app.scanPassword，
//             解鎖狀態存在 localStorage，方便固定擺放的讀卡機裝置長期保持解鎖，不必每次重開瀏覽器都輸入。
const SCOPES = {
  general: { storageKey: 'attendance_unlocked_general', getStorage: () => sessionStorage },
  scan: { storageKey: 'attendance_unlocked_scan', getStorage: () => localStorage },
};

const listeners = new Set();

function resolveScope(scope) {
  return SCOPES[scope] || SCOPES.general;
}

export function isUnlocked(scope = 'general') {
  const { storageKey, getStorage } = resolveScope(scope);
  return getStorage().getItem(storageKey) === 'true';
}

export function onLockStateChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch (err) {
      console.error(err);
    }
  });
}

export function lock(scope = 'general') {
  const { storageKey, getStorage } = resolveScope(scope);
  getStorage().removeItem(storageKey);
  notify();
}

/**
 * Verifies the entered password against the password stored for the given scope
 * (settings/app.readPassword for 'general', settings/app.scanPassword for 'scan').
 * Returns true and unlocks that scope's session on success; false otherwise.
 */
export async function tryUnlock(passwordAttempt, scope = 'general') {
  const stored = scope === 'scan' ? await getScanPassword() : await getReadPassword();

  if (stored === null) {
    throw new Error(
      scope === 'scan'
        ? '尚未設定讀卡機密碼。請先在 Firestore 的 settings/app 文件中新增 scanPassword 欄位。'
        : '尚未設定讀取密碼。請先在 Firestore 的 settings/app 文件中新增 readPassword 欄位。'
    );
  }

  if (passwordAttempt === stored) {
    const { storageKey, getStorage } = resolveScope(scope);
    getStorage().setItem(storageKey, 'true');
    notify();
    return true;
  }
  return false;
}
