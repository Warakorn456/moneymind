import AsyncStorage from '@react-native-async-storage/async-storage';
import { Transaction } from '../types';

const KEY = 'transactions';

export async function getTransactions(): Promise<Transaction[]> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function saveTransaction(tx: Transaction): Promise<void> {
  const list = await getTransactions();
  list.unshift(tx);
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
}

export async function deleteTransaction(id: string): Promise<void> {
  const list = await getTransactions();
  await AsyncStorage.setItem(KEY, JSON.stringify(list.filter(t => t.id !== id)));
}
