import { describe, it, expect } from 'vitest'
import { computeDelta, shiftRange, sameSizePrevRange } from './comparison'

describe('computeDelta', () => {
  it('returns absolute and percent diff', () => {
    expect(computeDelta(120, 100)).toEqual({ abs: 20, pct: 20 })
  })

  it('returns abs only when previous is 0', () => {
    expect(computeDelta(100, 0)).toEqual({ abs: 100, pct: null })
  })

  it('handles decrease', () => {
    expect(computeDelta(80, 100)).toEqual({ abs: -20, pct: -20 })
  })

  it('returns zero delta when same', () => {
    expect(computeDelta(50, 50)).toEqual({ abs: 0, pct: 0 })
  })
})

describe('shiftRange', () => {
  it('shifts by 12 months (same period last year)', () => {
    expect(shiftRange({ from: '2026-05', to: '2026-05' }, 12)).toEqual({
      from: '2025-05', to: '2025-05',
    })
  })

  it('handles multi-month range', () => {
    expect(shiftRange({ from: '2026-03', to: '2026-05' }, 12)).toEqual({
      from: '2025-03', to: '2025-05',
    })
  })
})

describe('sameSizePrevRange', () => {
  it('previous month for single-month range', () => {
    expect(sameSizePrevRange({ from: '2026-05', to: '2026-05' })).toEqual({
      from: '2026-04', to: '2026-04',
    })
  })

  it('previous quarter for 3-month range', () => {
    expect(sameSizePrevRange({ from: '2026-04', to: '2026-06' })).toEqual({
      from: '2026-01', to: '2026-03',
    })
  })

  it('crosses year boundary', () => {
    expect(sameSizePrevRange({ from: '2026-01', to: '2026-02' })).toEqual({
      from: '2025-11', to: '2025-12',
    })
  })
})
