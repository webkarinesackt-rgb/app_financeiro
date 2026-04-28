import { createClient } from '@/lib/supabase/client'
import type { CreditCard, CreditCardWithUsage } from '@/types'

type CardInput = Omit<CreditCard, 'id' | 'user_id' | 'created_at' | 'updated_at'>

export async function getCreditCards(): Promise<CreditCard[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('credit_cards')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function getCreditCardsWithUsage(month: number, year: number): Promise<CreditCardWithUsage[]> {
  const supabase = createClient()
  const start = new Date(year, month - 1, 1).toISOString().split('T')[0]
  const end = new Date(year, month, 0).toISOString().split('T')[0]

  const [{ data: cards }, { data: transactions }] = await Promise.all([
    supabase.from('credit_cards').select('*').order('created_at', { ascending: true }),
    supabase
      .from('transactions')
      .select('credit_card_id, amount')
      .eq('type', 'expense')
      .not('credit_card_id', 'is', null)
      .gte('date', start)
      .lte('date', end),
  ])

  return (cards ?? []).map((card) => {
    const invoice = (transactions ?? [])
      .filter((t) => t.credit_card_id === card.id)
      .reduce((s, t) => s + t.amount, 0)
    return { ...card, currentInvoice: invoice }
  })
}

export async function createCreditCard(data: CardInput): Promise<CreditCard> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data: card, error } = await supabase
    .from('credit_cards')
    .insert({ ...data, user_id: user.id })
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
