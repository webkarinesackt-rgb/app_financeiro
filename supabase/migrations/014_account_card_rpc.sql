-- ============================================================
-- FinançasPRO — Migration 014: RPC functions pra accounts/credit_cards
--
-- Motivo: PostgREST tem schema cache que pode ficar stale após DDL
-- (ALTER TABLE ... ADD COLUMN workspace). Resultado: PGRST204 ao
-- inserir explicitando workspace.
--
-- Solução: funções SQL que recebem todos os campos como parâmetros
-- e inserem diretamente. O cache de funções do PostgREST é separado
-- e atualiza independente do cache de colunas, então isso é robusto.
--
-- Idempotente: CREATE OR REPLACE.
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_account_v1(
  p_name TEXT,
  p_type TEXT,
  p_kind TEXT,
  p_bank TEXT,
  p_color TEXT,
  p_initial_balance NUMERIC,
  p_include_in_total BOOLEAN,
  p_workspace TEXT
)
RETURNS SETOF public.accounts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  RETURN QUERY
  INSERT INTO public.accounts (
    user_id, workspace, name, type, kind, bank, color,
    initial_balance, include_in_total
  ) VALUES (
    v_user_id,
    COALESCE(p_workspace, 'business'),
    p_name, p_type, p_kind, p_bank, p_color,
    COALESCE(p_initial_balance, 0),
    COALESCE(p_include_in_total, TRUE)
  )
  RETURNING *;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_account_v1(
  TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, BOOLEAN, TEXT
) TO authenticated;


CREATE OR REPLACE FUNCTION public.create_credit_card_v1(
  p_name TEXT,
  p_bank TEXT,
  p_color TEXT,
  p_credit_limit NUMERIC,
  p_closing_day INT,
  p_due_day INT,
  p_workspace TEXT
)
RETURNS SETOF public.credit_cards
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  RETURN QUERY
  INSERT INTO public.credit_cards (
    user_id, workspace, name, bank, color,
    credit_limit, closing_day, due_day
  ) VALUES (
    v_user_id,
    COALESCE(p_workspace, 'business'),
    p_name, p_bank, p_color,
    COALESCE(p_credit_limit, 0),
    p_closing_day,
    p_due_day
  )
  RETURNING *;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_credit_card_v1(
  TEXT, TEXT, TEXT, NUMERIC, INT, INT, TEXT
) TO authenticated;

-- Reload schema cache do PostgREST pra reconhecer as novas funções
NOTIFY pgrst, 'reload schema';
