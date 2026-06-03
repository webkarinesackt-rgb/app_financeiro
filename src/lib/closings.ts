import { createClient } from '@/lib/supabase/client'
import type { Closing, ClosingFormData } from '@/types'

const ROW = `id, user_id, name, client_name, project_kind, total_value,
  channel, market, business_model, segment, whatsapp,
  start_date, status, notes, mark_to_collect, created_at, updated_at`

function toRow(data: ClosingFormData) {
  return {
    name: data.client_name,
    client_name: data.client_name,
    project_kind: data.project_kind,
    total_value: data.total_value,
    channel: data.channel,
    market: data.market,
    business_model: data.business_model,
    segment: data.segment,
    whatsapp: data.whatsapp,
    start_date: data.start_date,
    status: data.status,
    notes: data.notes,
  }
}

export interface ClosingsFilter {
  month?: number
  year?: number
  status?: string
  channel?: string
}

export async function getClosings(filter: ClosingsFilter = {}): Promise<Closing[]> {
  const supabase = createClient()
  let query = supabase.from('projects').select(ROW).order('start_date', { ascending: false })

  if (filter.month && filter.year) {
    const from = `${filter.year}-${String(filter.month).padStart(2, '0')}-01`
    const next = filter.month === 12
      ? `${filter.year + 1}-01-01`
      : `${filter.year}-${String(filter.month + 1).padStart(2, '0')}-01`
    query = query.gte('start_date', from).lt('start_date', next)
  }
  if (filter.status && filter.status !== 'all') query = query.eq('status', filter.status)
  if (filter.channel && filter.channel !== 'all') query = query.eq('channel', filter.channel)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as Closing[]
}

export async function createClosing(data: ClosingFormData): Promise<Closing> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data: row, error } = await supabase
    .from('projects')
    .insert({ ...toRow(data), user_id: user.id, payment_method: null })
    .select(ROW)
    .single()
  if (error) throw error
  return row as Closing
}

export async function updateClosing(id: string, data: ClosingFormData): Promise<Closing> {
  const supabase = createClient()
  const { data: row, error } = await supabase
    .from('projects')
    .update({ ...toRow(data), updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(ROW)
    .single()
  if (error) throw error
  return row as Closing
}

export async function deleteClosing(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('projects').delete().eq('id', id)
  if (error) throw error
}

// Liga/desliga a flag "a cobrar" — quando true, o fechamento aparece
// explicitamente em /a-cobrar mesmo sem pagamento detectado.
export async function setMarkToCollect(id: string, mark: boolean): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('projects')
    .update({ mark_to_collect: mark, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}
