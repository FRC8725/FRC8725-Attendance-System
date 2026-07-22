import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  orderBy,
  limit,
  increment,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getDb } from './firebase-config.js';

// ---------------------------------------------------------------
// Firestore 結構
//   settings/app        { readPassword, scanPassword }
//   members/{id}         { name, cardUID, note, createdAt }
//   sessions/{id}         { name, date, note, createdAt }
//   attendance/{id}       { sessionId, memberId, memberName, cardUID, checkedInAt }
//   logs/{id}             { type, message, meta, createdAt }
//   goodkidMarks/{memberId}  { counts: { "🌟": 2, "👍": 1, ... }, updatedAt }
// ---------------------------------------------------------------

/* ===================== settings ===================== */

export async function getReadPassword() {
  const ref = doc(getDb(), 'settings', 'app');
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data().readPassword ?? null;
}

export async function setReadPassword(password) {
  const ref = doc(getDb(), 'settings', 'app');
  await setDoc(ref, { readPassword: password }, { merge: true });
}

export async function getScanPassword() {
  const ref = doc(getDb(), 'settings', 'app');
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data().scanPassword ?? null;
}

export async function setScanPassword(password) {
  const ref = doc(getDb(), 'settings', 'app');
  await setDoc(ref, { scanPassword: password }, { merge: true });
}

/* ===================== activity log ===================== */
// 最佳努力寫入：紀錄本身失敗不應該擋下真正的操作，所以這裡吞掉錯誤只印在 console。

export async function addLog(type, message, meta = {}) {
  try {
    await addDoc(collection(getDb(), 'logs'), {
      type,
      message,
      meta,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error('寫入活動紀錄失敗', err);
  }
}

export async function listLogs(limitCount = 300) {
  const snap = await getDocs(
    query(collection(getDb(), 'logs'), orderBy('createdAt', 'desc'), limit(limitCount))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/* ===================== members ===================== */

export async function listMembers() {
  const snap = await getDocs(
    query(collection(getDb(), 'members'), orderBy('name'))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function findMemberByUID(cardUID) {
  const snap = await getDocs(
    query(collection(getDb(), 'members'), where('cardUID', '==', cardUID))
  );
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

export async function addMember({ name, cardUID, note = '' }) {
  const ref = await addDoc(collection(getDb(), 'members'), {
    name,
    cardUID: cardUID || null,
    note,
    createdAt: serverTimestamp(),
  });
  await addLog('member_add', `新增成員：${name}`, { memberId: ref.id });
  return ref.id;
}

export async function updateMember(id, data) {
  await updateDoc(doc(getDb(), 'members', id), data);
  await addLog('member_update', `更新成員：${data.name || id}`, { memberId: id });
}

export async function deleteMember(id, name) {
  await deleteDoc(doc(getDb(), 'members', id));
  await addLog('member_delete', `刪除成員：${name || id}`, { memberId: id });
}

/* ===================== sessions ===================== */

export async function listSessions() {
  const snap = await getDocs(
    query(collection(getDb(), 'sessions'), orderBy('createdAt', 'desc'))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addSession({ name, date, note = '' }) {
  const ref = await addDoc(collection(getDb(), 'sessions'), {
    name,
    date,
    note,
    createdAt: serverTimestamp(),
  });
  await addLog('session_add', `新增場次：${name}`, { sessionId: ref.id });
  return ref.id;
}

export async function updateSession(id, data) {
  await updateDoc(doc(getDb(), 'sessions', id), data);
  await addLog('session_update', `更新場次：${data.name || id}`, { sessionId: id });
}

export async function deleteSession(id, name) {
  await deleteDoc(doc(getDb(), 'sessions', id));
  await addLog('session_delete', `刪除場次：${name || id}`, { sessionId: id });
}

/* ===================== attendance ===================== */

export async function listAttendanceForSession(sessionId) {
  const snap = await getDocs(
    query(collection(getDb(), 'attendance'), where('sessionId', '==', sessionId))
  );
  const records = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return sortByCheckedInDesc(records);
}

export async function listAllAttendance() {
  const snap = await getDocs(
    query(collection(getDb(), 'attendance'), orderBy('checkedInAt', 'desc'))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function findExistingAttendance(sessionId, memberId) {
  const snap = await getDocs(
    query(
      collection(getDb(), 'attendance'),
      where('sessionId', '==', sessionId),
      where('memberId', '==', memberId)
    )
  );
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

export async function addAttendance({ sessionId, memberId, memberName, cardUID, sessionName }) {
  const ref = await addDoc(collection(getDb(), 'attendance'), {
    sessionId,
    memberId,
    memberName,
    cardUID: cardUID || null,
    checkedInAt: serverTimestamp(),
  });
  await addLog(
    'attendance_add',
    `簽到：${memberName}${sessionName ? '（' + sessionName + '）' : ''}`,
    { sessionId, memberId, attendanceId: ref.id }
  );
  return ref.id;
}

export async function deleteAttendance(id, memberName, sessionName) {
  await deleteDoc(doc(getDb(), 'attendance', id));
  await addLog(
    'attendance_delete',
    `刪除簽到紀錄：${memberName || id}${sessionName ? '（' + sessionName + '）' : ''}`,
    { attendanceId: id }
  );
}

function toMillis(timestamp) {
  if (!timestamp) return 0;
  return typeof timestamp.toMillis === 'function' ? timestamp.toMillis() : new Date(timestamp).getTime();
}

function sortByCheckedInDesc(records) {
  return [...records].sort((a, b) => toMillis(b.checkedInAt) - toMillis(a.checkedInAt));
}

/* ===================== good-kid manual marks ===================== */
// 每個成員一份文件（doc id = memberId），counts 是 emoji -> 次數 的對照表。
// 管理者點擊卡片上的 emoji 按鈕時累加次數；此功能設計為可重複點擊、可同時累積多種 emoji。

export async function listGoodkidCounts() {
  const snap = await getDocs(collection(getDb(), 'goodkidMarks'));
  const result = {};
  snap.docs.forEach((d) => {
    result[d.id] = d.data().counts || {};
  });
  return result;
}

export async function incrementGoodkidMark(memberId, memberName, emoji) {
  const ref = doc(getDb(), 'goodkidMarks', memberId);
  await setDoc(
    ref,
    {
      counts: { [emoji]: increment(1) },
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  await addLog('goodkid_mark', `好寶寶標記：${memberName} 獲得 ${emoji}`, { memberId, emoji });
}

export async function decrementGoodkidMark(memberId, memberName, emoji) {
  const ref = doc(getDb(), 'goodkidMarks', memberId);
  await setDoc(
    ref,
    {
      counts: { [emoji]: increment(-1) },
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  await addLog('goodkid_unmark', `取消好寶寶標記：${memberName} 的 ${emoji}`, { memberId, emoji });
}
