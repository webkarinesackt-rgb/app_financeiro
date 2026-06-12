// GET /api/v1/closings
// Lista fechamentos (projects) com paginação simples.

import { authenticateApiRequest, hasScope, jsonError, jsonOk, getServiceClient } from '@/lib/api-auth'

export async function GET(req: Request) {
  const auth = await authenticateApiRequest(req)
  if (!auth.ok) return jsonError(auth.status, auth.error)
  const ctx = auth.ctx
  if (!hasScope(ctx, 'read:closings')) {
    return jsonError(403, 'Missing scope: read:closings')
  }

  const url = new URL(req.url)
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '100'), 500)
  const offset = parseInt(url.searchParams.get('offset') ?? '0')
  const status = url.searchParams.get('status')

  const sb = getServiceClient()
  let q = sb.from('projects').select('*', { count: 'exact' })
    .eq('user_id', ctx.userId)
    .order('start_date', { ascending: false })
    .range(offset, offset + limit - 1)
  if (status) q = q.eq('status', status)

  const { data, error, count } = await q
  if (error) return jsonError(500, error.message)
  return jsonOk({ data, count, limit, offset })
}
