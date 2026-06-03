-- ============================================================
-- FinançasPRO — Migration 015: Notes (anotações livres)
-- Anotações de texto sem relação direta com transações.
-- Cada nota pertence a um workspace (business/personal).
-- Idempotente.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace   TEXT NOT NULL DEFAULT 'business' CHECK (workspace IN ('business','personal')),
  title       TEXT NOT NULL,
  body        TEXT,
  pinned      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notes_user_workspace_idx
  ON public.notes (user_id, workspace, pinned DESC, created_at DESC);

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notes' AND policyname='notes_select') THEN
    CREATE POLICY "notes_select" ON public.notes FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notes' AND policyname='notes_insert') THEN
    CREATE POLICY "notes_insert" ON public.notes FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notes' AND policyname='notes_update') THEN
    CREATE POLICY "notes_update" ON public.notes FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notes' AND policyname='notes_delete') THEN
    CREATE POLICY "notes_delete" ON public.notes FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='notes_updated_at') THEN
    CREATE TRIGGER notes_updated_at BEFORE UPDATE ON public.notes
      FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
