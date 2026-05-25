import { describe, it, expect } from 'vitest'
import { parseWorkspace } from './workspace'

describe('parseWorkspace', () => {
  it('returns business as default when value is undefined', () => {
    expect(parseWorkspace(undefined)).toBe('business')
  })

  it('returns business when value is empty', () => {
    expect(parseWorkspace('')).toBe('business')
  })

  it('returns personal when value is personal', () => {
    expect(parseWorkspace('personal')).toBe('personal')
  })

  it('returns business when value is business', () => {
    expect(parseWorkspace('business')).toBe('business')
  })

  it('falls back to business for invalid values', () => {
    expect(parseWorkspace('xyz')).toBe('business')
  })
})
