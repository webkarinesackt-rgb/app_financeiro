import { addMonths } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import type { Transaction, TransactionFormData, WorkspaceType } from '@/types'
import { CATEGORY_LABELS } from '@/types'
import { buildMerchantCategoryMap, matchMerchantCategory, type CategoryMatch } from '@/lib/expense-key'
import { getClientWorkspace } from '@/lib/workspace'

// ─── Date range helpers ───────────────────────────────────────────────────────

export function computeDateRange(from: string, to: string): { start: string; end: string } {
  const [fy, fm] = from.split('-').map(Number)
  const [ty, tm] = to.split('-').map(Number)
  const start = new Date(fy, fm - 1, 1).toISOString().split('T')[0]
  const end = new Date(ty, tm, 0).toISOString().split('T')[0] // day 0 of next month = last day of month
  return { start, end }
}

// Extrai o "nome do cliente" da descrição (helper compartilhado).
function extractClientPattern(description: string): string | null {
  const m1 = description.match(/^([^—]+?)\s*—/)
  if (m1 && m1[1].trim().length >= 4) return m1[1].trim()
  const m2 = description.match(/Cp\s*:[\d]+-(.+?)(\s+\d{6,}|$)/)
  if (m2 && m2[1].trim().length >= 4) return m2[1].trim()
  return null
}

// Aplica a mesma categorização a TODAS as transações do mesmo cliente
// (match por nome extraído da description). Retorna quantas foram atualizadas.
export async function applyCategoryToSimilarTransactions(
  sourceId: string,
  description: string,
  type: 'income' | 'expense',
  customCategory: string | null,
  subcategory: string | null,
): Promise<number> {
  const pattern = extractClientPattern(description)
  if (!pattern) return 0
  const clean = pattern.replace(/[%_]/g, '').trim()
  if (clean.length < 4) return 0

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 0
  const workspace = getClientWorkspace()

  const { data: similar } = await supabase
    .from('transactions')
    .select('id, custom_category, subcategory, category')
    .eq('workspace', workspace)
    .eq('type', type)
    .eq('user_id', user.id)
    .neq('id', sourceId)
    .ilike('description', `%${clean}%`)

  if (!similar || similar.length === 0) return 0

  const toUpdate = similar.filter((t) =>
    t.custom_category !== customCategory || t.subcategory !== subcategory
  )
  if (toUpdate.length === 0) return 0

  const ids = toUpdate.map((t) => t.id)
  const { error } = await supabase
    .from('transactions')
    .update({
      category: customCategory ? 'custom' : 'other',
      custom_category: customCategory,
      subcategory,
      updated_at: new Date().toISOString(),
    })
    .in('id', ids)

  if (error) return 0
  return toUpdate.length
}

// Tenta detectar a custom_category (e subcategory) com base em transações
// similares (mesmo cliente). Útil pra pré-preencher o form de edição.
export async function findCategoryByDescriptionPattern(
  description: string,
  type: 'income' | 'expense',
): Promise<{ custom_category: string; subcategory: string | null } | null> {
  if (!description) return null
  const supabase = createClient()
  const workspace = getClientWorkspace()

  // Extrai possíveis "nomes de cliente" da descrição
  const patterns: string[] = []
  const m1 = description.match(/^([^—]+)\s*—/)
  if (m1) patterns.push(m1[1].trim())
  const m2 = description.match(/Cp\s*:[\d]+-(.+?)(\s+\d{6,}|$)/)
  if (m2) patterns.push(m2[1].trim())
  const words = description.split(/\s+/).filter((w) => w.length >= 4)
  if (words.length >= 2) patterns.push(words.slice(0, 2).join(' '))

  for (const raw of patterns) {
    const clean = raw.replace(/[%_]/g, '').trim()
    if (clean.length < 4) continue
    const { data } = await supabase
      .from('transactions')
      .select('custom_category, subcategory')
      .eq('workspace', workspace)
      .eq('type', type)
      .eq('category', 'custom')
      .not('custom_category', 'is', null)
      .ilike('description', `%${clean}%`)
      .order('date', { ascending: false })
      .limit(1)
    if (data && data.length > 0 && data[0].custom_category) {
      return {
        custom_category: data[0].custom_category,
        subcategory: data[0].subcategory ?? null,
      }
    }
  }
  return null
}

// Retorna as categorias built-in (padrão) que o usuário realmente usa.
// Usado pra mostrar no filtro só as categorias que aparecem na base, em vez
// de uma lista enorme de padrão que não serve pra ele.
export async function getUsedBuiltInCategories(type?: 'income' | 'expense'): Promise<string[]> {
  const supabase = createClient()
  const workspace = getClientWorkspace()
  let query = supabase.from('transactions').select('category').eq('workspace', workspace).neq('category', 'custom')
  if (type) query = query.eq('type', type)
  const { data, error } = await query
  if (error || !data) return []
  const set = new Set<string>()
  for (const r of data) {
    const c = (r as { category: string | null }).category
    if (c && c !== 'custom') set.add(c)
  }
  return Array.from(set).sort()
}

// Retorna as custom_category distintas usadas pelo usuário, opcionalmente filtradas
// por tipo (income/expense). Usado pra montar dropdowns de filtro.
export async function getCustomCategories(type?: 'income' | 'expense'): Promise<string[]> {
  const supabase = createClient()
  const workspace = getClientWorkspace()
  let query = supabase
    .from('transactions')
    .select('custom_category, type')
    .eq('workspace', workspace)
    .eq('category', 'custom')
    .not('custom_category', 'is', null)

  if (type) query = query.eq('type', type)

  const { data, error } = await query
  if (error) return []
  const names = (data ?? [])
    .map((r) => (r as { custom_category: string | null }).custom_category)
    .filter((n): n is string => !!n && n.trim().length > 0)
  return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

export async function getTransactions(filters?: {
  month?: number
  year?: number
  from?: string   // 'YYYY-MM' — takes priority over month/year
  to?: string     // 'YYYY-MM' — takes priority over month/year
  category?: string
  subcategory?: string
  type?: string
  accountId?: string
  creditCardId?: string
  workspace?: WorkspaceType
}): Promise<Transaction[]> {
  const supabase = createClient()
  const workspace = filters?.workspace ?? getClientWorkspace()
  let query = supabase.from('transactions').select('*').eq('workspace', workspace).order('date', { ascending: false })

  if (filters?.from && filters?.to) {
    const { start, end } = computeDateRange(filters.from, filters.to)
    query = query.gte('date', start).lte('date', end)
  } else if (filters?.month && filters?.year) {
    const start = new Date(filters.year, filters.month - 1, 1).toISOString().split('T')[0]
    const end = new Date(filters.year, filters.month, 0).toISOString().split('T')[0]
    query = query.gte('date', start).lte('date', end)
  }
  if (filters?.category && filters.category !== 'all') {
    if (filters.category.startsWith('custom:')) {
      const name = filters.category.slice(7)
      // Se existe uma categoria built-in com o mesmo rótulo (ex.: "Outros" =
      // custom "Outros" + built-in "other"), filtra os dois juntos.
      const builtin = Object.entries(CATEGORY_LABELS).find(([, v]) => v === name)?.[0]
      if (builtin) {
        query = query.or(`and(category.eq.custom,custom_category.eq.${name}),category.eq.${builtin}`)
      } else {
        query = query.eq('category', 'custom').eq('custom_category', name)
      }
    } else {
      query = query.eq('category', filters.category)
    }
  }
  if (filters?.type && filters.type !== 'all') query = query.eq('type', filters.type)
  if (filters?.subcategory && filters.subcategory !== 'all') query = query.eq('subcategory', filters.subcategory)
  if (filters?.accountId && filters.accountId !== 'all') query = query.eq('account_id', filters.accountId)
  if (filters?.creditCardId && filters.creditCardId !== 'all') query = query.eq('credit_card_id', filters.creditCardId)

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function createTransaction(
  data: TransactionFormData,
  options?: { incomeInstallmentDelay?: number }
): Promise<Transaction[]> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { installment_total, ...baseData } = data
  const workspace = getClientWorkspace()

  // Credit card installments (expense)
  if (installment_total && installment_total > 1 && data.credit_card_id) {
    const installmentGroupId = crypto.randomUUID()
    const amountPerInstallment = Math.round((data.amount / installment_total) * 100) / 100
    const baseDate = new Date(data.date + 'T12:00:00')

    const records = Array.from({ length: installment_total }, (_, i) => ({
      ...baseData,
      user_id: user.id,
      workspace,
      amount: amountPerInstallment,
      description: `${data.description} (${i + 1}/${installment_total})`,
      date: addMonths(baseDate, i).toISOString().split('T')[0],
      installment_total,
      installment_current: i + 1,
      installment_group_id: installmentGroupId,
    }))

    const { data: created, error } = await supabase
      .from('transactions')
      .insert(records)
      .select()
    if (error) throw error
    return created ?? []
  }

  // Income installments (receivables spread across months with optional start delay)
  if (installment_total && installment_total > 1 && data.type === 'income') {
    const delay = options?.incomeInstallmentDelay ?? 1
    const installmentGroupId = crypto.randomUUID()
    const amountPerInstallment = Math.round((data.amount / installment_total) * 100) / 100
    const baseDate = new Date(data.date + 'T12:00:00')

    const records = Array.from({ length: installment_total }, (_, i) => ({
      ...baseData,
      user_id: user.id,
      workspace,
      amount: amountPerInstallment,
      description: `${data.description} (${i + 1}/${installment_total})`,
      date: addMonths(baseDate, delay + i).toISOString().split('T')[0],
      installment_total,
      installment_current: i + 1,
      installment_group_id: installmentGroupId,
    }))

    const { data: created, error } = await supabase
      .from('transactions')
      .insert(records)
      .select()
    if (error) throw error
    return created ?? []
  }

  const { data: transaction, error } = await supabase
    .from('transactions')
    .insert({ ...baseData, user_id: user.id, workspace, installment_total: null })
    .select()
    .single()
  if (error) throw error
  return [transaction]
}

export async function updateTransaction(id: string, data: Partial<TransactionFormData>): Promise<Transaction> {
  const supabase = createClient()
  const { data: transaction, error } = await supabase
    .from('transactions')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return transaction
}

export async function deleteTransaction(id: string, deleteGroup = false): Promise<void> {
  const supabase = createClient()

  if (deleteGroup) {
    const { data: tx } = await supabase.from('transactions').select('installment_group_id').eq('id', id).single()
    if (tx?.installment_group_id) {
      const { error } = await supabase.from('transactions').delete().eq('installment_group_id', tx.installment_group_id)
      if (error) throw error
      return
    }
  }

  const { error } = await supabase.from('transactions').delete().eq('id', id)
  if (error) throw error
}

// Divide um array em lotes de `size` (evita requisições grandes demais
// quando há centenas de ids selecionados).
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

// Exclui várias transações de uma vez (seleção em massa), em lotes.
// RLS garante que só apaga transações do próprio usuário.
export async function deleteTransactions(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const supabase = createClient()
  for (const batch of chunk(ids, 100)) {
    const { error } = await supabase.from('transactions').delete().in('id', batch)
    if (error) throw error
  }
}

// Junta uma custom_category dentro de outra: move TODOS os lançamentos
// (todos os meses) de `from` para `to`. Roda como o usuário logado — a RLS
// garante que só mexe nas transações dele. Não altera a subcategoria.
export async function mergeCustomCategory(from: string, to: string): Promise<number> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('transactions')
    .update({ category: 'custom', custom_category: to, updated_at: new Date().toISOString() })
    .eq('custom_category', from)
    .select('id')
  if (error) throw error
  return data?.length ?? 0
}

// Aplica uma custom_category (e subcategoria opcional) a várias transações
// de uma vez — por ID, em lotes, sem depender de casar texto da descrição.
export async function categorizeTransactions(
  ids: string[],
  customCategory: string,
  subcategory: string | null = null,
): Promise<void> {
  if (ids.length === 0) return
  const supabase = createClient()
  for (const batch of chunk(ids, 100)) {
    const { error } = await supabase
      .from('transactions')
      .update({
        category: 'custom',
        custom_category: customCategory,
        subcategory,
        updated_at: new Date().toISOString(),
      })
      .in('id', batch)
    if (error) throw error
  }
}

// Salva uma categoria built-in do workspace pessoal (ex: 'groceries') diretamente
// no campo `category`, limpando `custom_category`. Evita que slugs de PersonalCategory
// sejam armazenados como custom_category e depois exibidos como texto cru.
export async function categorizeTransactionsToBuiltIn(
  ids: string[],
  categorySlug: string,
): Promise<void> {
  if (ids.length === 0) return
  const supabase = createClient()
  for (const batch of chunk(ids, 100)) {
    const { error } = await supabase
      .from('transactions')
      .update({
        category: categorySlug,
        custom_category: null,
        subcategory: null,
        updated_at: new Date().toISOString(),
      })
      .in('id', batch)
    if (error) throw error
  }
}

// Para uma lista de descrições de despesa, devolve um mapa
// descrição -> categoria inferida, com base em despesas já categorizadas
// do mesmo lojista. Faz uma única consulta ao banco.
export async function inferCategoriesFromHistory(
  descriptions: string[],
): Promise<Map<string, CategoryMatch>> {
  const result = new Map<string, CategoryMatch>()
  if (descriptions.length === 0) return result

  const supabase = createClient()
  const workspace = getClientWorkspace()
  const { data } = await supabase
    .from('transactions')
    .select('description, custom_category, subcategory')
    .eq('workspace', workspace)
    .eq('type', 'expense')
    .eq('category', 'custom')
    .not('custom_category', 'is', null)

  const samples = (data ?? [])
    .filter((r): r is { description: string; custom_category: string; subcategory: string | null } =>
      typeof r.description === 'string' && typeof r.custom_category === 'string')

  const merchantMap = buildMerchantCategoryMap(samples)
  for (const desc of descriptions) {
    const match = matchMerchantCategory(desc, merchantMap)
    if (match) result.set(desc, match)
  }
  return result
}
