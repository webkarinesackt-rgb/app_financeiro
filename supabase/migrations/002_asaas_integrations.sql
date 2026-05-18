-- ============================================================
-- FinançasPRO — Migration 002: Asaas integrations
-- Idempotente. Pode rodar múltiplas vezes.
-- ============================================================

-- ── Tabela asaas_integrations ─────────────────────────────────
-- Armazena as conexões com contas Asaas (uma linha por conta).
-- A api_key fica protegida por RLS — só o owner consegue ler/escrever.
CREATE TABLE IF NOT EXISTS public.asaas_integrations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id     UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  name           TEXT NOT NULL,
  environment    TEXT NOT NULL DEFAULT 'production' CHECK (environment IN ('production','sandbox')),
  api_key        TEXT NOT NULL,
  webhook_token  TEXT NOT NULL,
  active         BOOLEAN NOT NULL DEFAULT TRUE,
  last_sync_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.asaas_integrations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='asaas_integrations' AND policyname='asaas_select') THEN
    CREATE POLICY "asaas_select" ON public.asaas_integrations FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='asaas_integrations' AND policyname='asaas_insert') THEN
    CREATE POLICY "asaas_insert" ON public.asaas_integrations FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='asaas_integrations' AND policyname='asaas_update') THEN
    CREATE POLICY "asaas_update" ON public.asaas_integrations FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='asaas_integrations' AND policyname='asaas_delete') THEN
    CREATE POLICY "asaas_delete" ON public.asaas_integrations FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='asaas_integrations_updated_at') THEN
    CREATE TRIGGER asaas_integrations_updated_at BEFORE UPDATE ON public.asaas_integrations
      FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END $$;

-- ── Colunas em transactions pra rastrear origem externa ───────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='external_id' AND table_schema='public') THEN
    ALTER TABLE public.transactions ADD COLUMN external_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='integration_id' AND table_schema='public') THEN
    ALTER TABLE public.transactions ADD COLUMN integration_id UUID REFERENCES public.asaas_integrations(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Idempotência: webhook pode receber a mesma cobrança várias vezes.
-- Combinação (integration_id, external_id) precisa ser única quando ambos preenchidos.
CREATE UNIQUE INDEX IF NOT EXISTS transactions_integration_external_unique
  ON public.transactions (integration_id, external_id)
  WHERE external_id IS NOT NULL AND integration_id IS NOT NULL;
