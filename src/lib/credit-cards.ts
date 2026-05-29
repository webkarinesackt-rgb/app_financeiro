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

  const base = {
    user_id: user.id,
    name: data.name,
    bank: data.bank ?? null,
    color: data.color,
    credit_limit: data.credit_limit ?? 0,
    closing_day: data.closing_day ?? null,
    due_day: data.due_day ?? null,
  }

  // Tentativa 1: RPC.
  const rpc = await supabase.rpc('create_credit_card_v1', {
    p_name: base.name, p_bank: base.bank, p_color: base.color,
    p_credit_limit: base.credit_limit,
    p_closing_day: base.closing_day, p_due_day: base.due_day,
    p_workspace: workspace,
  })
  if (!rpc.error && Array.isArray(rpc.data) && rpc.data.length > 0) {
    return rpc.data[0] as CreditCard
  }

  // Tentativa 2: INSERT direto com workspace.
  const ins = await supabase.from('credit_cards').insert({ ...base, workspace }).select().single()
  if (!ins.error && ins.data) return ins.data as CreditCard

  // Tentativa 3: INSERT sem workspace + UPDATE.
  const insBare = await supabase.from('credit_cards').insert(base).select().single()
  if (insBare.error || !insBare.data) {
    throw new Error(`Falha ao criar cartão: ${insBare.error?.message ?? 'sem dados'}`)
  }
  if (workspace !== 'business') {
    const upd = await supabase.from('credit_cards').update({ workspace }).eq('id', insBare.data.id)
    if (upd.error) console.warn('[credit-cards] workspace UPDATE falhou:', upd.error.message)
  }
  return insBare.data as CreditCard
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
