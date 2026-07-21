import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getFirestore,
  connectFirestoreEmulator,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// ------------------------------------------------------------------
// Firebase 專案設定值（attendance-system-412f9）。
// 這些值本身不是機密，可以安全地留在公開的前端程式碼裡；
// 真正的存取控制交給 firestore.rules，而不是隱藏這組設定。
// ------------------------------------------------------------------
const firebaseConfig = {
  apiKey: 'AIzaSyAoQB6SrzIvifO8QqNoMzm56JAHJS5qQiA',
  authDomain: 'attendance-system-412f9.firebaseapp.com',
  projectId: 'attendance-system-412f9',
  storageBucket: 'attendance-system-412f9.firebasestorage.app',
  messagingSenderId: '332152843833',
  appId: '1:332152843833:web:a03fc3b338c8c15dc967e8',
};

let app = null;
let db = null;

export function initFirebase() {
  if (app) return { app, db };
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);

  // 開發時如果想接本機 Firestore Emulator，取消下一行註解：
  // connectFirestoreEmulator(db, '127.0.0.1', 8080);

  return { app, db };
}

export function getDb() {
  if (!db) {
    throw new Error('Firebase 尚未初始化，請先呼叫 initFirebase()。');
  }
  return db;
}
