// GET /api/v1/balances
// Saldo geral consolidado: total por conta + agregados.

import { authenticateApiRequest, hasScope, jsonError, jsonOk, getServiceClient } from '@/lib/api-auth'

export async function GET(req: Request) {
  const auth = await authenticateApiRequest(req)
  if (!auth.ok) return jsonError(auth.status, auth.error)
  const ctx = auth.ctx
  if (!hasScope(ctx, 'read:balances')) {
    return jsonError(403, 'Missing scope: read:balances')
  }

  const sb = getServiceClient()
  let accQuery = sb.from('accounts').select('*').eq('user_id', ctx.userId)
  let txQuery = sb.from('transactions')
    .select('account_id, type, amount')
    .eq('user_id', ctx.userId)
    .not('account_id', 'is', null)
  if (ctx.workspace) {
    accQuery = accQuery.eq('workspace', ctx.workspace)
    txQuery = txQuery.eq('workspace', ctx.workspace)
  }

  const [{ data: accs, error: e1 }, { data: txs, error: e2 }] = await Promise.all([accQuery, txQuery])
  if (e1) return jsonError(500, e1.message)
  if (e2) return jsonError(500, e2.message)

  const accounts = (accs ?? []).map((a) => {
    const accTxs = (txs ?? []).filter((t) => t.account_id === a.id)
    const income = accTxs.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
    const expense = accTxs.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
    return {
      id: a.id,
      name: a.name,
      type: a.type,
      kind: a.kind,
      bank: a.bank,
      workspace: a.workspace,
      initial_balance: Number(a.initial_balance),
      current_balance: Number(a.initial_balance) + income - expense,
      include_in_total: a.include_in_total,
    }
  })

  const totalBalance = accounts
    .filter((a) => a.include_in_total && a.kind !== 'reserve')
    .reduce((s, a) => s + a.current_balance, 0)
  const reservesBalance = accounts
    .filter((a) => a.kind === 'reserve')
    .reduce((s, a) => s + a.current_balance, 0)

  return jsonOk({
    total_balance: totalBalance,
    reserves_balance: reservesBalance,
    accounts,
  })
}
