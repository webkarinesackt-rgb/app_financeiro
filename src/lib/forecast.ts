// Cálculos de previsão a partir do histórico de transações.
// 100% client-side, sem IA — usa estatística simples.

import type { Transaction } from '@/types'

export interface MonthlyTotal {
  monthKey: string   // 'YYYY-MM'
  monthLabel: string // 'Mai/2026'
  total: number
  count: number
}

export interface RecurringExpense {
  groupKey: string          // descrição normalizada
  sampleDescription: string // descrição original mais comum
  monthsOccurred: number    // em quantos meses apareceu
  totalOccurrences: number  // quantas linhas no histórico
  averageAmount: number     // média do valor por ocorrência
  lastSeen: string          // data mais recente (YYYY-MM-DD)
}

export interface ForecastResult {
  monthlyTotals: MonthlyTotal[]    // últimos N meses
  averageMonthly: number           // média dos últimos N meses
  medianMonthly: number            // mediana (menos sensível a outliers)
  recurring: RecurringExpense[]    // assinaturas/serviços detectados
  recurringMonthlyEstimate: number // soma dos averageAmount das recorrentes mensais
  currentMonthSpend: number        // gasto do mês corrente (parcial)
  currentMonthProjected: number    // projeção do mês corrente baseada em ritmo
  projections: MonthlyTotal[]      // próximos M meses (média + recorrentes)
  windowMonths: number
}

const MONTH_NAMES_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function monthKey(iso: string): string {
  return iso.slice(0, 7)  // 'YYYY-MM'
}

function monthLabel(key: string): string {
  const [y, m] = key.split('-')
  return `${MONTH_NAMES_PT[Number(m) - 1]}/${y.slice(2)}`
}

function nextMonth(key: string): string {
  const [y, m] = key.split('-').map(Number)
  const nm = m === 12 ? 1 : m + 1
  const ny = m === 12 ? y + 1 : y
  return `${ny}-${String(nm).padStart(2, '0')}`
}

// Normaliza descrição pra agrupar (CLICKUP 8886... → CLICKUP)
function normalizeDescription(desc: string): string {
  return desc
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\d+/g, ' ')           // remove números
    .replace(/[^a-z\s]/g, ' ')      // remove pontuação
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 3)                    // primeiros 3 tokens significativos
    .filter((w) => w.length >= 3)
    .join(' ')
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

export function buildForecast(
  transactions: Transaction[],
  options: { windowMonths?: number; projectionMonths?: number; fixedCostsMonthly?: number } = {}
): ForecastResult {
  const window = options.windowMonths ?? 6
  const projection = options.projectionMonths ?? 3
  const fixedCostsMonthly = options.fixedCostsMonthly ?? 0

  // Filtra só despesas
  const expenses = transactions.filter((t) => t.type === 'expense')

  // ─── Totais mensais ─────────────────────────────────────────────────────
  const totalsMap = new Map<string, { total: number; count: number }>()
  for (const tx of expenses) {
    const key = monthKey(tx.date)
    const cur = totalsMap.get(key) ?? { total: 0, count: 0 }
    cur.total += Number(tx.amount)
    cur.count += 1
    totalsMap.set(key, cur)
  }

  const today = new Date().toISOString().slice(0, 10)
  const currentMonthKey = today.slice(0, 7)

  // Ordena por mês decrescente e pega os N últimos (excluindo mês corrente para média)
  const allMonthKeys = Array.from(totalsMap.keys()).sort().reverse()
  const closedMonths = allMonthKeys.filter((k) => k !== currentMonthKey)
  const windowKeys = closedMonths.slice(0, window).reverse()  // ordem crescente p/ exibição

  const monthlyTotals: MonthlyTotal[] = windowKeys.map((k) => ({
    monthKey: k,
    monthLabel: monthLabel(k),
    total: totalsMap.get(k)!.total,
    count: totalsMap.get(k)!.count,
  }))

  const monthlyValues = monthlyTotals.map((m) => m.total)
  const averageMonthly = monthlyValues.length > 0
    ? monthlyValues.reduce((s, v) => s + v, 0) / monthlyValues.length
    : 0
  const medianMonthly = median(monthlyValues)

  // ─── Recorrentes ────────────────────────────────────────────────────────
  // Agrupa por descrição normalizada. Recorrente = aparece em ≥ 3 meses distintos.
  const groups = new Map<string, {
    sample: string
    months: Set<string>
    amounts: number[]
    dates: string[]
  }>()

  for (const tx of expenses) {
    const key = normalizeDescription(tx.description)
    if (!key || key.length < 3) continue
    const g = groups.get(key) ?? { sample: tx.description, months: new Set<string>(), amounts: [], dates: [] }
    g.months.add(monthKey(tx.date))
    g.amounts.push(Number(tx.amount))
    g.dates.push(tx.date)
    groups.set(key, g)
  }

  const recurring: RecurringExpense[] = []
  for (const [groupKey, g] of groups) {
    if (g.months.size < 3) continue  // precisa aparecer em pelo menos 3 meses
    const avg = g.amounts.reduce((s, v) => s + v, 0) / g.amounts.length
    recurring.push({
      groupKey,
      sampleDescription: g.sample,
      monthsOccurred: g.months.size,
      totalOccurrences: g.amounts.length,
      averageAmount: avg,
      lastSeen: g.dates.sort().slice(-1)[0],
    })
  }
  recurring.sort((a, b) => b.averageAmount - a.averageAmount)

  // Estimativa de recorrentes mensais = soma dos averages dos que apareceram
  // em pelo menos metade da janela
  const minMonthsForMonthly = Math.max(2, Math.floor(window / 2))
  const recurringMonthlyEstimate = recurring
    .filter((r) => r.monthsOccurred >= minMonthsForMonthly)
    .reduce((s, r) => s + r.averageAmount, 0)

  // ─── Mês corrente: gasto real vs projeção pelo ritmo ───────────────────
  const currentMonthSpend = totalsMap.get(currentMonthKey)?.total ?? 0
  const now = new Date()
  const dayOfMonth = now.getDate()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const currentMonthProjected = dayOfMonth > 3
    ? (currentMonthSpend / dayOfMonth) * daysInMonth
    : averageMonthly  // poucos dias do mês: usa média

  // ─── Projeção próximos meses ───────────────────────────────────────────
  // Soma da média histórica + custos fixos cadastrados (equipe, infra, ferramentas)
  const projections: MonthlyTotal[] = []
  let cursor = currentMonthKey
  for (let i = 0; i < projection; i++) {
    cursor = nextMonth(cursor)
    projections.push({
      monthKey: cursor,
      monthLabel: monthLabel(cursor),
      total: Math.round(averageMonthly + fixedCostsMonthly),
      count: 0,
    })
  }

  return {
    monthlyTotals,
    averageMonthly,
    medianMonthly,
    recurring,
    recurringMonthlyEstimate,
    currentMonthSpend,
    currentMonthProjected,
    projections,
    windowMonths: window,
  }
}
