-- ============================================================
-- FinançasPRO — Migration 014: vincula projects ao briefing_app
--
-- Adiciona briefing_app_client_id (UUID, único quando preenchido) pra
-- correlacionar um projeto/fechamento com o cliente do briefing_app.
-- Quando o briefing_app dispara webhook (contrato.assinado, pagamento.atualizado),
-- a gente busca o project pelo briefing_app_client_id e faz upsert/update.
--
-- Idempotente.
-- ============================================================

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS briefing_app_client_id UUID;

-- Único quando preenchido. Permite múltiplos NULLs (clientes manuais antigos).
CREATE UNIQUE INDEX IF NOT EXISTS projects_briefing_app_client_id_unique
  ON public.projects (briefing_app_client_id)
  WHERE briefing_app_client_id IS NOT NULL;

COMMENT ON COLUMN public.projects.briefing_app_client_id IS
  'ID do cliente no briefing_app (clients.id). Vazio em fechamentos criados manualmente. Preenchido automaticamente quando o webhook do briefing_app cria/atualiza esse fechamento.';
