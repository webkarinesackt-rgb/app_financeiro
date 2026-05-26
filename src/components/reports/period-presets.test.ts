import { describe, it, expect } from 'vitest'
import { presetToRange } from './period-presets'

describe('presetToRange', () => {
  const NOW = new Date(2026, 4, 15)  // May 2026 (month index 4)

  it('this_month returns May 2026 single', () => {
    expect(presetToRange('this_month', NOW)).toEqual({ from: '2026-05', to: '2026-05' })
  })

  it('last_month returns April 2026 single', () => {
    expect(presetToRange('last_month', NOW)).toEqual({ from: '2026-04', to: '2026-04' })
  })

  it('last_3_months returns Mar..May 2026', () => {
    expect(presetToRange('last_3_months', NOW)).toEqual({ from: '2026-03', to: '2026-05' })
  })

  it('last_6_months returns Dec 2025..May 2026', () => {
    expect(presetToRange('last_6_months', NOW)).toEqual({ from: '2025-12', to: '2026-05' })
  })

  it('this_year returns Jan..May 2026', () => {
    expect(presetToRange('this_year', NOW)).toEqual({ from: '2026-01', to: '2026-05' })
  })

  it('last_year returns Jan..Dec 2025', () => {
    expect(presetToRange('last_year', NOW)).toEqual({ from: '2025-01', to: '2025-12' })
  })
})
