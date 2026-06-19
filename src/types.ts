export interface Account {
  id: string;
  name: string;
  balance: number;
  goal: number;
  createdAt: string;
  purpose?: string;
  bank?: string;
  color?: string;
}

export interface Transaction {
  id: string;
  accountId: string;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  targetAccountId?: string; // used if type === 'transfer'
  description: string;
  date: string;
}

export interface SalaryAllocationDetail {
  accountId: string;
  accountName: string;
  amount: number;
}

export interface MonthlySalaryLog {
  id: string;
  month: string; // e.g. "2026-06"
  amount: number;
  isLogged: boolean;
  date: string;
  allocations?: SalaryAllocationDetail[];
}
