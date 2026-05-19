-- ============================================================
-- FinançasPRO — Migration 009: Custos fixos (equipe, infra, etc.)
--   Usado em /previsao pra somar na projeção de despesas futuras.
--   Não vira transação real — fica isolado pra planejamento.
-- Idempotente.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.fixed_costs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  amount       NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  frequency    TEXT NOT NULL DEFAULT 'monthly',
  category     TEXT NOT NULL DEFAULT 'team',
  notes        TEXT,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fixed_costs_frequency_check') THEN
    ALTER TABLE public.fixed_costs DROP CONSTRAINT fixed_costs_frequency_check;
  END IF;
END $$;

ALTER TABLE public.fixed_costs ADD CONSTRAINT fixed_costs_frequency_check
  CHECK (frequency IN ('weekly','biweekly','monthly','quarterly','yearly'));

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fixed_costs_category_check') THEN
    ALTER TABLE public.fixed_costs DROP CONSTRAINT fixed_costs_category_check;
  END IF;
END $$;

ALTER TABLE public.fixed_costs ADD CONSTRAINT fixed_costs_category_check
  CHECK (category IN ('team','tools','infra','marketing','taxes','other'));

CREATE INDEX IF NOT EXISTS fixed_costs_user_active_idx
  ON public.fixed_costs (user_id, active);

ALTER TABLE public.fixed_costs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fixed_costs' AND policyname='fc_select') THEN
    CREATE POLICY "fc_select" ON public.fixed_costs FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fixed_costs' AND policyname='fc_insert') THEN
    CREATE POLICY "fc_insert" ON public.fixed_costs FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fixed_costs' AND policyname='fc_update') THEN
    CREATE POLICY "fc_update" ON public.fixed_costs FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fixed_costs' AND policyname='fc_delete') THEN
    CREATE POLICY "fc_delete" ON public.fixed_costs FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='fixed_costs_updated_at') THEN
    CREATE TRIGGER fixed_costs_updated_at BEFORE UPDATE ON public.fixed_costs
      FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END $$;
