// GET /api/v1/accounts
// Lista contas + cartões (cada um com saldo/uso calculado).

import { authenticateApiRequest, hasScope, jsonError, jsonOk, getServiceClient } from '@/lib/api-auth'

export async function GET(req: Request) {
  const auth = await authenticateApiRequest(req)
  if (!auth.ok) return jsonError(auth.status, auth.error)
  const ctx = auth.ctx
  if (!hasScope(ctx, 'read:accounts')) {
    return jsonError(403, 'Missing scope: read:accounts')
  }

  const sb = getServiceClient()
  let accQuery = sb.from('accounts').select('*').eq('user_id', ctx.userId)
  let cardQuery = sb.from('credit_cards').select('*').eq('user_id', ctx.userId)
  if (ctx.workspace) {
    accQuery = accQuery.eq('workspace', ctx.workspace)
    cardQuery = cardQuery.eq('workspace', ctx.workspace)
  }

  const [{ data: accounts, error: accErr }, { data: cards, error: cardErr }] = await Promise.all([
    accQuery, cardQuery,
  ])
  if (accErr) return jsonError(500, accErr.message)
  if (cardErr) return jsonError(500, cardErr.message)

  return jsonOk({ accounts: accounts ?? [], credit_cards: cards ?? [] })
}
