// Middleware de autenticação pros endpoints /api/v1/*.
// Valida `Authorization: Bearer ak_XXXX_<secret>` consultando a RPC
// validate_api_key (SECURITY DEFINER, bypassa RLS). Retorna o contexto
// resolvido (user_id, scopes, workspace) ou erro 401.

import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import type { ApiScope } from '@/lib/api-keys'

export interface ApiContext {
  userId: string
  scopes: ApiScope[]
  workspace: 'business' | 'personal' | null
  keyId: string
}

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex')
}

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  if (!url || !key) throw new Error('Supabase env vars ausentes')
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function authenticateApiRequest(req: Request): Promise<
  { ok: true; ctx: ApiContext } | { ok: false; status: number; error: string }
> {
  const auth = req.headers.get('authorization') ?? req.headers.get('Authorization')
  if (!auth) return { ok: false, status: 401, error: 'Missing Authorization header' }

  const match = auth.match(/^Bearer\s+(ak_[a-f0-9]{8})_(.+)$/)
  if (!match) return { ok: false, status: 401, error: 'Invalid token format. Expected: Bearer ak_XXXXXXXX_<secret>' }

  const prefix = match[1]
  const fullKey = `${prefix}_${match[2]}`
  const secretHash = sha256(fullKey)

  const sb = getServiceClient()
  const { data, error } = await sb.rpc('validate_api_key', {
    p_prefix: prefix,
    p_secret_hash: secretHash,
  })

  if (error) return { ok: false, status: 500, error: 'Validation failed: ' + error.message }
  if (!data || !Array.isArray(data) || data.length === 0) {
    return { ok: false, status: 401, error: 'Invalid or revoked API key' }
  }

  const row = data[0]
  // Atualiza last_used_at em background (não bloqueia request)
  sb.from('api_keys').update({ last_used_at: new Date().toISOString() })
    .eq('id', row.key_id).then(() => {}, () => {})

  return {
    ok: true,
    ctx: {
      userId: row.user_id,
      scopes: row.scopes as ApiScope[],
      workspace: row.workspace,
      keyId: row.key_id,
    },
  }
}

export function hasScope(ctx: ApiContext, required: ApiScope): boolean {
  return ctx.scopes.includes('read:all') || ctx.scopes.includes(required)
}

export function jsonError(status: number, error: string) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export function jsonOk(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export { getServiceClient }
