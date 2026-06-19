-- Minemint Financial — Supabase schema
-- Run this in the Supabase SQL Editor for project "Pantagon_Database".
-- Tables are prefixed minemint_ to namespace them in this shared project.

-- 1. minemint_accounts
CREATE TABLE public.minemint_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    bank TEXT,
    purpose TEXT,
    color TEXT,
    balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    goal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. minemint_transactions
CREATE TABLE public.minemint_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES public.minemint_accounts(id) ON DELETE CASCADE,
    target_account_id UUID REFERENCES public.minemint_accounts(id) ON DELETE SET NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
    description TEXT NOT NULL DEFAULT '',
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_minemint_tx_date ON public.minemint_transactions(date DESC);
CREATE INDEX idx_minemint_tx_account ON public.minemint_transactions(account_id);

-- 3. minemint_salary_logs
CREATE TABLE public.minemint_salary_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    month VARCHAR(7) NOT NULL UNIQUE, -- e.g. '2026-06'
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    is_logged BOOLEAN NOT NULL DEFAULT TRUE,
    allocations JSONB, -- [{ accountId, accountName, amount }]
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Row Level Security
-- The app has no login system yet, so these policies grant the anon role
-- full access (matches the app's current no-auth design). Tighten this if
-- Supabase Auth is added later.
ALTER TABLE public.minemint_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.minemint_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.minemint_salary_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon full access" ON public.minemint_accounts FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon full access" ON public.minemint_transactions FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon full access" ON public.minemint_salary_logs FOR ALL TO anon USING (true) WITH CHECK (true);

-- Seed data
-- The app currently has no "add account" UI (only edit), so it needs at
-- least one account to exist already. These mirror the two accounts the
-- app used to seed into localStorage by default. Edit/delete via the app's
-- "edit account" screen or the Supabase dashboard once it's running.
INSERT INTO public.minemint_accounts (name, balance, goal, color) VALUES
    ('เงินออม (Savings)', 10000.00, 50000.00, '#E60024'),
    ('ค่าใช้จ่ายทั่วไป (Expenses)', 5000.00, 15000.00, '#0A66C2');
