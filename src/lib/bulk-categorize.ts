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

// Extrai o "lojista/destinatário" de uma descrição de despesa.
// Padrões reconhecidos:
//   - "Pix enviado: Cp :NNNNN-Nome do Destinatário"      → Nome
//   - "Pagamento efetuado: ..."                            → tudo após ":"
//   - "FACEBK 347GXKDYT2 SAO PAULO BRA"                    → FACEBK
//   - "IG NuvemHost Governador Va BRA"                     → IG NuvemHost
//   - "CLICKUP 8886254258 CA"                              → CLICKUP
function extractExpenseKey(description: string): string | null {
  const d = description.trim()

  // 1) Pix com Cp :NNNN-Nome
  const pixMatch = d.match(/Cp\s*:[\d]+-(.+?)(\s+\d{6,}|$)/)
  if (pixMatch && pixMatch[1].trim().length >= 3) return pixMatch[1].trim()

  // 2) Pagamento efetuado: <descrição>
  const pagMatch = d.match(/^Pagamento\s+efetuado:\s*(.+)$/i)
  if (pagMatch && pagMatch[1].trim().length >= 3) {
    return extractExpenseKey(pagMatch[1].trim()) ?? pagMatch[1].trim().slice(0, 30)
  }

  // 3) Cartão: primeiros tokens significativos, parando em IDs longos (>= 6 dígitos)
  //    ou códigos de estado/país (SAO, RIO, BRA, CA, NL etc com 2-3 letras maiúsculas no final)
  const tokens = d.split(/\s+/).filter((w) => w.length >= 2)
  const meaningful: string[] = []
  for (const tok of tokens) {
    // para em ID longo (6+ dígitos/alfanumérico)
    if (/^[a-zA-Z0-9]{6,}$/.test(tok) && /\d/.test(tok)) break
    // para em código curto isolado (geralmente locale do final)
    if (meaningful.length >= 1 && /^[A-Z]{2,3}$/.test(tok)) break
    meaningful.push(tok)
    if (meaningful.length >= 3) break
  }
  const key = meaningful.join(' ').trim()
  return key.length >= 3 ? key : null
}

// Lista DESPESAS não-categorizadas (category='other' OU sem custom_category),
// agrupado por "nome" extraído (lojista/destinatário) da description.
export async function getUncategorizedExpenses(fromDate?: string): Promise<UncategorizedClient[]> {
  const supabase = createClient()
  let query = supabase
    .from('transactions')
    .select('description, amount, date, category, custom_category')
    .eq('type', 'expense')
    .or('category.eq.other,and(category.eq.custom,custom_category.is.null)')

  if (fromDate) query = query.gte('date', fromDate)

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
