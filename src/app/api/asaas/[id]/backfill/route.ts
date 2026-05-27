import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { listPayments, listCustomers, paginate, type AsaasEnv, type AsaasPayment, type AsaasPaymentStatus } from '@/lib/asaas/client'
import { buildDescription } from '@/lib/asaas/description'

// Vercel: máximo permitido pro plano Pro.
export const maxDuration = 60

// Importa cobranças passadas (RECEIVED + RECEIVED_IN_CASH) da conta Asaas.
// UPSERT idempotente — pode rodar várias vezes sem duplicar.
//
// Otimizações pra evitar FUNCTION_INVOCATION_TIMEOUT:
//   1) Pre-carrega TODOS os clientes em paralelo (1 chamada paginada vs N)
//   2) Aceita ?from=YYYY-MM-DD&to=YYYY-MM-DD pra processar chunks (default: 12 meses)
//   3) Insere em batches de 100 com upsert único
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

  // ─── Date range opcional ─────────────────────────────────────────────
  const url = new URL(request.url)
  const fromParam = url.searchParams.get('from')
  const toParam = url.searchParams.get('to')

  let imported = 0
  let failed = 0
  let firstError: string | null = null

  // ─── 1. Pre-carrega TODOS os clientes (1 query paginada) ─────────────
  const customerCache = new Map<string, string>()
  try {
    let offset = 0
    while (true) {
      const page = await listCustomers(env, apiKey, { limit: 100, offset })
      for (const c of page.data) {
        if (c.id) customerCache.set(c.id, c.name ?? '')
      }
      if (!page.hasMore) break
      offset += page.limit
    }
  } catch (e) {
    console.warn('[backfill] falha ao pré-carregar clientes, vai cair pra lookup individual', e)
  }

  function nameOf(customerId: string): string {
    return customerCache.get(customerId) ?? ''
  }

  // Regime de caixa: apenas RECEIVED (dinheiro já em conta) e RECEIVED_IN_CASH.
  // CONFIRMED = pago pelo cliente mas aguardando repasse — aparece em
  // /api/asaas/awaiting-settlement, NÃO entra como transação realizada.
  // Importar CONFIRMED inflava o caixa com parcelas futuras de cartão.
  const statuses: AsaasPaymentStatus[] = ['RECEIVED', 'RECEIVED_IN_CASH']

  // Acumula em batches e dá UPSERT no final de cada status — muito mais rápido
  // que 1 upsert por pagamento.
  for (const status of statuses) {
    const iter = paginate<AsaasPayment>((offset) =>
      listPayments(env, apiKey, {
        status,
        limit: 100,
        offset,
        ...(fromParam ? { paymentDateGe: fromParam } : {}),
        ...(toParam ? { paymentDateLe: toParam } : {}),
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
        console.error('[backfill] batch upsert error:', error)
        if (!firstError) firstError = `${error.code ?? ''} ${error.message}`.trim()
        failed += batch.length
      } else {
        imported += batch.length
      }
      batch.length = 0
    }

    for await (const p of iter) {
      const customerName = nameOf(p.customer)
      // Asaas desconta taxa por método (PIX/boleto/cartão) — netValue é o líquido em conta.
      const netValue = (p.netValue != null && p.netValue > 0) ? p.netValue : p.value
      const fee = p.value - netValue
      const txDate = p.paymentDate ?? p.clientPaymentDate ?? p.dateCreated
      const fullDesc = buildDescription(customerName, p.description)
      const { category, custom_category } = categorizeAsaas(fullDesc)

      batch.push({
        user_id: integration.user_id,
        // workspace omitted on purpose — DB DEFAULT 'business' applies.
        // Including the column triggers PGRST204 when PostgREST's schema cache
        // hasn't picked up migration 012 yet.
        type: 'income',
        amount: netValue,
        description: fullDesc,
        category,
        custom_category,
        date: txDate,
        account_id: integration.account_id,
        payment_method: mapBillingType(p.billingType),
        integration_id: integration.id,
        external_id: p.id,
        notes: `Asaas ${p.billingType} • ${p.status}${customerName ? ` • ${customerName}` : ''} • bruto R$ ${p.value.toFixed(2)} • taxa R$ ${fee.toFixed(2)}`,
      })

      if (batch.length >= BATCH_SIZE) {
        await flush()
      }
    }
    await flush()
  }

  await admin
    .from('asaas_integrations')
    .update({ last_sync_at: new Date().toISOString() })
    .eq('id', integration.id)

  return NextResponse.json({
    ok: true,
    imported,
    failed,
    firstError,
    uniqueCustomers: customerCache.size,
    range: { from: fromParam, to: toParam },
  })
}

function mapBillingType(t: AsaasPayment['billingType']): string | null {
  switch (t) {
    case 'PIX': return 'pix'
    case 'BOLETO': return 'boleto'
    case 'CREDIT_CARD': return 'credit'
    default: return null
  }
}

// Categorização padrão de pagamentos via Asaas.
// Asaas é o gateway dos clientes de serviço — tudo cai em
// "Receita Landing Page / Site". Subdivisão por tipo de projeto
// (subcategory) é feita manualmente em /transactions depois.
function categorizeAsaas(_description: string): { category: 'custom'; custom_category: string } {
  return { category: 'custom', custom_category: 'Receita Landing Page / Site' }
}
