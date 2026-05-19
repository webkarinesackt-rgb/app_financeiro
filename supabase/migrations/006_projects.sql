-- ============================================================
-- FinançasPRO — Migration 006: Projetos e parcelas previstas
--   project_types: lista de tipos definida pelo usuário (Site, Consultoria, ...)
--   projects: contratos/projetos com receita prevista
--   project_installments: parcelas previstas (cada uma marcável como recebida)
-- Idempotente.
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

-- ── projects ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.projects (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  client_name         TEXT,
  project_type_id     UUID REFERENCES public.project_types(id) ON DELETE SET NULL,
  total_value         NUMERIC(12,2) NOT NULL CHECK (total_value > 0),
  payment_method      TEXT NOT NULL CHECK (payment_method IN ('pix','installments','other')),
  installments_count  INT,
  start_date          DATE NOT NULL DEFAULT CURRENT_DATE,
  status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','cancelled')),
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS projects_user_status_idx ON public.projects (user_id, status);

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

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='projects_updated_at') THEN
    CREATE TRIGGER projects_updated_at BEFORE UPDATE ON public.projects
      FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END $$;

-- ── project_installments ─────────────────────────────────────
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

CREATE INDEX IF NOT EXISTS pi_project_idx ON public.project_installments (project_id, sequence);
CREATE INDEX IF NOT EXISTS pi_user_pending_idx ON public.project_installments (user_id, due_date) WHERE paid = FALSE;

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
