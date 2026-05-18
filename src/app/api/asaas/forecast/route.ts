import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { listPayments, type AsaasEnv, type AsaasPaymentStatus } from '@/lib/asaas/client'

// Retorna a previsão de recebimentos por mês — soma valores de cobranças
// PENDING e OVERDUE com dueDate nos próximos N meses, agrupadas por mês.
// Agrega resultados de TODAS as integrações ativas do usuário.

interface MonthForecast {
  month: string       // 'YYYY-MM'
  monthLabel: string  // 'Mai/2026'
  total: number
  count: number
  byIntegration: Record<string, { name: string; total: number; count: number }>
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const months = Number(url.searchParams.get('months') ?? 3)

  // Lista integrações ativas via cliente admin pra acessar api_key (server-only).
  const admin = createAdminClient()
  const { data: integrations, error } = await admin
    .from('asaas_integrations')
    .select('id, name, environment, api_key')
    .eq('user_id', user.id)
    .eq('active', true)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!integrations?.length) return NextResponse.json({ forecast: [], integrations: 0 })

  // Janela: do início do mês atual até fim do (mês atual + months - 1)
  const today = new Date()
  const start = new Date(today.getFullYear(), today.getMonth(), 1)
  const endDate = new Date(today.getFullYear(), today.getMonth() + months, 0)

  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  const startStr = fmt(start)
  const endStr = fmt(endDate)

  // Inicializa buckets dos meses na janela
  const buckets: Record<string, MonthForecast> = {}
  for (let i = 0; i < months; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    buckets[key] = {
      month: key,
      monthLabel: d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace('.', ''),
      total: 0,
      count: 0,
      byIntegration: {},
    }
  }

  const statuses: AsaasPaymentStatus[] = ['PENDING', 'OVERDUE']

  // Coleta em paralelo todas as integrações × status.
  await Promise.all(
    integrations.flatMap((int) =>
      statuses.map(async (status) => {
        let offset = 0
        const env = int.environment as AsaasEnv
        // Paginação manual pra capturar tudo na janela
        while (true) {
          let page
          try {
            page = await listPayments(env, int.api_key, {
              status,
              dueDateGe: startStr,
              dueDateLe: endStr,
              limit: 100,
              offset,
            })
          } catch (e) {
            console.error('[forecast]', int.name, status, e)
            break
          }
          for (const p of page.data) {
            const key = p.dueDate.slice(0, 7)  // YYYY-MM
            const bucket = buckets[key]
            if (!bucket) continue
            bucket.total += p.value
            bucket.count += 1
            const k = int.id
            if (!bucket.byIntegration[k]) {
              bucket.byIntegration[k] = { name: int.name, total: 0, count: 0 }
            }
            bucket.byIntegration[k].total += p.value
            bucket.byIntegration[k].count += 1
          }
          if (!page.hasMore) break
          offset += page.limit
        }
      }),
    ),
  )

  const forecast = Object.values(buckets).sort((a, b) => a.month.localeCompare(b.month))
  return NextResponse.json({ forecast, integrations: integrations.length })
}
