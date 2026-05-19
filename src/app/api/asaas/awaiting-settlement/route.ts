import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { listPayments, type AsaasEnv } from '@/lib/asaas/client'

// Cobranças CONFIRMED no Asaas — já pagas mas aguardando compensação/repasse.
// Para PIX/Boleto: ~2 dias úteis. Para cartão parcelado: cai mês a mês até
// completar todas as parcelas. Por isso quebramos também por MÊS.

interface ByIntegration {
  id: string
  name: string
  total: number
  count: number
}

interface ByMonth {
  month: string       // 'YYYY-MM'
  monthLabel: string  // 'Jun/2026'
  total: number
  count: number
}

const MONTHS_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function monthLabel(key: string): string {
  const [y, m] = key.split('-')
  return `${MONTHS_PT[Number(m) - 1]}/${y.slice(2)}`
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: integrations, error } = await admin
    .from('asaas_integrations')
    .select('id, name, environment, api_key')
    .eq('user_id', user.id)
    .eq('active', true)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!integrations?.length) {
    return NextResponse.json({ total: 0, count: 0, byIntegration: [], byMonth: [] })
  }

  const integrationBuckets = new Map<string, ByIntegration>()
  const monthBuckets = new Map<string, ByMonth>()
  let total = 0
  let count = 0

  await Promise.all(
    integrations.map(async (int) => {
      const env = int.environment as AsaasEnv
      let offset = 0
      integrationBuckets.set(int.id, { id: int.id, name: int.name, total: 0, count: 0 })
      while (true) {
        let page
        try {
          page = await listPayments(env, int.api_key, { status: 'CONFIRMED', limit: 100, offset })
        } catch (e) {
          console.error('[awaiting-settlement]', int.name, e)
          break
        }
        for (const p of page.data) {
          const b = integrationBuckets.get(int.id)!
          b.total += p.value
          b.count += 1
          total += p.value
          count += 1

          // Mês de repasse: usa paymentDate (data agendada do repasse) ou
          // dueDate (vencimento da parcela) como fallback.
          const dateKey = (p.paymentDate ?? p.dueDate ?? p.dateCreated).slice(0, 7)
          const m = monthBuckets.get(dateKey) ?? {
            month: dateKey,
            monthLabel: monthLabel(dateKey),
            total: 0,
            count: 0,
          }
          m.total += p.value
          m.count += 1
          monthBuckets.set(dateKey, m)
        }
        if (!page.hasMore) break
        offset += page.limit
      }
    }),
  )

  const byMonth = Array.from(monthBuckets.values()).sort((a, b) => a.month.localeCompare(b.month))

  return NextResponse.json({
    total,
    count,
    byIntegration: Array.from(integrationBuckets.values()).filter((b) => b.count > 0),
    byMonth,
  })
}
