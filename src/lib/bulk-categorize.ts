// Helpers pra categorização em massa de transações por cliente.

import { createClient } from '@/lib/supabase/client'

export interface UncategorizedClient {
  name: string             // nome extraído da description
  total: number            // soma líquida recebida
  count: number            // nº de lançamentos
  firstDate: string
  lastDate: string
  sample: string           // descrição completa de exemplo
}

// Extrai nome do cliente da descrição. Mesma lógica usada no resto do app.
function extractClient(description: string): string | null {
  const m1 = description.match(/^([^—]+?)\s*—/)
  if (m1 && m1[1].trim().length >= 3) return m1[1].trim()
  const m2 = description.match(/Cp\s*:[\d]+-(.+?)(\s+\d{6,}|$)/)
  if (m2 && m2[1].trim().length >= 3) return m2[1].trim()
  return null
}

// Lista clientes únicos das transações em "Receita Landing Page / Site"
// sem subcategoria definida — agrupado por nome extraído da description.
export async function getUncategorizedLPClients(): Promise<UncategorizedClient[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('transactions')
    .select('description, amount, date')
    .eq('custom_category', 'Receita Landing Page / Site')
    .eq('type', 'income')
    .is('subcategory', null)

  if (error || !data) return []

  const map = new Map<string, UncategorizedClient>()
  for (const t of data) {
    const name = extractClient(t.description)
    if (!name) continue
    const cur = map.get(name) ?? {
      name,
      total: 0,
      count: 0,
      firstDate: t.date,
      lastDate: t.date,
      sample: t.description,
    }
    cur.total += Number(t.amount)
    cur.count += 1
    if (t.date < cur.firstDate) cur.firstDate = t.date
    if (t.date > cur.lastDate) cur.lastDate = t.date
    map.set(name, cur)
  }

  return Array.from(map.values()).sort((a, b) => b.total - a.total)
}

// Aplica uma categorização a TODAS as transações que tenham o nome do
// cliente na description. Retorna quantas foram atualizadas.
export async function categorizeClientByName(
  clientName: string,
  customCategory: string,
  subcategory: string | null,
): Promise<number> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 0

  const clean = clientName.replace(/[%_]/g, '').trim()
  if (clean.length < 3) return 0

  // Build .or() filter that matches exact "clean" string in description
  // (escape % already done above)
  const { data, error } = await supabase
    .from('transactions')
    .update({
      category: 'custom',
      custom_category: customCategory,
      subcategory,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)
    .eq('type', 'income')
    .ilike('description', `%${clean}%`)
    .select('id')

  if (error) return 0
  return data?.length ?? 0
}
