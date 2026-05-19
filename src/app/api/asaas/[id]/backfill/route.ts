import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { listPayments, getCustomer, paginate, type AsaasEnv, type AsaasPayment, type AsaasPaymentStatus } from '@/lib/asaas/client'
import { buildDescription } from '@/lib/asaas/description'

// Vercel: backfill com customer-lookup pode passar de 10s — estende pro máximo.
export const maxDuration = 60

// Importa cobranças passadas (RECEIVED + CONFIRMED) da conta Asaas.
// UPSERT — re-rodar atualiza descrições com nome do cliente.
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
  const apiKey = integration.api_key  // capturado p/ TS narrowing dentro do closure

  let imported = 0
  let failed = 0
  let firstError: string | null = null
  // Cache de nomes de clientes (mesma instância da chamada — economiza ~95% das chamadas /customers)
  const customerCache = new Map<string, string>()

  async function nameOf(customerId: string): Promise<string> {
    let name = customerCache.get(customerId)
    if (name !== undefined) return name
    try {
      const c = await getCustomer(env, apiKey, customerId)
      name = c.name ?? ''
    } catch {
      name = ''
    }
    customerCache.set(customerId, name)
    return name
  }

  // Regime de caixa: apenas RECEIVED (dinheiro já em conta) e RECEIVED_IN_CASH.
  // CONFIRMED = pago pelo cliente mas aguardando repasse — aparece em
  // /api/asaas/awaiting-settlement, NÃO entra como transação realizada.
  // Importar CONFIRMED inflava o caixa com parcelas futuras de cartão.
  const statuses: AsaasPaymentStatus[] = ['RECEIVED', 'RECEIVED_IN_CASH']

  for (const status of statuses) {
    const iter = paginate<AsaasPayment>((offset) =>
      listPayments(env, integration.api_key, { status, limit: 100, offset }),
    )

    for await (const p of iter) {
      const customerName = await nameOf(p.customer)
      // Asaas desconta taxa por método (PIX/boleto/cartão) — netValue é o líquido em conta.
      const netValue = p.netValue ?? p.value
      const fee = p.value - netValue
      const txDate = p.paymentDate ?? p.clientPaymentDate ?? p.dateCreated
      const { error } = await admin
        .from('transactions')
        .upsert(
          {
            user_id: integration.user_id,
            type: 'income',
            amount: netValue,
            description: buildDescription(customerName, p.description),
            category: 'other',
            date: txDate,
            account_id: integration.account_id,
            payment_method: mapBillingType(p.billingType),
            integration_id: integration.id,
            external_id: p.id,
            notes: `Asaas ${p.billingType} • ${p.status}${customerName ? ` • ${customerName}` : ''} • bruto R$ ${p.value.toFixed(2)} • taxa R$ ${fee.toFixed(2)}`,
          },
          { onConflict: 'integration_id,external_id' },
        )
      if (error) {
        console.error('[backfill] upsert error:', error, p.id)
        if (!firstError) firstError = `${error.code ?? ''} ${error.message}`.trim()
        failed++
      } else {
        imported++
      }
    }
  }

  await admin
    .from('asaas_integrations')
    .update({ last_sync_at: new Date().toISOString() })
    .eq('id', integration.id)

  return NextResponse.json({ ok: true, imported, failed, firstError, uniqueCustomers: customerCache.size })
}

function mapBillingType(t: AsaasPayment['billingType']): string | null {
  switch (t) {
    case 'PIX': return 'pix'
    case 'BOLETO': return 'boleto'
    case 'CREDIT_CARD': return 'credit'
    default: return null
  }
}
