-- ============================================================
-- Migration 013: Force PostgREST schema cache reload
--   After migration 012 added the `workspace` column, PostgREST
--   may still have a stale introspection cache that makes
--   `.eq('workspace', ...)` filters fail with PGRST204.
--   This NOTIFY forces PostgREST to reload its schema cache
--   immediately when this migration runs.
-- ============================================================

NOTIFY pgrst, 'reload schema';
