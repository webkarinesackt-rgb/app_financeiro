import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCustomer, type AsaasEnv, type AsaasPayment } from '@/lib/asaas/client'
import { buildDescription } from '@/lib/asaas/description'

// Regime de caixa: só ingerimos quando o dinheiro de fato entra na conta
// (PAYMENT_RECEIVED). PAYMENT_CONFIRMED é "cliente pagou mas aguardando
// repasse" — relevante pra forecast em /api/asaas/awaiting-settlement,
// mas NÃO deve virar transação realizada (parcelas futuras inflam o caixa).
const INGEST_EVENTS = new Set(['PAYMENT_RECEIVED', 'PAYMENT_RECEIVED_IN_CASH'])

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

  // 1. Carrega a integração — webhook_token p/ validar, api_key p/ buscar cliente.
  const { data: integration, error: intErr } = await admin
    .from('asaas_integrations')
    .select('id, user_id, account_id, webhook_token, active, api_key, environment')
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

  // 5. Busca o nome do cliente pra descrição. Falha silenciosa se não rolar.
  let customerName = ''
  try {
    const c = await getCustomer(integration.environment as AsaasEnv, integration.api_key, p.customer)
    customerName = c.name ?? ''
  } catch (e) {
    console.warn('[asaas webhook] customer fetch failed:', e)
  }

  // 6. Upsert idempotente. Usamos netValue (o que cai na conta após taxa do Asaas).
  const netValue = (p.netValue != null && p.netValue > 0) ? p.netValue : p.value
  const fee = p.value - netValue
  const txDate = p.paymentDate ?? p.clientPaymentDate ?? p.dateCreated
  const { error: upsertErr } = await admin
    .from('transactions')
    .upsert(
      {
        user_id: integration.user_id,
        workspace: 'business',
        type: 'income',
        amount: netValue,
        description: buildDescription(customerName, p.description),
        // Categorização default: Asaas = serviço de Landing Page / Site.
        // Subdivisão por tipo de projeto (subcategory) é feita manualmente em /transactions.
        category: 'custom',
        custom_category: 'Receita Landing Page / Site',
        date: txDate,
        account_id: integration.account_id,
        payment_method: mapBillingType(p.billingType),
        integration_id: integration.id,
        external_id: p.id,
        notes: `Asaas ${p.billingType} • ${p.status}${customerName ? ` • ${customerName}` : ''} • bruto R$ ${p.value.toFixed(2)} • taxa R$ ${fee.toFixed(2)}`,
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
