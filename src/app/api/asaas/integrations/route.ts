import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Mascara a api_key — só os 4 últimos chars saem pro browser.
function maskKey(key: string): string {
  return key ? `••••${key.slice(-4)}` : ''
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // Lemos a api_key apenas pra truncar — nunca devolvemos a key inteira.
  const { data, error } = await supabase
    .from('asaas_integrations')
    .select('id, account_id, name, environment, webhook_token, active, last_sync_at, api_key, created_at')
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const masked = (data ?? []).map(({ api_key, ...rest }) => ({
    ...rest,
    api_key_last4: maskKey(api_key),
  }))
  return NextResponse.json(masked)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body: { name?: string; environment?: string; api_key?: string; account_id?: string | null }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }) }

  const name = body.name?.trim()
  const apiKey = body.api_key?.trim()
  const env = body.environment === 'sandbox' ? 'sandbox' : 'production'
  if (!name) return NextResponse.json({ error: 'name obrigatório' }, { status: 400 })
  if (!apiKey) return NextResponse.json({ error: 'api_key obrigatória' }, { status: 400 })

  const admin = createAdminClient()

  // Se não veio account_id, cria uma conta nova com o nome da integração.
  let accountId = body.account_id ?? null
  if (!accountId) {
    const { data: acc, error: accErr } = await admin
      .from('accounts')
      .insert({
        user_id: user.id,
        name,
        type: 'checking',
        bank: 'asaas',
        color: '#06b6d4',
      })
      .select('id')
      .single()
    if (accErr) return NextResponse.json({ error: `criar conta: ${accErr.message}` }, { status: 500 })
    accountId = acc.id
  }

  const webhookToken = randomBytes(32).toString('hex')

  const { data: integration, error: intErr } = await admin
    .from('asaas_integrations')
    .insert({
      user_id: user.id,
      account_id: accountId,
      name,
      environment: env,
      api_key: apiKey,
      webhook_token: webhookToken,
      active: true,
    })
    .select('id, account_id, name, environment, webhook_token, active, last_sync_at, created_at')
    .single()

  if (intErr) return NextResponse.json({ error: intErr.message }, { status: 500 })

  return NextResponse.json({ ...integration, api_key_last4: maskKey(apiKey) }, { status: 201 })
}
