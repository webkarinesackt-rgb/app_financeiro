-- ============================================================
-- FinançasPRO — Migration 016: tag "a cobrar" em fechamentos
--
-- projects.mark_to_collect (BOOLEAN) — quando true, o fechamento aparece
-- explicitamente na lista de /a-cobrar mesmo que o status seja outro
-- (ex: 'in_production', 'delivered') ou que o sistema não tenha detectado
-- o pagamento automaticamente.
--
-- Idempotente.
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='projects' AND column_name='mark_to_collect'
  ) THEN
    ALTER TABLE public.projects
      ADD COLUMN mark_to_collect BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS projects_mark_to_collect_idx
  ON public.projects (user_id, mark_to_collect)
  WHERE mark_to_collect = TRUE;

NOTIFY pgrst, 'reload schema';
