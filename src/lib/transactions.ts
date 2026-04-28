import { addMonths } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import type { Transaction, TransactionFormData } from '@/types'

export async function getTransactions(filters?: {
  month?: number
  year?: number
  category?: string
  type?: string
  accountId?: string
  creditCardId?: string
}): Promise<Transaction[]> {
  const supabase = createClient()
  let query = supabase.from('transactions').select('*').order('date', { ascending: false })

  if (filters?.month && filters?.year) {
    const start = new Date(filters.year, filters.month - 1, 1).toISOString().split('T')[0]
    const end = new Date(filters.year, filters.month, 0).toISOString().split('T')[0]
    query = query.gte('date', start).lte('date', end)
  }
  if (filters?.category && filters.category !== 'all') query = query.eq('category', filters.category)
  if (filters?.type && filters.type !== 'all') query = query.eq('type', filters.type)
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

  // Credit card installments (expense)
  if (installment_total && installment_total > 1 && data.credit_card_id) {
    const installmentGroupId = crypto.randomUUID()
    const amountPerInstallment = Math.round((data.amount / installment_total) * 100) / 100
    const baseDate = new Date(data.date + 'T12:00:00')

    const records = Array.from({ length: installment_total }, (_, i) => ({
      ...baseData,
      user_id: user.id,
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
    .insert({ ...baseData, user_id: user.id, installment_total: null })
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
