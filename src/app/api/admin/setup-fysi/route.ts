import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Endpoint TEMPORÁRIO de setup: lista users do auth.users pra descobrir
 * qual UUID setar em FYSI_OWNER_USER_ID. Removido após o setup inicial.
 *
 * Protegido por SETUP_TOKEN passado na query string.
 */

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const token = url.searchParams.get('token')
  const expected = process.env.SETUP_TOKEN
  if (!expected || token !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.listUsers()
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    users: data.users.map((u) => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
    })),
  })
}
