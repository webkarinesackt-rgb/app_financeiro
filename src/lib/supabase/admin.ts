import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Cliente admin do Supabase. Usa a SERVICE_ROLE_KEY — bypassa RLS.
// SOMENTE para uso server-side (webhooks, cron, server actions).
// Nunca importar isso em código que roda no browser.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error('Faltam env vars NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY')
  }
  return createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
