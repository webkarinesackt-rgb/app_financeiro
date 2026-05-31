import { createClient } from '@/lib/supabase/client'
import type { Account, AccountWithBalance } from '@/types'
import { getClientWorkspace, filterByWorkspace } from '@/lib/workspace'

type AccountInput = Omit<Account, 'id' | 'user_id' | 'workspace' | 'created_at' | 'updated_at'>

export async function getAccounts(): Promise<Account[]> {
  const supabase = createClient()
  const workspace = getClientWorkspace()

  // Tenta RPC primeiro — bypassa cache de colunas do PostgREST
  const { data: rpcRows, error: rpcErr } = await supabase.rpc('list_accounts_v1', {
    p_workspace: workspace,
  })
  if (!rpcErr && Array.isArray(rpcRows)) {
    return rpcRows as Account[]
  }

  // Fallback: SELECT + filtro client-side (depende do workspace estar no payload)
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

// Retorna TODAS as contas (sem filtro de workspace) — usado em telas de
// gerenciamento (settings) pra que contas no workspace "errado" (criadas com
// cache PostgREST stale) fiquem visíveis e migráveis.
export async function getAllAccountsWithBalances(): Promise<AccountWithBalance[]> {
  const supabase = createClient()
  const [{ data: accountsRaw }, { data: transactionsRaw }] = await Promise.all([
    supabase.from('accounts').select('*').order('created_at', { ascending: true }),
    supabase.from('transactions').select('account_id, type, amount').not('account_id', 'is', null),
  ])
  const accounts = accountsRaw ?? []
  const transactions = transactionsRaw ?? []
  return accounts.map((account) => {
    const txs = transactions.filter((t) => t.account_id === account.id)
    const income = txs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const expense = txs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    return { ...account, currentBalance: account.initial_balance + income - expense }
  })
}

// Move conta pra outro workspace. Pode falhar silencioso se a coluna workspace
// não estiver no cache do PostgREST — nesse caso retorna false e o caller decide
// se mostra aviso.
export async function moveAccountToWorkspace(id: string, workspace: 'business' | 'personal'): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.from('accounts').update({ workspace }).eq('id', id)
  return !error
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

  const base = {
    user_id: user.id,
    name: data.name,
    type: data.type,
    kind: data.kind ?? 'operational',
    bank: data.bank ?? null,
    color: data.color,
    initial_balance: data.initial_balance ?? 0,
    include_in_total: data.include_in_total ?? true,
  }

  // Tentativa 1: RPC (bypassa cache de colunas). Falha c/ PGRST202 se cache de funções estiver stale.
  const rpc = await supabase.rpc('create_account_v1', {
    p_name: base.name, p_type: base.type, p_kind: base.kind,
    p_bank: base.bank, p_color: base.color,
    p_initial_balance: base.initial_balance,
    p_include_in_total: base.include_in_total,
    p_workspace: workspace,
  })
  if (!rpc.error && Array.isArray(rpc.data) && rpc.data.length > 0) {
    return rpc.data[0] as Account
  }

  // Tentativa 2: INSERT direto com workspace.
  const ins = await supabase.from('accounts').insert({ ...base, workspace }).select().single()
  if (!ins.error && ins.data) return ins.data as Account

  // Tentativa 3: INSERT sem workspace (DB usa DEFAULT 'business') + UPDATE separado.
  const insBare = await supabase.from('accounts').insert(base).select().single()
  if (insBare.error || !insBare.data) {
    throw new Error(`Falha ao criar conta: ${insBare.error?.message ?? 'sem dados'}`)
  }
  if (workspace !== 'business') {
    const upd = await supabase.from('accounts').update({ workspace }).eq('id', insBare.data.id)
    if (upd.error) {
      // Conta criada mas no workspace errado (cache PostgREST stale). Joga erro
      // específico pro caller mostrar instrução.
      throw new AccountStuckInWrongWorkspaceError(
        insBare.data as Account,
        workspace,
        upd.error.message,
      )
    }
    // Re-fetch pra retornar workspace atualizado
    const { data: refreshed } = await supabase.from('accounts').select('*').eq('id', insBare.data.id).single()
    return (refreshed ?? insBare.data) as Account
  }
  return insBare.data as Account
}

export class AccountStuckInWrongWorkspaceError extends Error {
  constructor(
    public account: Account,
    public requestedWorkspace: string,
    public underlyingMessage: string,
  ) {
    super(
      `Conta "${account.name}" foi criada mas ficou no workspace "business" (cache do PostgREST está desatualizado). ` +
      `Vá em Settings → Contas e clique em "Mover" pra trazê-la pro workspace ${requestedWorkspace}, ` +
      `ou pause/restaure o projeto no Supabase pra resolver de vez.`,
    )
    this.name = 'AccountStuckInWrongWorkspaceError'
  }
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
