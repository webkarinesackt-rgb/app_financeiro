import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { listTransfers, paginate, type AsaasEnv, type AsaasTransfer } from '@/lib/asaas/client'
import { isFysiTransfer, mapTransferToExpense } from '@/lib/asaas/transfers'

// Vercel: máximo permitido pro plano Pro.
export const maxDuration = 60

// Importa transferências de saída (DONE) da conta Asaas como despesas.
// Ignora as transferências para a própria Fysi (movimentação interna).
// UPSERT idempotente por (integration_id, external_id).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: integrationId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { data: integration, error: intErr } = await supabase
    .from('asaas_integrations')
    .select('id, user_id, account_id, api_key, environment')
    .eq('id', integrationId)
    .single()

  if (intErr || !integration) {
    return NextResponse.json({ error: 'integration not found' }, { status: 404 })
  }

  const admin = createAdminClient()
  const env = integration.environment as AsaasEnv
  const apiKey = integration.api_key

  const url = new URL(request.url)
  const fromParam = url.searchParams.get('from')
  const toParam = url.searchParams.get('to')

  let imported = 0
  let failed = 0
  let ignoredFysi = 0
  let firstError: string | null = null

  const iter = paginate<AsaasTransfer>((offset) =>
    listTransfers(env, apiKey, {
      limit: 100,
      offset,
      ...(fromParam ? { dateCreatedGe: fromParam } : {}),
      ...(toParam ? { dateCreatedLe: toParam } : {}),
    }),
  )

  const batch: Array<Record<string, unknown>> = []
  const BATCH_SIZE = 100

  const flush = async () => {
    if (batch.length === 0) return
    const { error } = await admin
      .from('transactions')
      .upsert(batch, { onConflict: 'integration_id,external_id' })
    if (error) {
      console.error('[backfill-expenses] batch upsert error:', error)
      if (!firstError) firstError = `${error.code ?? ''} ${error.message}`.trim()
      failed += batch.length
    } else {
      imported += batch.length
    }
    batch.length = 0
  }

  for await (const t of iter) {
    if (t.status !== 'DONE') continue
    if (isFysiTransfer(t)) { ignoredFysi++; continue }

    const m = mapTransferToExpense(t)
    batch.push({
      user_id: integration.user_id,
      workspace: 'business',
      type: m.type,
      amount: m.amount,
      description: m.description,
      category: m.category,
      custom_category: m.custom_category,
      date: m.date,
      account_id: integration.account_id,
      payment_method: m.payment_method,
      integration_id: integration.id,
      external_id: t.id,
      notes: m.notes,
    })

    if (batch.length >= BATCH_SIZE) await flush()
  }
  await flush()

  return NextResponse.json({
    ok: true,
    imported,
    failed,
    ignoredFysi,
    firstError,
    range: { from: fromParam, to: toParam },
  })
}
