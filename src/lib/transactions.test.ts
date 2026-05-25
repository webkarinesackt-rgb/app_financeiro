import { describe, it, expect } from 'vitest'
import { computeDateRange } from './transactions'

describe('computeDateRange', () => {
  it('returns [first day of from, last day of to] for YYYY-MM inputs', () => {
    const { start, end } = computeDateRange('2026-01', '2026-03')
    expect(start).toBe('2026-01-01')
    expect(end).toBe('2026-03-31')
  })

  it('handles single month range (from == to)', () => {
    const { start, end } = computeDateRange('2026-05', '2026-05')
    expect(start).toBe('2026-05-01')
    expect(end).toBe('2026-05-31')
  })

  it('handles february leap year', () => {
    const { start, end } = computeDateRange('2024-02', '2024-02')
    expect(start).toBe('2024-02-01')
    expect(end).toBe('2024-02-29')
  })
})
