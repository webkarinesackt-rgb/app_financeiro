-- ============================================================
-- FinançasPRO — Migration completa (idempotente)
-- Pode ser executada múltiplas vezes sem erro.
-- Execute no SQL Editor do Supabase (https://supabase.com/dashboard)
-- ============================================================

-- ── Accounts ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.accounts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  type             TEXT NOT NULL DEFAULT 'checking',
  bank             TEXT,
  color            TEXT NOT NULL DEFAULT '#10b981',
  initial_balance  NUMERIC(12,2) NOT NULL DEFAULT 0,
  include_in_total BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='accounts' AND policyname='accounts_select') THEN
    CREATE POLICY "accounts_select" ON public.accounts FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='accounts' AND policyname='accounts_insert') THEN
    CREATE POLICY "accounts_insert" ON public.accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='accounts' AND policyname='accounts_update') THEN
    CREATE POLICY "accounts_update" ON public.accounts FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='accounts' AND policyname='accounts_delete') THEN
    CREATE POLICY "accounts_delete" ON public.accounts FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- ── Credit Cards ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.credit_cards (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  bank          TEXT,
  color         TEXT NOT NULL DEFAULT '#3b82f6',
  credit_limit  NUMERIC(12,2) NOT NULL DEFAULT 0,
  closing_day   INT,
  due_day       INT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_cards ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='credit_cards' AND policyname='cards_select') THEN
    CREATE POLICY "cards_select" ON public.credit_cards FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='credit_cards' AND policyname='cards_insert') THEN
    CREATE POLICY "cards_insert" ON public.credit_cards FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='credit_cards' AND policyname='cards_update') THEN
    CREATE POLICY "cards_update" ON public.credit_cards FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='credit_cards' AND policyname='cards_delete') THEN
    CREATE POLICY "cards_delete" ON public.credit_cards FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- ── Transactions ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.transactions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type                 TEXT NOT NULL CHECK (type IN ('income','expense')),
  amount               NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  description          TEXT NOT NULL,
  category             TEXT NOT NULL,
  custom_category      TEXT,
  date                 DATE NOT NULL,
  account_id           UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  credit_card_id       UUID REFERENCES public.credit_cards(id) ON DELETE SET NULL,
  payment_method       TEXT,
  installment_total    INT,
  installment_current  INT,
  installment_group_id UUID,
  notes                TEXT,
  is_recurring         BOOLEAN NOT NULL DEFAULT FALSE,
  recurrence_interval  TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add missing columns to existing transactions table (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='account_id' AND table_schema='public') THEN
    ALTER TABLE public.transactions ADD COLUMN account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='credit_card_id' AND table_schema='public') THEN
    ALTER TABLE public.transactions ADD COLUMN credit_card_id UUID REFERENCES public.credit_cards(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='payment_method' AND table_schema='public') THEN
    ALTER TABLE public.transactions ADD COLUMN payment_method TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='installment_total' AND table_schema='public') THEN
    ALTER TABLE public.transactions ADD COLUMN installment_total INT;
    ALTER TABLE public.transactions ADD COLUMN installment_current INT;
    ALTER TABLE public.transactions ADD COLUMN installment_group_id UUID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='notes' AND table_schema='public') THEN
    ALTER TABLE public.transactions ADD COLUMN notes TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='custom_category' AND table_schema='public') THEN
    ALTER TABLE public.transactions ADD COLUMN custom_category TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='is_recurring' AND table_schema='public') THEN
    ALTER TABLE public.transactions ADD COLUMN is_recurring BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE public.transactions ADD COLUMN recurrence_interval TEXT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS transactions_user_date_idx       ON public.transactions (user_id, date DESC);
CREATE INDEX IF NOT EXISTS transactions_account_idx         ON public.transactions (account_id);
CREATE INDEX IF NOT EXISTS transactions_card_idx            ON public.transactions (credit_card_id);
CREATE INDEX IF NOT EXISTS transactions_installment_grp_idx ON public.transactions (installment_group_id);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='transactions' AND policyname='tx_select') THEN
    CREATE POLICY "tx_select" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='transactions' AND policyname='tx_insert') THEN
    CREATE POLICY "tx_insert" ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='transactions' AND policyname='tx_update') THEN
    CREATE POLICY "tx_update" ON public.transactions FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='transactions' AND policyname='tx_delete') THEN
    CREATE POLICY "tx_delete" ON public.transactions FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- ── Triggers ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='accounts_updated_at') THEN
    CREATE TRIGGER accounts_updated_at BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='cards_updated_at') THEN
    CREATE TRIGGER cards_updated_at BEFORE UPDATE ON public.credit_cards FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='transactions_updated_at') THEN
    CREATE TRIGGER transactions_updated_at BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END $$;
