import { describe, it, expect } from 'vitest'
import {
  getTrendMonths, getYearToDateMonths, yearToDateLabel, splitExpensesByOrigin,
} from '@/lib/panorama'

describe('getTrendMonths', () => {
  it('devolve os últimos N meses incluindo o atual, do mais antigo ao mais recente', () => {
    const r = getTrendMonths(new Date(2026, 4, 15), 6) // maio/2026
    expect(r).toHaveLength(6)
    expect(r[0]).toEqual({ month: 12, year: 2025 })
    expect(r[5]).toEqual({ month: 5, year: 2026 })
  })
  it('atravessa a virada de ano corretamente', () => {
    const r = getTrendMonths(new Date(2026, 0, 10), 3) // janeiro/2026
    expect(r).toEqual([
      { month: 11, year: 2025 }, { month: 12, year: 2025 }, { month: 1, year: 2026 },
    ])
  })
})

describe('getYearToDateMonths', () => {
  it('devolve de janeiro até o mês informado', () => {
    expect(getYearToDateMonths(5)).toEqual([1, 2, 3, 4, 5])
    expect(getYearToDateMonths(1)).toEqual([1])
  })
})

describe('yearToDateLabel', () => {
  it('formata o intervalo Jan–mês', () => {
    expect(yearToDateLabel(5, 2026)).toBe('Jan–Mai 2026')
  })
  it('usa só o mês quando o intervalo é janeiro', () => {
    expect(yearToDateLabel(1, 2025)).toBe('Jan 2025')
  })
})

describe('splitExpensesByOrigin', () => {
  it('classifica despesas por cartão, asaas e conta; ignora receitas', () => {
    const r = splitExpensesByOrigin([
      { type: 'expense', amount: 100, credit_card_id: 'c1', integration_id: null },
      { type: 'expense', amount: 50, credit_card_id: null, integration_id: 'i1' },
      { type: 'expense', amount: 30, credit_card_id: null, integration_id: null },
      { type: 'income', amount: 999, credit_card_id: null, integration_id: null },
    ])
    expect(r).toEqual({ card: 100, asaas: 50, account: 30 })
  })
})
