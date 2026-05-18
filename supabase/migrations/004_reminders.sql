-- ============================================================
-- FinançasPRO — Migration 004: Reminders (pendências)
-- - payment_due: contas que você precisa pagar (TODO de despesa)
-- - invoice_pending: clientes que você precisa cobrar (TODO de receita)
-- Idempotente.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.reminders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('payment_due', 'invoice_pending')),
  title         TEXT NOT NULL,
  amount        NUMERIC(12,2),
  due_date      DATE,
  notes         TEXT,
  completed     BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reminders_user_pending_idx
  ON public.reminders (user_id, type, due_date NULLS LAST)
  WHERE completed = FALSE;

ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='reminders' AND policyname='reminders_select') THEN
    CREATE POLICY "reminders_select" ON public.reminders FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='reminders' AND policyname='reminders_insert') THEN
    CREATE POLICY "reminders_insert" ON public.reminders FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='reminders' AND policyname='reminders_update') THEN
    CREATE POLICY "reminders_update" ON public.reminders FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='reminders' AND policyname='reminders_delete') THEN
    CREATE POLICY "reminders_delete" ON public.reminders FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='reminders_updated_at') THEN
    CREATE TRIGGER reminders_updated_at BEFORE UPDATE ON public.reminders
      FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END $$;
