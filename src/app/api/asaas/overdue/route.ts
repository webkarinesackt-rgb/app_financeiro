import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { listPayments, getCustomer, type AsaasEnv } from '@/lib/asaas/client'

interface OverdueItem {
  id: string
  integrationId: string
  integrationName: string
  customerName: string
  description: string | null
  value: number
  dueDate: string
  daysOverdue: number
  invoiceUrl: string | null
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
  if (!integrations?.length) return NextResponse.json({ overdue: [] })

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const items: OverdueItem[] = []

  // Cache simples de customers por integração — evita chamadas duplicadas.
  const customerCache: Record<string, string> = {}

  for (const int of integrations) {
    const env = int.environment as AsaasEnv
    let offset = 0
    while (true) {
      let page
      try {
        page = await listPayments(env, int.api_key, { status: 'OVERDUE', limit: 100, offset })
      } catch (e) {
        console.error('[overdue]', int.name, e)
        break
      }
      for (const p of page.data) {
        const cacheKey = `${int.id}:${p.customer}`
        let name = customerCache[cacheKey]
        if (!name) {
          try {
            const c = await getCustomer(env, int.api_key, p.customer)
            name = c.name
            customerCache[cacheKey] = name
          } catch {
            name = 'Cliente desconhecido'
          }
        }
        const due = new Date(p.dueDate + 'T00:00:00')
        const days = Math.max(1, Math.floor((today.getTime() - due.getTime()) / 86400000))
        items.push({
          id: p.id,
          integrationId: int.id,
          integrationName: int.name,
          customerName: name,
          description: p.description,
          value: p.value,
          dueDate: p.dueDate,
          daysOverdue: days,
          invoiceUrl: p.invoiceUrl,
        })
      }
      if (!page.hasMore) break
      offset += page.limit
    }
  }

  // Ordena: maior atraso primeiro
  items.sort((a, b) => b.daysOverdue - a.daysOverdue)

  return NextResponse.json({ overdue: items, total: items.reduce((s, i) => s + i.value, 0) })
}
