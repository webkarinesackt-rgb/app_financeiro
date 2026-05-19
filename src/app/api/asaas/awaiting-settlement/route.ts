import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { listPayments, type AsaasEnv } from '@/lib/asaas/client'

// Cobranças CONFIRMED no Asaas — já pagas mas aguardando compensação/repasse
// (geralmente cartão de crédito, ~2 dias úteis pra cair em conta).

interface ByIntegration {
  id: string
  name: string
  total: number
  count: number
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
  if (!integrations?.length) return NextResponse.json({ total: 0, count: 0, byIntegration: [] })

  const buckets = new Map<string, ByIntegration>()
  let total = 0
  let count = 0

  await Promise.all(
    integrations.map(async (int) => {
      const env = int.environment as AsaasEnv
      let offset = 0
      buckets.set(int.id, { id: int.id, name: int.name, total: 0, count: 0 })
      while (true) {
        let page
        try {
          page = await listPayments(env, int.api_key, { status: 'CONFIRMED', limit: 100, offset })
        } catch (e) {
          console.error('[awaiting-settlement]', int.name, e)
          break
        }
        for (const p of page.data) {
          const b = buckets.get(int.id)!
          b.total += p.value
          b.count += 1
          total += p.value
          count += 1
        }
        if (!page.hasMore) break
        offset += page.limit
      }
    }),
  )

  return NextResponse.json({
    total,
    count,
    byIntegration: Array.from(buckets.values()).filter((b) => b.count > 0),
  })
}
