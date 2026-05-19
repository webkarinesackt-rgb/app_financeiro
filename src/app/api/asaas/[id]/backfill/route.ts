import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { listPayments, paginate, type AsaasEnv, type AsaasPayment, type AsaasPaymentStatus } from '@/lib/asaas/client'

// Importa cobranças passadas (RECEIVED + CONFIRMED) da conta Asaas.
// Chamado manualmente pela tela /settings/integrations.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: integrationId } = await params

  // Autenticação do usuário — só o owner da integração pode rodar backfill.
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

  let imported = 0
  let failed = 0
  let firstError: string | null = null
  const statuses: AsaasPaymentStatus[] = ['RECEIVED', 'CONFIRMED']

  for (const status of statuses) {
    const iter = paginate<AsaasPayment>((offset) =>
      listPayments(env, integration.api_key, { status, limit: 100, offset }),
    )

    for await (const p of iter) {
      const txDate = p.paymentDate ?? p.clientPaymentDate ?? p.dateCreated
      const { error } = await admin
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

  return NextResponse.json({ ok: true, imported, failed, firstError })
}

function mapBillingType(t: AsaasPayment['billingType']): string | null {
  switch (t) {
    case 'PIX': return 'pix'
    case 'BOLETO': return 'boleto'
    case 'CREDIT_CARD': return 'credit'
    default: return null
  }
}
