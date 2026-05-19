import { createClient } from '@/lib/supabase/client'
import type {
  FixedCost, FixedCostFormData, FixedCostFrequency, FixedCostCategory,
} from '@/types'
import { FREQUENCY_TO_MONTHLY } from '@/types'

const ROW = 'id, user_id, name, amount, frequency, category, notes, active, created_at, updated_at'

export async function getFixedCosts(): Promise<FixedCost[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('fixed_costs')
    .select(ROW)
    .order('amount', { ascending: false })
  if (error) throw error
  return (data ?? []) as FixedCost[]
}

export async function createFixedCost(data: FixedCostFormData): Promise<FixedCost> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data: row, error } = await supabase
    .from('fixed_costs')
    .insert({ ...data, user_id: user.id })
    .select(ROW)
    .single()
  if (error) throw error
  return row as FixedCost
}

export async function createFixedCostsBulk(items: FixedCostFormData[]): Promise<FixedCost[]> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const payload = items.map((d) => ({ ...d, user_id: user.id }))
  const { data: rows, error } = await supabase
    .from('fixed_costs')
    .insert(payload)
    .select(ROW)
  if (error) throw error
  return (rows ?? []) as FixedCost[]
}

export async function updateFixedCost(id: string, data: Partial<FixedCostFormData>): Promise<FixedCost> {
  const supabase = createClient()
  const { data: row, error } = await supabase
    .from('fixed_costs')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(ROW)
    .single()
  if (error) throw error
  return row as FixedCost
}

export async function deleteFixedCost(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('fixed_costs').delete().eq('id', id)
  if (error) throw error
}

// Soma os custos fixos ativos convertidos pra valor mensal equivalente.
export function sumMonthlyFixedCosts(costs: FixedCost[]): number {
  return costs
    .filter((c) => c.active)
    .reduce((sum, c) => sum + Number(c.amount) * FREQUENCY_TO_MONTHLY[c.frequency], 0)
}

// ─── Parser de CSV de custos fixos ───────────────────────────────────────────
// Formato esperado (flexível):
//   nome,valor,frequencia,categoria
//   "Designer Junior",2500,monthly,team
//   "Aluguel sala",1800,monthly,infra

interface ParsedRow {
  name: string
  amount: number
  frequency: FixedCostFrequency
  category: FixedCostCategory
}

const FREQUENCY_ALIASES: Record<string, FixedCostFrequency> = {
  semanal: 'weekly', weekly: 'weekly',
  quinzenal: 'biweekly', biweekly: 'biweekly',
  mensal: 'monthly', monthly: 'monthly', mes: 'monthly',
  trimestral: 'quarterly', quarterly: 'quarterly',
  anual: 'yearly', yearly: 'yearly', ano: 'yearly',
}

const CATEGORY_ALIASES: Record<string, FixedCostCategory> = {
  equipe: 'team', team: 'team', pessoa: 'team', pessoal: 'team', salario: 'team',
  ferramenta: 'tools', ferramentas: 'tools', tools: 'tools', software: 'tools',
  assinatura: 'tools', assinaturas: 'tools', saas: 'tools',
  infra: 'infra', infraestrutura: 'infra', infrastructure: 'infra', servidor: 'infra',
  hosting: 'infra', aluguel: 'infra',
  marketing: 'marketing', ads: 'marketing', anuncio: 'marketing', publicidade: 'marketing',
  imposto: 'taxes', impostos: 'taxes', taxes: 'taxes', tax: 'taxes', das: 'taxes', mei: 'taxes',
  outro: 'other', outros: 'other', other: 'other',
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
      else { inQuote = !inQuote }
    } else if (c === delim && !inQuote) {
      out.push(cur); cur = ''
    } else { cur += c }
  }
  out.push(cur)
  return out.map((s) => s.trim())
}

export interface FixedCostCsvResult {
  rows: ParsedRow[]
  warnings: string[]
  skipped: number
}

export function parseFixedCostsCsv(text: string): FixedCostCsvResult {
  const warnings: string[] = []
  const normalized = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n')
  const lines = normalized.split('\n').filter((l) => l.trim().length > 0)
  if (lines.length === 0) {
    return { rows: [], warnings: ['Arquivo vazio'], skipped: 0 }
  }

  // Detecta delimitador
  const sample = lines[0]
  const semis = (sample.match(/;/g) ?? []).length
  const commas = (sample.match(/,/g) ?? []).length
  const delim = semis > commas ? ';' : ','

  // Cabeçalho
  const headers = parseCsvLine(lines[0], delim).map(normHeader)
  const idx = {
    name: headers.findIndex((h) => /^(nome|name|descric|item)/.test(h)),
    amount: headers.findIndex((h) => /^(valor|amount|preco|custo)/.test(h)),
    frequency: headers.findIndex((h) => /^(frequenc|periodicidade|freq)/.test(h)),
    category: headers.findIndex((h) => /^(categoria|category|tipo)/.test(h)),
  }

  if (idx.name === -1 || idx.amount === -1) {
    return {
      rows: [], skipped: lines.length - 1,
      warnings: [`Cabeçalho deve ter pelo menos colunas "nome" e "valor". Lido: ${headers.join(', ')}`],
    }
  }

  const rows: ParsedRow[] = []
  let skipped = 0
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i], delim)
    const name = (cells[idx.name] ?? '').trim()
    const amount = parseAmount(cells[idx.amount] ?? '')
    if (!name || isNaN(amount) || amount <= 0) { skipped++; continue }

    const freqRaw = idx.frequency !== -1 ? normHeader(cells[idx.frequency] ?? '') : ''
    const catRaw = idx.category !== -1 ? normHeader(cells[idx.category] ?? '') : ''
    const frequency = FREQUENCY_ALIASES[freqRaw] ?? 'monthly'
    const category = CATEGORY_ALIASES[catRaw] ?? 'team'

    rows.push({ name, amount, frequency, category })
  }

  return { rows, warnings, skipped }
}
