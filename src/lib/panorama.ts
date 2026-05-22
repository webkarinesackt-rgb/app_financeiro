import { getMonthName } from '@/lib/format'

export interface MonthRef {
  month: number
  year: number
}

// Últimos `count` meses incluindo o mês de `now`, do mais antigo ao mais recente.
export function getTrendMonths(now: Date, count: number): MonthRef[] {
  const result: MonthRef[] = []
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    result.push({ month: d.getMonth() + 1, year: d.getFullYear() })
  }
  return result
}

// Meses de janeiro (1) até `throughMonth` inclusive.
export function getYearToDateMonths(throughMonth: number): number[] {
  return Array.from({ length: throughMonth }, (_, i) => i + 1)
}

// Rótulo do intervalo do início do ano até o mês: "Jan–Mai 2026".
export function yearToDateLabel(throughMonth: number, year: number): string {
  const first = capitalize(getMonthName(1).slice(0, 3))
  const last = capitalize(getMonthName(throughMonth).slice(0, 3))
  return throughMonth === 1 ? `${last} ${year}` : `${first}–${last} ${year}`
}

interface OriginInput {
  type: string
  amount: number
  credit_card_id: string | null
  integration_id: string | null
}

export interface OriginSplit {
  card: number
  account: number
  asaas: number
}

// Soma as despesas separando por origem: cartão de crédito, Asaas (integração)
// ou conta bancária.
export function splitExpensesByOrigin(txs: OriginInput[]): OriginSplit {
  const split: OriginSplit = { card: 0, account: 0, asaas: 0 }
  for (const t of txs) {
    if (t.type !== 'expense') continue
    const amount = Number(t.amount)
    if (t.credit_card_id) split.card += amount
    else if (t.integration_id) split.asaas += amount
    else split.account += amount
  }
  return split
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
