/**
 * Web NFC only works in Chrome for Android, over HTTPS (or localhost), and the
 * scan must be started from a user gesture (e.g. a button tap). It cannot read
 * protected chip data on a student ID card - only the card's NFC serial number
 * (UID) or any NDEF message written to it. This module reads the UID and lets
 * the app match it against a registered member.
 */

export function isNfcSupported() {
  return typeof window !== 'undefined' && 'NDEFReader' in window;
}

export function isSecureContextOk() {
  return window.isSecureContext;
}

/**
 * Starts continuous NFC scanning.
 * @param {(uid: string) => void} onReading - called with a normalized UID string per tap
 * @param {(err: Error) => void} onError
 * @returns {() => void} stop function
 */
export async function startNfcScan(onReading, onError) {
  if (!isNfcSupported()) {
    throw new Error('此瀏覽器不支援 Web NFC，請在 Android 上使用 Chrome 開啟本頁面。');
  }
  if (!isSecureContextOk()) {
    throw new Error('Web NFC 需要在 HTTPS（或 localhost）環境下才能使用。');
  }

  const controller = new AbortController();
  const reader = new NDEFReader();

  try {
    await reader.scan({ signal: controller.signal });
  } catch (err) {
    throw new Error(
      err?.name === 'NotAllowedError'
        ? '未取得 NFC 使用權限，請確認已允許存取並開啟手機的 NFC。'
        : `啟動 NFC 掃描失敗：${err?.message || err}`
    );
  }

  reader.onreading = (event) => {
    const uid = normalizeSerialNumber(event.serialNumber);
    if (uid) onReading(uid);
  };

  reader.onreadingerror = () => {
    onError?.(new Error('讀取卡片時發生錯誤，請將卡片再次靠近感應區。'));
  };

  return () => controller.abort();
}

function normalizeSerialNumber(serialNumber) {
  if (!serialNumber) return '';
  return serialNumber.toUpperCase();
}
