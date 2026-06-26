import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { UserDB, Transaction, Saving, Debt } from '../types';
import {
  loadUserData,
  listenUserData,
  addTransaction,
  deleteTransaction,
  saveSaving,
  deleteSaving,
  saveDebt,
  deleteDebt,
} from '../services/dataService';

interface AppContextType {
  username: string;
  db: UserDB;
  loading: boolean;
  syncError: string;
  onLogout: () => void;
  addTx: (tx: Transaction) => Promise<void>;
  deleteTx: (id: string) => Promise<void>;
  upsertSaving: (s: Saving) => Promise<void>;
  removeSaving: (id: string) => Promise<void>;
  upsertDebt: (d: Debt) => Promise<void>;
  removeDebt: (id: string) => Promise<void>;
}

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

const AppContext = createContext<AppContextType>({
  username: '',
  db: emptyDB(),
  loading: true,
  syncError: '',
  onLogout: () => {},
  addTx: async () => {},
  deleteTx: async () => {},
  upsertSaving: async () => {},
  removeSaving: async () => {},
  upsertDebt: async () => {},
  removeDebt: async () => {},
});

export function AppProvider({ username, onLogout, children }: { username: string; onLogout: () => void; children: React.ReactNode }) {
  const [db, setDb] = useState<UserDB>(emptyDB());
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState('');
  const dbRef = useRef(db);
  dbRef.current = db;

  useEffect(() => {
    if (!username) return;
    setSyncError('');
    loadUserData(username)
      .then((data) => {
        setDb(data);
        setLoading(false);
      })
      .catch((e) => {
        setSyncError(e?.code || e?.message || 'ไม่สามารถโหลดข้อมูลได้');
        setLoading(false);
      });

    const unsub = listenUserData(
      username,
      (data) => {
        setDb(data);
        setLoading(false);
        setSyncError('');
      },
      (err) => {
        setSyncError(err?.message || 'sync error');
      },
    );
    return unsub;
  }, [username]);

  const addTx = async (tx: Transaction) => {
    const updated = await addTransaction(username, dbRef.current, tx);
    setDb(updated);
  };

  const deleteTx = async (id: string) => {
    const updated = await deleteTransaction(username, dbRef.current, id);
    setDb(updated);
  };

  const upsertSaving = async (s: Saving) => {
    const updated = await saveSaving(username, dbRef.current, s);
    setDb(updated);
  };

  const removeSaving = async (id: string) => {
    const updated = await deleteSaving(username, dbRef.current, id);
    setDb(updated);
  };

  const upsertDebt = async (d: Debt) => {
    const updated = await saveDebt(username, dbRef.current, d);
    setDb(updated);
  };

  const removeDebt = async (id: string) => {
    const updated = await deleteDebt(username, dbRef.current, id);
    setDb(updated);
  };

  return (
    <AppContext.Provider value={{ username, db, loading, syncError, onLogout, addTx, deleteTx, upsertSaving, removeSaving, upsertDebt, removeDebt }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
