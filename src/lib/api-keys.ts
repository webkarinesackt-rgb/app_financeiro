import { createClient } from '@/lib/supabase/client'
import { createHash, randomBytes } from 'crypto'

export type ApiScope =
  | 'read:all'
  | 'read:transactions'
  | 'read:accounts'
  | 'read:balances'
  | 'read:closings'
  | 'write:transactions'

export interface ApiKey {
  id: string
  user_id: string
  name: string
  prefix: string
  secret_hash: string
  scopes: ApiScope[]
  workspace: 'business' | 'personal' | null
  expires_at: string | null
  last_used_at: string | null
  revoked_at: string | null
  created_at: string
  updated_at: string
}

export interface CreatedApiKey {
  key: ApiKey
  /** Secret completo. Mostrado apenas uma vez na criação. */
  fullKey: string
}

// Gera um secret seguro de 32 bytes em base64url (~43 chars).
function generateSecret(): string {
  return randomBytes(32).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex')
}

// Gera prefix curto e único (8 chars hex, prefixados com "ak_").
function generatePrefix(): string {
  return 'ak_' + randomBytes(4).toString('hex')
}

export async function listApiKeys(): Promise<ApiKey[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('api_keys')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as ApiKey[]
}

export async function createApiKey(input: {
  name: string
  scopes: ApiScope[]
  workspace?: 'business' | 'personal' | null
  expiresAt?: string | null
}): Promise<CreatedApiKey> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const prefix = generatePrefix()
  const secret = generateSecret()
  const fullKey = `${prefix}_${secret}`
  const secret_hash = sha256(fullKey)

  const { data, error } = await supabase
    .from('api_keys')
    .insert({
      user_id: user.id,
      name: input.name,
      prefix,
      secret_hash,
      scopes: input.scopes,
      workspace: input.workspace ?? null,
      expires_at: input.expiresAt ?? null,
    })
    .select()
    .single()
  if (error) throw error

  return { key: data as ApiKey, fullKey }
}

export async function revokeApiKey(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function deleteApiKey(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('api_keys').delete().eq('id', id)
  if (error) throw error
}

export { sha256 }
