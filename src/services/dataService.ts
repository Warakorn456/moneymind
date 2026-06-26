import { db } from '../config/firebase';
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { UserDB, Transaction, Saving, Debt } from '../types';

// ──────────────────────────────────────────────────────────────
// Firestore contract (ต้องตรงกับเว็บหลัก index.html):
//   userdata/{username} = {
//     db: "<JSON.stringify(DB)>",   // DB มี _savedAt อยู่ข้างใน
//     updatedAt: serverTimestamp(),
//     aiUsage?, claudeUsage?         // เขียนโดยสคริปต์ python ฝั่งเว็บ — ห้ามทับ
//   }
// เว็บใช้ merge:true เพื่อไม่ลบ field อื่น และเทียบเวอร์ชันด้วย DB._savedAt
// ──────────────────────────────────────────────────────────────

const emptyDB = (): UserDB => ({
  transactions: [],
  savings: [],
  debts: [],
  investments: [],
  settings: { apiKey: '' },
  tax: {},
  plan: { monthlyIncome: 0, otherAssets: 0, items: [], extraAssets: [], extraDebts: [] },
  profile: {},
});

// แปลงข้อมูลดิบจาก Firestore (field `db` เป็น JSON string) → UserDB
function parseRemote(raw: any): UserDB | null {
  if (!raw) return null;
  // รูปแบบเว็บ: { db: "<json>" }
  if (typeof raw.db === 'string') {
    try {
      const parsed = JSON.parse(raw.db);
      return { ...emptyDB(), ...parsed } as UserDB;
    } catch (e) {
      console.error('[Firestore] parse db field failed:', e);
      return null;
    }
  }
  // รูปแบบเก่า/legacy: field กระจายตรงๆ (เผื่อมีข้อมูลเก่า)
  if (raw.transactions || raw.savings || raw.debts) {
    return { ...emptyDB(), ...raw } as UserDB;
  }
  return null;
}

export async function loadUserData(username: string): Promise<UserDB> {
  try {
    const ref = doc(db, 'userdata', username);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const parsed = parseRemote(snap.data());
      if (parsed) return parsed;
    }
    return emptyDB();
  } catch (e: any) {
    console.error('[Firestore] loadUserData error:', e?.code, e?.message);
    throw e;
  }
}

export async function saveUserData(username: string, data: UserDB): Promise<void> {
  const ref = doc(db, 'userdata', username);
  // ฝัง version stamp ไว้ใน DB เหมือนเว็บ (DB._savedAt) เพื่อ conflict resolution
  const stamped: any = { ...data, _savedAt: Date.now() };
  await setDoc(
    ref,
    {
      db: JSON.stringify(stamped),
      updatedAt: serverTimestamp(),
    },
    { merge: true }, // merge เพื่อรักษา aiUsage/claudeUsage ที่สคริปต์เว็บเขียนไว้
  );
}

export function listenUserData(
  username: string,
  onChange: (data: UserDB) => void,
  onError?: (err: Error) => void,
): () => void {
  const ref = doc(db, 'userdata', username);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) return;
      const parsed = parseRemote(snap.data());
      if (parsed) onChange(parsed);
    },
    (err) => {
      console.error('[Firestore] onSnapshot error:', err?.code, err?.message);
      onError?.(err);
    },
  );
}

export async function addTransaction(username: string, currentDB: UserDB, tx: Transaction): Promise<UserDB> {
  const newDB = { ...currentDB, transactions: [tx, ...currentDB.transactions] };
  await saveUserData(username, newDB);
  return newDB;
}

export async function deleteTransaction(username: string, currentDB: UserDB, id: string): Promise<UserDB> {
  const newDB = { ...currentDB, transactions: currentDB.transactions.filter((t) => t.id !== id) };
  await saveUserData(username, newDB);
  return newDB;
}

export async function saveSaving(username: string, currentDB: UserDB, saving: Saving): Promise<UserDB> {
  const existing = currentDB.savings.findIndex((s) => s.id === saving.id);
  const savings =
    existing >= 0
      ? currentDB.savings.map((s) => (s.id === saving.id ? saving : s))
      : [...currentDB.savings, saving];
  const newDB = { ...currentDB, savings };
  await saveUserData(username, newDB);
  return newDB;
}

export async function deleteSaving(username: string, currentDB: UserDB, id: string): Promise<UserDB> {
  const newDB = { ...currentDB, savings: currentDB.savings.filter((s) => s.id !== id) };
  await saveUserData(username, newDB);
  return newDB;
}

export async function saveDebt(username: string, currentDB: UserDB, debt: Debt): Promise<UserDB> {
  const existing = currentDB.debts.findIndex((d) => d.id === debt.id);
  const debts =
    existing >= 0
      ? currentDB.debts.map((d) => (d.id === debt.id ? debt : d))
      : [...currentDB.debts, debt];
  const newDB = { ...currentDB, debts };
  await saveUserData(username, newDB);
  return newDB;
}

export async function deleteDebt(username: string, currentDB: UserDB, id: string): Promise<UserDB> {
  const newDB = { ...currentDB, debts: currentDB.debts.filter((d) => d.id !== id) };
  await saveUserData(username, newDB);
  return newDB;
}
