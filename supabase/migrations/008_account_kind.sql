-- ============================================================
-- FinançasPRO — Migration 008: Tipo de conta (operacional vs reserva)
--   - operational: contas do dia-a-dia (entram no Saldo Geral)
--   - reserve:     reservas/poupanças (aparecem em /reservas, não somam no Saldo Geral)
-- Idempotente.
-- ============================================================

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'operational';

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'accounts_kind_check'
  ) THEN
    ALTER TABLE public.accounts DROP CONSTRAINT accounts_kind_check;
  END IF;
END $$;

ALTER TABLE public.accounts
  ADD CONSTRAINT accounts_kind_check
  CHECK (kind IN ('operational', 'reserve'));

CREATE INDEX IF NOT EXISTS accounts_user_kind_idx
  ON public.accounts (user_id, kind);

-- Garantia extra: contas marcadas como reserva não devem entrar no total operacional.
UPDATE public.accounts
  SET include_in_total = FALSE
  WHERE kind = 'reserve' AND include_in_total = TRUE;
