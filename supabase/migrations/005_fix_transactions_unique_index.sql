-- ============================================================
-- FinançasPRO — Migration 005: Fix unique index para upsert
-- O índice criado na migration 002 era PARTIAL (com WHERE),
-- e Postgres não aceita partial index como alvo de ON CONFLICT.
-- Recriamos como índice normal — NULLs são distintos por default,
-- então transações antigas sem integration_id/external_id continuam OK.
-- ============================================================

DROP INDEX IF EXISTS public.transactions_integration_external_unique;

CREATE UNIQUE INDEX IF NOT EXISTS transactions_integration_external_unique
  ON public.transactions (integration_id, external_id);
