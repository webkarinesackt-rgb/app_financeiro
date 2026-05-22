import { describe, it, expect } from 'vitest'
import { isFysiTransfer, mapTransferToExpense } from '@/lib/asaas/transfers'
import type { AsaasTransfer } from '@/lib/asaas/client'

function transfer(overrides: Partial<AsaasTransfer>): AsaasTransfer {
  return {
    id: 'tra_1', dateCreated: '2026-05-01', effectiveDate: '2026-05-02',
    status: 'DONE', type: 'PIX', value: 1000, netValue: 1000, transferFee: 0,
    description: null, bankAccount: null, pixAddressKey: null, ...overrides,
  }
}

describe('isFysiTransfer', () => {
  it('é true quando o destinatário tem "Fysi" no nome', () => {
    expect(isFysiTransfer(transfer({ bankAccount: { ownerName: 'Fysi Lab Digital' } }))).toBe(true)
  })
  it('é false para um terceiro', () => {
    expect(isFysiTransfer(transfer({ bankAccount: { ownerName: 'Leo Souza' } }))).toBe(false)
  })
  it('é false quando não há dados de conta', () => {
    expect(isFysiTransfer(transfer({ bankAccount: null }))).toBe(false)
  })
})

describe('mapTransferToExpense', () => {
  it('mapeia uma transferência para uma despesa sem categoria', () => {
    const m = mapTransferToExpense(transfer({
      value: 1500, type: 'PIX', effectiveDate: '2026-05-03',
      bankAccount: { ownerName: 'Sara Lima' }, transferFee: 0,
    }))
    expect(m).toMatchObject({
      type: 'expense', amount: 1500, description: 'Sara Lima',
      date: '2026-05-03', category: 'other', custom_category: null, payment_method: 'pix',
    })
  })
  it('usa dateCreated quando effectiveDate é nulo e registra a taxa nas notas', () => {
    const m = mapTransferToExpense(transfer({
      effectiveDate: null, dateCreated: '2026-05-01', type: 'TED',
      transferFee: 5, bankAccount: { ownerName: 'Leo Souza' },
    }))
    expect(m.date).toBe('2026-05-01')
    expect(m.payment_method).toBe('transfer')
    expect(m.notes).toContain('taxa R$ 5.00')
  })
})
