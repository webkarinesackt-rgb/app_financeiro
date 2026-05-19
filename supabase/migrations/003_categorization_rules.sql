-- ============================================================
-- FinançasPRO — Migration 003: Categorization rules
-- Regras de categorização automática aplicadas em transações.
-- Idempotente.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.categorization_rules (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  -- Qual campo da transação examinar
  match_field      TEXT NOT NULL CHECK (match_field IN ('description', 'notes', 'payment_method')),
  -- Como comparar
  match_type       TEXT NOT NULL CHECK (match_type IN ('contains', 'equals', 'starts_with')),
  -- Texto a procurar (case-insensitive)
  match_value      TEXT NOT NULL,
  -- Filtro opcional por tipo (income/expense). NULL = aplica nos dois.
  transaction_type TEXT CHECK (transaction_type IN ('income', 'expense')),
  -- Categoria a aplicar (use 'custom' + custom_category pra categorias livres)
  category         TEXT NOT NULL,
  custom_category  TEXT,
  -- Ordem de avaliação. Menor valor = avaliada primeiro. Primeira que casa vence.
  priority         INT NOT NULL DEFAULT 100,
  active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS categorization_rules_user_priority_idx
  ON public.categorization_rules (user_id, priority ASC) WHERE active = TRUE;

ALTER TABLE public.categorization_rules ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='categorization_rules' AND policyname='rules_select') THEN
    CREATE POLICY "rules_select" ON public.categorization_rules FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='categorization_rules' AND policyname='rules_insert') THEN
    CREATE POLICY "rules_insert" ON public.categorization_rules FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='categorization_rules' AND policyname='rules_update') THEN
    CREATE POLICY "rules_update" ON public.categorization_rules FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='categorization_rules' AND policyname='rules_delete') THEN
    CREATE POLICY "rules_delete" ON public.categorization_rules FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='categorization_rules_updated_at') THEN
    CREATE TRIGGER categorization_rules_updated_at BEFORE UPDATE ON public.categorization_rules
      FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END $$;
