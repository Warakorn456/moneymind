export type TransactionType = 'income' | 'expense';

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  category: string;
  description: string;   // เว็บหลักใช้ field "description"
  date: string;
  // optional extras ที่เว็บใส่มาด้วย
  carryover?: boolean;
  bankId?: string | null;
  currency?: string;
  origAmount?: number;
  isFixed?: boolean;
  savingDestBankId?: string | null;
}

export interface Saving {
  id: string;
  name: string;
  target: number;
  current: number;
  deadline?: string;
  color?: string;
  linkedPortId?: string | null;   // เว็บผูกเป้าหมายกับพอร์ตลงทุน
}

export interface Debt {
  id: string;
  name: string;
  total: number;
  remaining: number;
  rate?: number;
  pay?: number;
  startDate?: string;   // เว็บหลักใช้ "startDate"
  dueDate?: string;     // เว็บหลักใช้ "dueDate"
}

export interface UserDB {
  transactions: Transaction[];
  savings: Saving[];
  debts: Debt[];
  investments: any[];
  portfolios?: any[];
  settings: { apiKey: string; [k: string]: any };
  tax: any;
  plan: any;
  profile: any;
  banks?: any[];
  _savedAt?: number;
}

export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  Transactions: undefined;
  Add: undefined;
  Savings: undefined;
  More: undefined;
};
