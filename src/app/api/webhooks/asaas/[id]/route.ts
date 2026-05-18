import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { AsaasPayment } from '@/lib/asaas/client'

// Eventos que disparam criação de transação (cobrança efetivamente paga).
const INGEST_EVENTS = new Set(['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED'])

interface AsaasWebhookBody {
  event: string
  payment?: AsaasPayment
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: integrationId } = await params

  const admin = createAdminClient()

  // 1. Carrega a integração — precisamos do webhook_token, account_id e user_id.
  const { data: integration, error: intErr } = await admin
    .from('asaas_integrations')
    .select('id, user_id, account_id, webhook_token, active')
    .eq('id', integrationId)
    .single()

  if (intErr || !integration) {
    return NextResponse.json({ error: 'integration not found' }, { status: 404 })
  }
  if (!integration.active) {
    return NextResponse.json({ error: 'integration disabled' }, { status: 403 })
  }

  // 2. Valida o token. Asaas envia em `asaas-access-token` (config do painel).
  const token = request.headers.get('asaas-access-token')
  if (!token || token !== integration.webhook_token) {
    return NextResponse.json({ error: 'invalid token' }, { status: 401 })
  }

  // 3. Parse do body.
  let body: AsaasWebhookBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  // 4. Eventos fora do escopo: respondemos 200 pra Asaas não reenviar.
  if (!INGEST_EVENTS.has(body.event) || !body.payment) {
    return NextResponse.json({ ok: true, ignored: body.event })
  }

  const p = body.payment

  // 5. Upsert idempotente — chave única (integration_id, external_id).
  const txDate = p.paymentDate ?? p.clientPaymentDate ?? p.dateCreated
  const { error: upsertErr } = await admin
    .from('transactions')
    .upsert(
      {
        user_id: integration.user_id,
        type: 'income',
        amount: p.value,
        description: p.description?.trim() || `Cobrança Asaas ${p.id}`,
        category: 'other',
        date: txDate,
        account_id: integration.account_id,
        payment_method: mapBillingType(p.billingType),
        integration_id: integration.id,
        external_id: p.id,
        notes: `Asaas ${p.billingType} • status ${p.status}`,
      },
      { onConflict: 'integration_id,external_id' },
    )

  if (upsertErr) {
    console.error('[asaas webhook] upsert error:', upsertErr)
    return NextResponse.json({ error: upsertErr.message }, { status: 500 })
  }

  // 6. Atualiza last_sync_at — não bloqueia se falhar.
  await admin
    .from('asaas_integrations')
    .update({ last_sync_at: new Date().toISOString() })
    .eq('id', integration.id)

  return NextResponse.json({ ok: true, paymentId: p.id })
}

function mapBillingType(t: AsaasPayment['billingType']): string | null {
  switch (t) {
    case 'PIX': return 'pix'
    case 'BOLETO': return 'boleto'
    case 'CREDIT_CARD': return 'credit'
    default: return null
  }
}
