// GET /api/v1/transactions
//   Query params:
//     ?from=YYYY-MM-DD&to=YYYY-MM-DD  filtra por intervalo
//     ?month=N&year=N                  filtra por mês específico
//     ?type=income|expense
//     ?limit=N (default 100, max 1000)
//     ?offset=N
//
// POST /api/v1/transactions
//   Body JSON: { type, amount, description, category, date, ... }
//   Requer scope write:transactions.
//
// Headers: Authorization: Bearer ak_XXXX_<secret>

import { authenticateApiRequest, hasScope, jsonError, jsonOk, getServiceClient } from '@/lib/api-auth'

export async function GET(req: Request) {
  const auth = await authenticateApiRequest(req)
  if (!auth.ok) return jsonError(auth.status, auth.error)
  const ctx = auth.ctx
  if (!hasScope(ctx, 'read:transactions')) {
    return jsonError(403, 'Missing scope: read:transactions')
  }

  const url = new URL(req.url)
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '100'), 1000)
  const offset = parseInt(url.searchParams.get('offset') ?? '0')

  const sb = getServiceClient()
  let q = sb.from('transactions').select('*', { count: 'exact' })
    .eq('user_id', ctx.userId)
    .order('date', { ascending: false })
    .range(offset, offset + limit - 1)

  if (ctx.workspace) q = q.eq('workspace', ctx.workspace)

  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  if (from && to) q = q.gte('date', from).lte('date', to)

  const month = url.searchParams.get('month')
  const year = url.searchParams.get('year')
  if (month && year && !from) {
    const m = parseInt(month), y = parseInt(year)
    const start = new Date(y, m - 1, 1).toISOString().slice(0, 10)
    const end = new Date(y, m, 0).toISOString().slice(0, 10)
    q = q.gte('date', start).lte('date', end)
  }

  const type = url.searchParams.get('type')
  if (type === 'income' || type === 'expense') q = q.eq('type', type)

  const { data, error, count } = await q
  if (error) return jsonError(500, error.message)

  return jsonOk({ data, count, limit, offset })
}

export async function POST(req: Request) {
  const auth = await authenticateApiRequest(req)
  if (!auth.ok) return jsonError(auth.status, auth.error)
  const ctx = auth.ctx
  if (!hasScope(ctx, 'write:transactions')) {
    return jsonError(403, 'Missing scope: write:transactions')
  }

  let body: Record<string, unknown>
  try { body = await req.json() }
  catch { return jsonError(400, 'Body inválido (esperado JSON)') }

  const requiredFields = ['type', 'amount', 'description', 'date', 'category']
  for (const f of requiredFields) {
    if (!body[f]) return jsonError(400, `Campo obrigatório ausente: ${f}`)
  }

  const payload = {
    user_id: ctx.userId,
    workspace: ctx.workspace ?? body.workspace ?? 'business',
    type: body.type,
    amount: body.amount,
    description: body.description,
    date: body.date,
    category: body.category,
    custom_category: body.custom_category ?? null,
    subcategory: body.subcategory ?? null,
    account_id: body.account_id ?? null,
    credit_card_id: body.credit_card_id ?? null,
    payment_method: body.payment_method ?? null,
    notes: body.notes ?? null,
    is_recurring: body.is_recurring ?? false,
    recurrence_interval: body.recurrence_interval ?? null,
  }

  const sb = getServiceClient()
  const { data, error } = await sb.from('transactions').insert(payload).select().single()
  if (error) return jsonError(500, error.message)

  return jsonOk(data, 201)
}
