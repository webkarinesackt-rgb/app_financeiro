-- ============================================================
-- FinançasPRO — Migration 010: Subcategoria em transactions
--   Permite refinar dentro de uma custom_category (ex: dentro de
--   "Receita Landing Page / Site" temos "Landing page com copy",
--   "Programação", "Site institucional", etc).
-- Idempotente.
-- ============================================================

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS subcategory TEXT;

-- Índice pra filtros/relatórios que agrupam por subcategoria
CREATE INDEX IF NOT EXISTS transactions_user_subcategory_idx
  ON public.transactions (user_id, subcategory)
  WHERE subcategory IS NOT NULL;
