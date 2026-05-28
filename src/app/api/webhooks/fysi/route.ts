import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Webhook receiver do briefing_app.
 *
 * Eventos esperados (header X-Fysi-Event):
 *   - cliente.criado          → no-op
 *   - contrato.assinado       → upsert em projects (status='closed').
 *                               Match por marcador no campo notes.
 *   - pagamento.atualizado    → update do project linkado.
 *
 * Validação: HMAC-SHA256(body, FYSI_WEBHOOK_SECRET) comparado ao header
 * X-Fysi-Signature.
 *
 * Match de project: procura pelo marcador "[fysi:<clientId>]" no campo
 * `notes`. Esse marcador é gravado pelo webhook como primeira linha,
 * assim conseguimos correlacionar sem precisar de coluna nova no schema.
 *
 * Envs:
 *   FYSI_WEBHOOK_SECRET     — segredo idêntico ao DASHBOARD_WEBHOOK_SECRET
 *   FYSI_OWNER_USER_ID      — auth.users.id dono dos projects criados
 */

interface BriefingCliente {
  id: string
  nome: string | null
  email: string | null
  empresa: string | null
  whatsapp: string | null
  cpf: string | null
  cnpj: string | null
  razao_social: string | null
  endereco: string | null
  cep: string | null
  project_type: string | null
}

interface ContratoData {
  autentique_document_id: string | null
  signed_url: string | null
  pacote_nome: string | null
  valor_parcelamento: string | null
  prazo_execucao: string | null
  escopo_projeto: string | null
  link_parcelamento: string | null
}

interface PagamentoData {
  total: number | null
  pago: number
  pendente: number
  observacao: string | null
}

interface WebhookBody {
  event: string
  emittedAt: string
  source: string
  clientId: string
  cliente: BriefingCliente
  contrato?: ContratoData
  pagamento?: PagamentoData
}

const PROJECT_KIND_LABELS: Record<string, string> = {
  'landing-com-copy': 'Landing com copy',
  'landing-sem-copy': 'Landing sem copy',
  'site-completo': 'Site completo',
  seo: 'SEO',
  outro: 'Outro',
}

function parseValorString(raw: string | null | undefined): number | null {
  if (!raw) return null
  const match = raw.match(/(\d{1,3}(?:\.\d{3})*(?:,\d{2})?|\d+(?:\.\d{2})?)/)
  if (!match) return null
  const cleaned = match[1].replace(/\./g, '').replace(',', '.')
  const n = Number(cleaned)
  return Number.isFinite(n) && n > 0 ? n : null
}

function validateSignature(rawBody: string, headerSig: string | null): boolean {
  const secret = process.env.FYSI_WEBHOOK_SECRET
  if (!secret || !headerSig) return false
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  if (expected.length !== headerSig.length) return false
  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(headerSig, 'hex'))
  } catch {
    return false
  }
}

function makeFysiMarker(clientId: string): string {
  return `[fysi:${clientId}]`
}

/**
 * Busca project existente pelo marcador "[fysi:<clientId>]" em notes.
 * Retorna o id do project, ou null se não achou.
 */
async function findProjectByFysiId(
  admin: ReturnType<typeof createAdminClient>,
  clientId: string,
): Promise<string | null> {
  const marker = makeFysiMarker(clientId)
  const { data } = await admin
    .from('projects')
    .select('id, notes')
    .like('notes', `%${marker}%`)
    .limit(1)
    .maybeSingle()
  return data?.id ?? null
}

export async function POST(request: NextRequest) {
  const ownerUserId = process.env.FYSI_OWNER_USER_ID
  if (!ownerUserId) {
    return NextResponse.json(
      { error: 'FYSI_OWNER_USER_ID not configured' },
      { status: 503 },
    )
  }

  // 1. Body raw (essencial pra validar HMAC).
  const rawBody = await request.text()

  // 2. Valida assinatura.
  const sig = request.headers.get('x-fysi-signature')
  if (!validateSignature(rawBody, sig)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
  }

  // 3. Parse JSON.
  let body: WebhookBody
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  if (body.source !== 'briefing_app') {
    return NextResponse.json({ error: 'unknown source' }, { status: 400 })
  }

  const admin = createAdminClient()
  const briefingClientId = body.clientId

  // ── cliente.criado: só loga (sem valor de contrato ainda). ──
  if (body.event === 'cliente.criado') {
    return NextResponse.json({ ok: true, action: 'logged' })
  }

  // ── contrato.assinado: upsert ──
  if (body.event === 'contrato.assinado') {
    if (!body.contrato) {
      return NextResponse.json({ error: 'missing contrato' }, { status: 400 })
    }

    const totalValue = parseValorString(body.contrato.valor_parcelamento)
    const existingId = await findProjectByFysiId(admin, briefingClientId)

    if (!totalValue) {
      if (existingId) {
        await admin
          .from('projects')
          .update({
            status: 'closed',
            notes: buildNotes(body),
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingId)
        return NextResponse.json({ ok: true, action: 'updated-no-value', projectId: existingId })
      }
      return NextResponse.json(
        { error: 'no value parseable, project not created' },
        { status: 422 },
      )
    }

    const projectKind = body.cliente.project_type
      ? PROJECT_KIND_LABELS[body.cliente.project_type] ?? body.cliente.project_type
      : null

    const name =
      body.cliente.empresa?.trim() ||
      body.cliente.nome?.trim() ||
      body.contrato.pacote_nome?.trim() ||
      'Sem nome'

    const payload = {
      user_id: ownerUserId,
      name,
      client_name: body.cliente.nome,
      whatsapp: body.cliente.whatsapp,
      total_value: totalValue,
      project_kind: projectKind,
      channel: 'briefing_app',
      status: 'closed',
      start_date: body.emittedAt.slice(0, 10),
      notes: buildNotes(body),
      payment_method: null,
    }

    if (existingId) {
      const { error } = await admin
        .from('projects')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', existingId)
      if (error) {
        console.error('[fysi webhook] update project failed:', error)
        return NextResponse.json({ error: 'update failed', detail: error.message }, { status: 500 })
      }
      return NextResponse.json({ ok: true, action: 'updated', projectId: existingId })
    }

    const { data: created, error } = await admin
      .from('projects')
      .insert(payload)
      .select('id')
      .single()
    if (error || !created) {
      console.error('[fysi webhook] insert project failed:', error)
      return NextResponse.json({ error: 'insert failed', detail: error?.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, action: 'created', projectId: created.id })
  }

  // ── pagamento.atualizado: update do project (se existir) ──
  if (body.event === 'pagamento.atualizado') {
    if (!body.pagamento) {
      return NextResponse.json({ error: 'missing pagamento' }, { status: 400 })
    }

    const existingId = await findProjectByFysiId(admin, briefingClientId)
    if (!existingId) {
      return NextResponse.json({ ok: true, action: 'skipped-no-project' })
    }

    // Carrega o total_value atual pra calcular se quitou
    const { data: current } = await admin
      .from('projects')
      .select('total_value')
      .eq('id', existingId)
      .maybeSingle()

    const total = body.pagamento.total ?? Number(current?.total_value ?? 0)
    const pago = body.pagamento.pago
    const quitado = total > 0 && pago >= total

    const updates: Record<string, unknown> = {
      notes: buildNotes(body),
      updated_at: new Date().toISOString(),
    }
    if (body.pagamento.total && body.pagamento.total > 0) {
      updates.total_value = body.pagamento.total
    }
    if (quitado) {
      updates.status = 'paid'
    }

    const { error } = await admin.from('projects').update(updates).eq('id', existingId)
    if (error) {
      console.error('[fysi webhook] update payment failed:', error)
      return NextResponse.json({ error: 'update failed', detail: error.message }, { status: 500 })
    }
    return NextResponse.json({
      ok: true,
      action: 'updated',
      projectId: existingId,
      quitado,
    })
  }

  return NextResponse.json({ ok: true, action: 'unknown-event', event: body.event })
}

/**
 * Monta as notas. PRIMEIRA LINHA é o marcador "[fysi:<clientId>]" — usado
 * pelo receiver pra correlacionar updates futuros ao mesmo project.
 */
function buildNotes(body: WebhookBody): string {
  const lines: string[] = []
  lines.push(makeFysiMarker(body.clientId))
  lines.push(`Origem: briefing_app`)
  if (body.cliente.email) lines.push(`Email: ${body.cliente.email}`)
  if (body.cliente.cpf) lines.push(`CPF: ${body.cliente.cpf}`)
  if (body.cliente.cnpj) lines.push(`CNPJ: ${body.cliente.cnpj}`)

  if (body.contrato) {
    if (body.contrato.pacote_nome) lines.push(`Pacote: ${body.contrato.pacote_nome}`)
    if (body.contrato.valor_parcelamento)
      lines.push(`Valor: ${body.contrato.valor_parcelamento}`)
    if (body.contrato.prazo_execucao) lines.push(`Prazo: ${body.contrato.prazo_execucao}`)
    if (body.contrato.link_parcelamento)
      lines.push(`Link parcelamento: ${body.contrato.link_parcelamento}`)
    if (body.contrato.signed_url) lines.push(`PDF assinado: ${body.contrato.signed_url}`)
    if (body.contrato.escopo_projeto) {
      lines.push('Escopo:')
      lines.push(body.contrato.escopo_projeto)
    }
  }

  if (body.pagamento) {
    lines.push('')
    lines.push(
      `Pagamento: R$${body.pagamento.pago.toFixed(2)} de R$${(body.pagamento.total ?? 0).toFixed(2)} (pendente R$${body.pagamento.pendente.toFixed(2)})`,
    )
    if (body.pagamento.observacao) lines.push(`Obs: ${body.pagamento.observacao}`)
  }

  lines.push(`Atualizado: ${body.emittedAt}`)
  return lines.join('\n')
}
