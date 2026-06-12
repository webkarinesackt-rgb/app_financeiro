-- ============================================================
-- FinançasPRO — Migration 017: API Keys (integrações externas)
--
-- Permite criar chaves de API pra apps/sistemas externos consultarem
-- transações, contas, saldos, fechamentos. Cada chave:
--   - é vinculada a um user
--   - tem um prefix curto pra identificação (ak_ + 4 chars)
--   - guarda apenas o HASH SHA-256 do secret completo
--   - tem scopes (read:transactions, read:accounts, write:transactions, etc.)
--   - opcionalmente um workspace (limita a um workspace específico)
--   - opcionalmente expira (expires_at)
--   - registra última utilização (last_used_at)
--
-- O secret completo só é mostrado ao usuário 1x (na criação). Depois fica
-- guardado apenas o hash.
--
-- Idempotente.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.api_keys (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,                         -- ex: "Integração WhatsApp Bot"
  prefix       TEXT NOT NULL UNIQUE,                  -- ex: "ak_a3f9" (visível, p/ identificar)
  secret_hash  TEXT NOT NULL,                         -- SHA-256 hex do secret completo
  scopes       TEXT[] NOT NULL DEFAULT '{read:all}',  -- read:transactions, read:accounts, write:transactions, read:all
  workspace    TEXT,                                  -- null = todos workspaces; 'business' ou 'personal' = restrito
  expires_at   TIMESTAMPTZ,                           -- null = nunca expira
  last_used_at TIMESTAMPTZ,
  revoked_at   TIMESTAMPTZ,                           -- null = ativa
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS api_keys_user_idx ON public.api_keys (user_id, revoked_at);
CREATE INDEX IF NOT EXISTS api_keys_prefix_idx ON public.api_keys (prefix) WHERE revoked_at IS NULL;

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='api_keys' AND policyname='api_keys_select') THEN
    CREATE POLICY "api_keys_select" ON public.api_keys FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='api_keys' AND policyname='api_keys_insert') THEN
    CREATE POLICY "api_keys_insert" ON public.api_keys FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='api_keys' AND policyname='api_keys_update') THEN
    CREATE POLICY "api_keys_update" ON public.api_keys FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='api_keys' AND policyname='api_keys_delete') THEN
    CREATE POLICY "api_keys_delete" ON public.api_keys FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='api_keys_updated_at') THEN
    CREATE TRIGGER api_keys_updated_at BEFORE UPDATE ON public.api_keys
      FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END $$;

-- Function pro endpoint validar uma chave bypassando RLS (SECURITY DEFINER).
-- Retorna user_id, scopes, workspace se a chave for válida; null em qualquer
-- outro caso (revogada, expirada, hash não bate).
CREATE OR REPLACE FUNCTION public.validate_api_key(
  p_prefix TEXT,
  p_secret_hash TEXT
)
RETURNS TABLE(user_id UUID, scopes TEXT[], workspace TEXT, key_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT k.user_id, k.scopes, k.workspace, k.id
  FROM public.api_keys k
  WHERE k.prefix = p_prefix
    AND k.secret_hash = p_secret_hash
    AND k.revoked_at IS NULL
    AND (k.expires_at IS NULL OR k.expires_at > now());
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_api_key(TEXT, TEXT) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
