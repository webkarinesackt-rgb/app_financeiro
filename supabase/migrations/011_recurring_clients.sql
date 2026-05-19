-- ============================================================
-- FinançasPRO — Migration 011: Clientes Recorrentes (MRR)
--   Clientes que pagam todo mês. Usado em /previsao pra estimar
--   receita mensal recorrente (Monthly Recurring Revenue).
-- Idempotente.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.recurring_clients (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  amount        NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  billing_day   INT,
  service_type  TEXT,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  notes         TEXT,
  started_at    DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname='recurring_clients_billing_day_check') THEN
    ALTER TABLE public.recurring_clients DROP CONSTRAINT recurring_clients_billing_day_check;
  END IF;
END $$;

ALTER TABLE public.recurring_clients ADD CONSTRAINT recurring_clients_billing_day_check
  CHECK (billing_day IS NULL OR (billing_day BETWEEN 1 AND 31));

CREATE INDEX IF NOT EXISTS recurring_clients_user_active_idx
  ON public.recurring_clients (user_id, active);

ALTER TABLE public.recurring_clients ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='recurring_clients' AND policyname='rc_select') THEN
    CREATE POLICY "rc_select" ON public.recurring_clients FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='recurring_clients' AND policyname='rc_insert') THEN
    CREATE POLICY "rc_insert" ON public.recurring_clients FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='recurring_clients' AND policyname='rc_update') THEN
    CREATE POLICY "rc_update" ON public.recurring_clients FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='recurring_clients' AND policyname='rc_delete') THEN
    CREATE POLICY "rc_delete" ON public.recurring_clients FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='recurring_clients_updated_at') THEN
    CREATE TRIGGER recurring_clients_updated_at BEFORE UPDATE ON public.recurring_clients
      FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END $$;
