// Helpers pra categorização em massa de transações por cliente.

import { createClient } from '@/lib/supabase/client'
import { extractExpenseKey } from '@/lib/expense-key'

export interface UncategorizedClient {
  name: string             // nome extraído da description
  total: number            // soma líquida recebida
  count: number            // nº de lançamentos
  firstDate: string
  lastDate: string
  sample: string           // descrição completa de exemplo
}

export type ExpenseOrigin = 'all' | 'card' | 'account' | 'asaas'

// Extrai nome do cliente da descrição. Mesma lógica usada no resto do app.
function extractClient(description: string): string | null {
  const m1 = description.match(/^([^—]+?)\s*—/)
  if (m1 && m1[1].trim().length >= 3) return m1[1].trim()
  const m2 = description.match(/Cp\s*:[\d]+-(.+?)(\s+\d{6,}|$)/)
  if (m2 && m2[1].trim().length >= 3) return m2[1].trim()
  return null
}

// extractExpenseKey vive em @/lib/expense-key (importado acima).

// Lista DESPESAS sem categoria da empresa (custom_category nula), agrupadas
// por lojista extraído da description. `origin` filtra por cartão / conta /
// Asaas (integração).
export async function getUncategorizedExpenses(
  fromDate?: string,
  origin: ExpenseOrigin = 'all',
): Promise<UncategorizedClient[]> {
  const supabase = createClient()
  let query = supabase
    .from('transactions')
    .select('description, amount, date, credit_card_id, integration_id')
    .eq('type', 'expense')
    .is('custom_category', null)

  if (fromDate) query = query.gte('date', fromDate)
  if (origin === 'card') query = query.not('credit_card_id', 'is', null)
  else if (origin === 'asaas') query = query.not('integration_id', 'is', null)
  else if (origin === 'account') query = query.is('credit_card_id', null).is('integration_id', null)

  const { data, error } = await query
  if (error || !data) return []

  const map = new Map<string, UncategorizedClient>()
  for (const t of data) {
    const key = extractExpenseKey(t.description as string)
    if (!key) continue

    const cur = map.get(key) ?? {
      name: key,
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
    map.set(key, cur)
  }

  return Array.from(map.values()).sort((a, b) => b.total - a.total)
}

// Lista clientes únicos das transações em "Receita Landing Page / Site"
// sem subcategoria definida — agrupado por nome extraído da description.
// fromDate: opcional, filtra só transações a partir dessa data (YYYY-MM-DD).
export async function getUncategorizedLPClients(fromDate?: string): Promise<UncategorizedClient[]> {
  const supabase = createClient()
  let query = supabase
    .from('transactions')
    .select('description, amount, date')
    .eq('custom_category', 'Receita Landing Page / Site')
    .eq('type', 'income')
    .is('subcategory', null)

  if (fromDate) query = query.gte('date', fromDate)

  const { data, error } = await query

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

// Aplica categorização a TODAS as despesas que casem com o nome (lojista).
// type='expense'.
export async function categorizeExpenseByPattern(
  pattern: string,
  category: string,
  customCategory: string | null,
): Promise<number> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 0

  const clean = pattern.replace(/[%_]/g, '').trim()
  if (clean.length < 3) return 0

  const { data, error } = await supabase
    .from('transactions')
    .update({
      category: customCategory ? 'custom' : category,
      custom_category: customCategory,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)
    .eq('type', 'expense')
    .ilike('description', `%${clean}%`)
    .select('id')

  if (error) return 0
  return data?.length ?? 0
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
