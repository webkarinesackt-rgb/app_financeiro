import { createClient } from '@/lib/supabase/client'
import type { CreditCard, CreditCardWithUsage } from '@/types'
import { getClientWorkspace, filterByWorkspace } from '@/lib/workspace'

type CardInput = Omit<CreditCard, 'id' | 'user_id' | 'workspace' | 'created_at' | 'updated_at'>

export async function getCreditCards(): Promise<CreditCard[]> {
  const supabase = createClient()
  const workspace = getClientWorkspace()
  const { data, error } = await supabase
    .from('credit_cards')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  return filterByWorkspace(data, workspace)
}

export async function getCreditCardsWithUsage(month: number, year: number): Promise<CreditCardWithUsage[]> {
  const supabase = createClient()
  const workspace = getClientWorkspace()
  const start = new Date(year, month - 1, 1).toISOString().split('T')[0]
  const end = new Date(year, month, 0).toISOString().split('T')[0]

  const [{ data: cardsRaw }, { data: transactionsRaw }] = await Promise.all([
    supabase.from('credit_cards').select('*').order('created_at', { ascending: true }),
    supabase
      .from('transactions')
      .select('credit_card_id, amount, workspace')
      .eq('type', 'expense')
      .not('credit_card_id', 'is', null)
      .gte('date', start)
      .lte('date', end),
  ])

  const cards = filterByWorkspace(cardsRaw, workspace)
  const transactions = filterByWorkspace(transactionsRaw, workspace)

  return cards.map((card) => {
    const invoice = transactions
      .filter((t) => t.credit_card_id === card.id)
      .reduce((s, t) => s + t.amount, 0)
    return { ...card, currentInvoice: invoice }
  })
}

export async function createCreditCard(data: CardInput): Promise<CreditCard> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')
  const workspace = getClientWorkspace()

  // Caminho A: RPC que bypassa o cache de colunas do PostgREST.
  const { data: rpcRows, error: rpcErr } = await supabase.rpc('create_credit_card_v1', {
    p_name: data.name,
    p_bank: data.bank ?? null,
    p_color: data.color,
    p_credit_limit: data.credit_limit ?? 0,
    p_closing_day: data.closing_day ?? null,
    p_due_day: data.due_day ?? null,
    p_workspace: workspace,
  })
  if (!rpcErr && Array.isArray(rpcRows) && rpcRows.length > 0) {
    return rpcRows[0] as CreditCard
  }

  // Caminho B (fallback): INSERT direto.
  const { data: card, error } = await supabase
    .from('credit_cards')
    .insert({ ...data, user_id: user.id, workspace })
    .select()
    .single()
  if (error) throw error
  return card
}

export async function updateCreditCard(id: string, data: Partial<CardInput>): Promise<CreditCard> {
  const supabase = createClient()
  const { data: card, error } = await supabase
    .from('credit_cards')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return card
}

export async function deleteCreditCard(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('credit_cards').delete().eq('id', id)
  if (error) throw error
}
