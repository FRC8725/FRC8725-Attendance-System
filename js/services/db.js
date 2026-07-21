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
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getDb } from './firebase-config.js';

// ---------------------------------------------------------------
// Firestore 結構
//   settings/app        { readPassword }
//   members/{id}         { name, cardUID, note, createdAt }
//   sessions/{id}         { name, date, note, createdAt }
//   attendance/{id}       { sessionId, memberId, memberName, cardUID, checkedInAt }
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
  return ref.id;
}

export async function updateMember(id, data) {
  await updateDoc(doc(getDb(), 'members', id), data);
}

export async function deleteMember(id) {
  await deleteDoc(doc(getDb(), 'members', id));
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
  return ref.id;
}

export async function updateSession(id, data) {
  await updateDoc(doc(getDb(), 'sessions', id), data);
}

export async function deleteSession(id) {
  await deleteDoc(doc(getDb(), 'sessions', id));
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

export async function addAttendance({ sessionId, memberId, memberName, cardUID }) {
  const ref = await addDoc(collection(getDb(), 'attendance'), {
    sessionId,
    memberId,
    memberName,
    cardUID: cardUID || null,
    checkedInAt: serverTimestamp(),
  });
  return ref.id;
}

export async function deleteAttendance(id) {
  await deleteDoc(doc(getDb(), 'attendance', id));
}

function toMillis(timestamp) {
  if (!timestamp) return 0;
  return typeof timestamp.toMillis === 'function' ? timestamp.toMillis() : new Date(timestamp).getTime();
}

function sortByCheckedInDesc(records) {
  return [...records].sort((a, b) => toMillis(b.checkedInAt) - toMillis(a.checkedInAt));
}
