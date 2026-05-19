import { createClient } from '@/lib/supabase/client'
import type { RecurringClient, RecurringClientFormData } from '@/types'

const ROW = 'id, user_id, name, amount, billing_day, service_type, active, notes, started_at, created_at, updated_at'

export async function getRecurringClients(): Promise<RecurringClient[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('recurring_clients')
    .select(ROW)
    .order('amount', { ascending: false })
  if (error) throw error
  return (data ?? []) as RecurringClient[]
}

export async function createRecurringClient(data: RecurringClientFormData): Promise<RecurringClient> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')
  const { data: row, error } = await supabase
    .from('recurring_clients')
    .insert({ ...data, user_id: user.id })
    .select(ROW)
    .single()
  if (error) throw error
  return row as RecurringClient
}

export async function createRecurringClientsBulk(items: RecurringClientFormData[]): Promise<RecurringClient[]> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')
  const payload = items.map((d) => ({ ...d, user_id: user.id }))
  const { data: rows, error } = await supabase
    .from('recurring_clients')
    .insert(payload)
    .select(ROW)
  if (error) throw error
  return (rows ?? []) as RecurringClient[]
}

export async function updateRecurringClient(id: string, data: Partial<RecurringClientFormData>): Promise<RecurringClient> {
  const supabase = createClient()
  const { data: row, error } = await supabase
    .from('recurring_clients')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(ROW)
    .single()
  if (error) throw error
  return row as RecurringClient
}

export async function deleteRecurringClient(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('recurring_clients').delete().eq('id', id)
  if (error) throw error
}

export function sumMonthlyRecurringRevenue(clients: RecurringClient[]): number {
  return clients
    .filter((c) => c.active)
    .reduce((sum, c) => sum + Number(c.amount), 0)
}

// ─── Parser de CSV (formato simples: nome, valor, [dia], [servico]) ──────────

interface ParsedRow {
  name: string
  amount: number
  billing_day: number | null
  service_type: string | null
}

function normHeader(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

function parseAmount(raw: string): number {
  const cleaned = raw.replace(/[^\d.,\-+]/g, '').trim()
  if (!cleaned) return NaN
  if (cleaned.includes(',')) return Number(cleaned.replace(/\./g, '').replace(',', '.'))
  return Number(cleaned)
}

function parseCsvLine(line: string, delim: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuote = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++ }
      else inQuote = !inQuote
    } else if (c === delim && !inQuote) {
      out.push(cur); cur = ''
    } else cur += c
  }
  out.push(cur)
  return out.map((s) => s.trim())
}

export interface RecurringClientsCsvResult {
  rows: ParsedRow[]
  warnings: string[]
  skipped: number
}

export function parseRecurringClientsCsv(text: string): RecurringClientsCsvResult {
  const normalized = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n')
  const lines = normalized.split('\n').filter((l) => l.trim().length > 0)
  if (lines.length === 0) return { rows: [], warnings: ['Arquivo vazio'], skipped: 0 }

  const sample = lines[0]
  const delim = (sample.match(/;/g) ?? []).length > (sample.match(/,/g) ?? []).length ? ';' : ','

  const headers = parseCsvLine(lines[0], delim).map(normHeader)
  const idx = {
    name: headers.findIndex((h) => /^(nome|name|cliente)/.test(h)),
    amount: headers.findIndex((h) => /^(valor|amount|mensal|preco)/.test(h)),
    day: headers.findIndex((h) => /^(dia|day|venc)/.test(h)),
    service: headers.findIndex((h) => /^(servico|service|tipo|projeto)/.test(h)),
  }

  if (idx.name === -1 || idx.amount === -1) {
    return {
      rows: [], skipped: lines.length - 1,
      warnings: [`Cabeçalho deve ter "nome" e "valor". Lido: ${headers.join(', ')}`],
    }
  }

  const rows: ParsedRow[] = []
  let skipped = 0
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i], delim)
    const name = (cells[idx.name] ?? '').trim()
    const amount = parseAmount(cells[idx.amount] ?? '')
    if (!name || isNaN(amount) || amount <= 0) { skipped++; continue }
    const dayRaw = idx.day !== -1 ? parseInt((cells[idx.day] ?? '').trim()) : NaN
    const billing_day = !isNaN(dayRaw) && dayRaw >= 1 && dayRaw <= 31 ? dayRaw : null
    const service_type = idx.service !== -1 ? ((cells[idx.service] ?? '').trim() || null) : null
    rows.push({ name, amount, billing_day, service_type })
  }
  return { rows, warnings: [], skipped }
}
