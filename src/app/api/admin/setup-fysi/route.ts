import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Endpoint TEMPORÁRIO de setup. Removido após o setup inicial.
 *
 *   ?action=list-users    → lista auth.users
 *   ?action=check-schema  → confere se briefing_app_client_id existe
 *
 * A migration 014 deve ser aplicada via Supabase Dashboard → SQL Editor.
 *
 * Protegido por SETUP_TOKEN.
 */

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const token = url.searchParams.get('token')
  const action = url.searchParams.get('action') ?? 'list-users'
  const expected = process.env.SETUP_TOKEN
  if (!expected || token !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  if (action === 'list-users') {
    const { data, error } = await admin.auth.admin.listUsers()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({
      users: data.users.map((u) => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
      })),
    })
  }

  if (action === 'check-schema') {
    const { error } = await admin
      .from('projects')
      .select('briefing_app_client_id')
      .limit(1)
    return NextResponse.json({
      hasColumn: !error,
      error: error?.message ?? null,
    })
  }

  if (action === 'env-keys') {
    const keys = Object.keys(process.env)
      .filter((k) => /POSTGRES|DATABASE|SUPABASE|FYSI/i.test(k))
      .sort()
    return NextResponse.json({ keys })
  }

  if (action === 'project-info') {
    // Devolve a URL do Supabase que o runtime está usando + um sample do
    // projects pra confirmar qual DB é.
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
    const ref = supabaseUrl.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1] ?? null
    const { count, error } = await admin
      .from('projects')
      .select('id', { count: 'exact', head: true })
    return NextResponse.json({
      supabaseUrl,
      projectRef: ref,
      projectsCount: count,
      error: error?.message ?? null,
    })
  }

  return NextResponse.json(
    { error: 'unknown action', actions: ['list-users', 'check-schema', 'project-info'] },
    { status: 400 },
  )
}
