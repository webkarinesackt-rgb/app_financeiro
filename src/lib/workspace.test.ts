import { describe, it, expect, vi, afterEach } from 'vitest'
import { parseWorkspace, getClientWorkspace } from './workspace'

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

describe('getClientWorkspace', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns business when no cookie present', () => {
    vi.stubGlobal('document', { cookie: '' })
    expect(getClientWorkspace()).toBe('business')
  })

  it('returns personal when cookie is workspace=personal', () => {
    vi.stubGlobal('document', { cookie: 'workspace=personal' })
    expect(getClientWorkspace()).toBe('personal')
  })
})
