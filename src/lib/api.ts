import { supabase } from './supabaseClient';
import type { Account, Transaction, MonthlySalaryLog, SalaryAllocationDetail } from '../types';

interface AccountRow {
  id: string;
  name: string;
  bank: string | null;
  purpose: string | null;
  color: string | null;
  balance: number;
  goal: number;
  created_at: string;
}

interface TransactionRow {
  id: string;
  account_id: string;
  target_account_id: string | null;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  description: string;
  date: string;
}

interface SalaryLogRow {
  id: string;
  month: string;
  amount: number;
  is_logged: boolean;
  allocations: SalaryAllocationDetail[] | null;
  date: string;
}

const toAccount = (row: AccountRow): Account => ({
  id: row.id,
  name: row.name,
  balance: row.balance,
  goal: row.goal,
  createdAt: row.created_at,
  purpose: row.purpose ?? undefined,
  bank: row.bank ?? undefined,
  color: row.color ?? undefined,
});

const toTransaction = (row: TransactionRow): Transaction => ({
  id: row.id,
  accountId: row.account_id,
  amount: row.amount,
  type: row.type,
  targetAccountId: row.target_account_id ?? undefined,
  description: row.description,
  date: row.date,
});

const toSalaryLog = (row: SalaryLogRow): MonthlySalaryLog => ({
  id: row.id,
  month: row.month,
  amount: row.amount,
  isLogged: row.is_logged,
  date: row.date,
  allocations: row.allocations ?? undefined,
});

export async function fetchAccounts(): Promise<Account[]> {
  const { data, error } = await supabase
    .from('minemint_accounts')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data as AccountRow[]).map(toAccount);
}

export async function updateAccountBalance(id: string, balance: number): Promise<void> {
  const { error } = await supabase.from('minemint_accounts').update({ balance }).eq('id', id);
  if (error) throw error;
}

export async function updateAccountDetails(
  id: string,
  fields: { name: string; purpose: string; goal: number; bank: string; color: string }
): Promise<Account> {
  const { data, error } = await supabase
    .from('minemint_accounts')
    .update(fields)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return toAccount(data as AccountRow);
}

export async function fetchTransactions(): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('minemint_transactions')
    .select('*')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as TransactionRow[]).map(toTransaction);
}

export async function createTransaction(input: Omit<Transaction, 'id'>): Promise<Transaction> {
  const { data, error } = await supabase
    .from('minemint_transactions')
    .insert({
      account_id: input.accountId,
      target_account_id: input.targetAccountId ?? null,
      amount: input.amount,
      type: input.type,
      description: input.description,
      date: input.date,
    })
    .select()
    .single();
  if (error) throw error;
  return toTransaction(data as TransactionRow);
}

export async function fetchSalaryLogs(): Promise<MonthlySalaryLog[]> {
  const { data, error } = await supabase
    .from('minemint_salary_logs')
    .select('*')
    .order('month', { ascending: false });
  if (error) throw error;
  return (data as SalaryLogRow[]).map(toSalaryLog);
}

export async function createSalaryLog(input: Omit<MonthlySalaryLog, 'id'>): Promise<MonthlySalaryLog> {
  const { data, error } = await supabase
    .from('minemint_salary_logs')
    .insert({
      month: input.month,
      amount: input.amount,
      is_logged: input.isLogged,
      date: input.date,
      allocations: input.allocations ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return toSalaryLog(data as SalaryLogRow);
}
