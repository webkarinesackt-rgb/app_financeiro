import { createClient } from '@/lib/supabase/client'
import type { Account, AccountWithBalance } from '@/types'

type AccountInput = Omit<Account, 'id' | 'user_id' | 'created_at' | 'updated_at'>

export async function getAccounts(): Promise<Account[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function getAccountsWithBalances(): Promise<AccountWithBalance[]> {
  const supabase = createClient()

  const [{ data: accounts }, { data: transactions }] = await Promise.all([
    supabase.from('accounts').select('*').order('created_at', { ascending: true }),
    supabase.from('transactions').select('account_id, type, amount').not('account_id', 'is', null),
  ])

  return (accounts ?? []).map((account) => {
    const txs = (transactions ?? []).filter((t) => t.account_id === account.id)
    const income = txs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const expense = txs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    return { ...account, currentBalance: account.initial_balance + income - expense }
  })
}

export async function createAccount(data: AccountInput): Promise<Account> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data: account, error } = await supabase
    .from('accounts')
    .insert({ ...data, user_id: user.id })
    .select()
    .single()
  if (error) throw error
  return account
}

export async function updateAccount(id: string, data: Partial<AccountInput>): Promise<Account> {
  const supabase = createClient()
  const { data: account, error } = await supabase
    .from('accounts')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return account
}

export async function deleteAccount(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('accounts').delete().eq('id', id)
  if (error) throw error
}
