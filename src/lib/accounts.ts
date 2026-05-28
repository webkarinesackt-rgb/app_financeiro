import { createClient } from '@/lib/supabase/client'
import type { Account, AccountWithBalance } from '@/types'
import { getClientWorkspace, filterByWorkspace } from '@/lib/workspace'

type AccountInput = Omit<Account, 'id' | 'user_id' | 'workspace' | 'created_at' | 'updated_at'>

export async function getAccounts(): Promise<Account[]> {
  const supabase = createClient()
  const workspace = getClientWorkspace()
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  return filterByWorkspace(data, workspace)
}

export async function getAccountsWithBalances(): Promise<AccountWithBalance[]> {
  const supabase = createClient()
  const workspace = getClientWorkspace()

  const [{ data: accountsRaw }, { data: transactionsRaw }] = await Promise.all([
    supabase.from('accounts').select('*').order('created_at', { ascending: true }),
    supabase.from('transactions').select('account_id, type, amount, workspace').not('account_id', 'is', null),
  ])

  const accounts = filterByWorkspace(accountsRaw, workspace)
  const transactions = filterByWorkspace(transactionsRaw, workspace)

  return accounts.map((account) => {
    const txs = transactions.filter((t) => t.account_id === account.id)
    const income = txs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const expense = txs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    return { ...account, currentBalance: account.initial_balance + income - expense }
  })
}

export async function getReserveAccountsWithBalances(): Promise<AccountWithBalance[]> {
  const all = await getAccountsWithBalances()
  return all.filter((a) => a.kind === 'reserve')
}

export async function getOperationalAccountsWithBalances(): Promise<AccountWithBalance[]> {
  const all = await getAccountsWithBalances()
  return all.filter((a) => a.kind !== 'reserve')
}

export async function createAccount(data: AccountInput): Promise<Account> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')
  const workspace = getClientWorkspace()

  // RPC que bypassa o cache de colunas do PostgREST. Migration 014 é obrigatória.
  const { data: rpcRows, error: rpcErr } = await supabase.rpc('create_account_v1', {
    p_name: data.name,
    p_type: data.type,
    p_kind: data.kind ?? 'operational',
    p_bank: data.bank ?? null,
    p_color: data.color,
    p_initial_balance: data.initial_balance ?? 0,
    p_include_in_total: data.include_in_total ?? true,
    p_workspace: workspace,
  })
  if (rpcErr) {
    throw new Error(`RPC create_account_v1 falhou: ${rpcErr.message} (code ${rpcErr.code ?? 'n/a'})`)
  }
  if (!Array.isArray(rpcRows) || rpcRows.length === 0) {
    throw new Error('RPC create_account_v1 não retornou nenhuma linha')
  }
  return rpcRows[0] as Account
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
