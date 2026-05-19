-- ============================================================
-- FinançasPRO — Migration 007: Projects + CRM (Fechamentos)
--   Self-contained: cria projects/project_types/project_installments
--   se não existirem, e estende projects com campos CRM
--   (canal, mercado, modelo de negócio, segmento, whatsapp).
-- Idempotente: pode rodar várias vezes sem erro.
-- ============================================================

-- ── project_types ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.project_types (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT '#10b981',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.project_types ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='project_types' AND policyname='pt_select') THEN
    CREATE POLICY "pt_select" ON public.project_types FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='project_types' AND policyname='pt_insert') THEN
    CREATE POLICY "pt_insert" ON public.project_types FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='project_types' AND policyname='pt_update') THEN
    CREATE POLICY "pt_update" ON public.project_types FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='project_types' AND policyname='pt_delete') THEN
    CREATE POLICY "pt_delete" ON public.project_types FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- ── projects (tabela base + colunas CRM já incluídas) ────────
CREATE TABLE IF NOT EXISTS public.projects (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  client_name         TEXT,
  project_type_id     UUID REFERENCES public.project_types(id) ON DELETE SET NULL,
  total_value         NUMERIC(12,2) NOT NULL CHECK (total_value > 0),
  payment_method      TEXT,
  installments_count  INT,
  start_date          DATE NOT NULL DEFAULT CURRENT_DATE,
  status              TEXT NOT NULL DEFAULT 'closed',
  notes               TEXT,
  channel             TEXT,
  market              TEXT,
  business_model      TEXT,
  segment             TEXT,
  whatsapp            TEXT,
  project_kind        TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Para quem já tinha projects da 006: adiciona colunas CRM ─
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS channel         TEXT;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS market          TEXT;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS business_model  TEXT;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS segment         TEXT;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS whatsapp        TEXT;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS project_kind    TEXT;

-- ── payment_method opcional (Fechamentos não exigem método) ──
ALTER TABLE public.projects ALTER COLUMN payment_method DROP NOT NULL;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'projects_payment_method_check'
  ) THEN
    ALTER TABLE public.projects DROP CONSTRAINT projects_payment_method_check;
  END IF;
END $$;

ALTER TABLE public.projects ADD CONSTRAINT projects_payment_method_check
  CHECK (payment_method IS NULL OR payment_method IN ('pix','installments','other'));

-- ── Status do funil (closed/in_production/delivered/paid/cancelled) ──
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'projects_status_check'
  ) THEN
    ALTER TABLE public.projects DROP CONSTRAINT projects_status_check;
  END IF;
END $$;

UPDATE public.projects SET status = 'closed' WHERE status = 'active';
UPDATE public.projects SET status = 'paid'   WHERE status = 'completed';

ALTER TABLE public.projects ALTER COLUMN status SET DEFAULT 'closed';

ALTER TABLE public.projects ADD CONSTRAINT projects_status_check
  CHECK (status IN ('closed','in_production','delivered','paid','cancelled'));

-- ── RLS + policies ───────────────────────────────────────────
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='projects' AND policyname='proj_select') THEN
    CREATE POLICY "proj_select" ON public.projects FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='projects' AND policyname='proj_insert') THEN
    CREATE POLICY "proj_insert" ON public.projects FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='projects' AND policyname='proj_update') THEN
    CREATE POLICY "proj_update" ON public.projects FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='projects' AND policyname='proj_delete') THEN
    CREATE POLICY "proj_delete" ON public.projects FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- ── Trigger updated_at (cria função se não existir) ──────────
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='projects_updated_at') THEN
    CREATE TRIGGER projects_updated_at BEFORE UPDATE ON public.projects
      FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END $$;

-- ── project_installments (opcional, para parcelas previstas) ─
CREATE TABLE IF NOT EXISTS public.project_installments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sequence        INT NOT NULL,
  due_date        DATE NOT NULL,
  amount          NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  paid            BOOLEAN NOT NULL DEFAULT FALSE,
  paid_at         TIMESTAMPTZ,
  transaction_id  UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.project_installments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='project_installments' AND policyname='pi_select') THEN
    CREATE POLICY "pi_select" ON public.project_installments FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='project_installments' AND policyname='pi_insert') THEN
    CREATE POLICY "pi_insert" ON public.project_installments FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='project_installments' AND policyname='pi_update') THEN
    CREATE POLICY "pi_update" ON public.project_installments FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='project_installments' AND policyname='pi_delete') THEN
    CREATE POLICY "pi_delete" ON public.project_installments FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- ── Índices úteis para o dashboard mensal ────────────────────
CREATE INDEX IF NOT EXISTS projects_user_status_idx
  ON public.projects (user_id, status);
CREATE INDEX IF NOT EXISTS projects_user_start_idx
  ON public.projects (user_id, start_date DESC);
CREATE INDEX IF NOT EXISTS projects_user_channel_idx
  ON public.projects (user_id, channel);
CREATE INDEX IF NOT EXISTS pi_project_idx
  ON public.project_installments (project_id, sequence);
CREATE INDEX IF NOT EXISTS pi_user_pending_idx
  ON public.project_installments (user_id, due_date) WHERE paid = FALSE;
