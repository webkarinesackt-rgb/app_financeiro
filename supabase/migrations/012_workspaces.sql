-- ============================================================
-- FinançasPRO — Migration 012: Workspaces (business | personal)
--   Adiciona coluna workspace nas tabelas user-scoped pra
--   segregar dados entre o workspace 'business' (Fysi) e o
--   novo workspace 'personal' (vida pessoal, começa vazio).
-- Idempotente.
-- ============================================================

-- Tabelas user-scoped recebem a coluna
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS workspace TEXT NOT NULL DEFAULT 'business';

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS workspace TEXT NOT NULL DEFAULT 'business';

ALTER TABLE public.credit_cards
  ADD COLUMN IF NOT EXISTS workspace TEXT NOT NULL DEFAULT 'business';

ALTER TABLE public.categorization_rules
  ADD COLUMN IF NOT EXISTS workspace TEXT NOT NULL DEFAULT 'business';

ALTER TABLE public.fixed_costs
  ADD COLUMN IF NOT EXISTS workspace TEXT NOT NULL DEFAULT 'business';

ALTER TABLE public.reminders
  ADD COLUMN IF NOT EXISTS workspace TEXT NOT NULL DEFAULT 'business';

-- CHECK constraint pra restringir valores válidos (drop+recreate pra idempotência)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transactions_workspace_check') THEN
    ALTER TABLE public.transactions DROP CONSTRAINT transactions_workspace_check;
  END IF;
END $$;
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_workspace_check CHECK (workspace IN ('business', 'personal'));

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'accounts_workspace_check') THEN
    ALTER TABLE public.accounts DROP CONSTRAINT accounts_workspace_check;
  END IF;
END $$;
ALTER TABLE public.accounts
  ADD CONSTRAINT accounts_workspace_check CHECK (workspace IN ('business', 'personal'));

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'credit_cards_workspace_check') THEN
    ALTER TABLE public.credit_cards DROP CONSTRAINT credit_cards_workspace_check;
  END IF;
END $$;
ALTER TABLE public.credit_cards
  ADD CONSTRAINT credit_cards_workspace_check CHECK (workspace IN ('business', 'personal'));

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'categorization_rules_workspace_check') THEN
    ALTER TABLE public.categorization_rules DROP CONSTRAINT categorization_rules_workspace_check;
  END IF;
END $$;
ALTER TABLE public.categorization_rules
  ADD CONSTRAINT categorization_rules_workspace_check CHECK (workspace IN ('business', 'personal'));

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fixed_costs_workspace_check') THEN
    ALTER TABLE public.fixed_costs DROP CONSTRAINT fixed_costs_workspace_check;
  END IF;
END $$;
ALTER TABLE public.fixed_costs
  ADD CONSTRAINT fixed_costs_workspace_check CHECK (workspace IN ('business', 'personal'));

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reminders_workspace_check') THEN
    ALTER TABLE public.reminders DROP CONSTRAINT reminders_workspace_check;
  END IF;
END $$;
ALTER TABLE public.reminders
  ADD CONSTRAINT reminders_workspace_check CHECK (workspace IN ('business', 'personal'));

-- Índices pra performance dos filtros frequentes
CREATE INDEX IF NOT EXISTS transactions_user_workspace_date_idx
  ON public.transactions (user_id, workspace, date DESC);

CREATE INDEX IF NOT EXISTS accounts_user_workspace_idx
  ON public.accounts (user_id, workspace);

CREATE INDEX IF NOT EXISTS credit_cards_user_workspace_idx
  ON public.credit_cards (user_id, workspace);

CREATE INDEX IF NOT EXISTS categorization_rules_user_workspace_idx
  ON public.categorization_rules (user_id, workspace);
