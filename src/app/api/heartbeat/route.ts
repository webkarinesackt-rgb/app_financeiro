import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Heartbeat diário pra impedir o Supabase Free de pausar o projeto
// após 7 dias de inatividade. Faz uma query mínima e retorna ok.
// Configurado via vercel.json: schedule '0 12 * * *' (12h UTC = 9h BRT).
//
// Também pode ser chamado manualmente: GET /api/heartbeat
export async function GET() {
  try {
    const supabase = createAdminClient()
    const { error } = await supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .limit(1)

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message, ts: new Date().toISOString() },
        { status: 500 },
      )
    }

    return NextResponse.json({
      ok: true,
      ts: new Date().toISOString(),
      message: 'Supabase ativo. Pausa por inatividade prevenida.',
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
