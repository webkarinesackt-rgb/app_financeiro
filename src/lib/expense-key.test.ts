import { describe, it, expect } from 'vitest'
import {
  extractExpenseKey, buildMerchantCategoryMap, matchMerchantCategory,
} from '@/lib/expense-key'

describe('extractExpenseKey', () => {
  it('extrai o destinatário de um Pix com Cp', () => {
    expect(extractExpenseKey('Pix enviado: Cp :12345-Joao da Silva 987654')).toBe('Joao da Silva')
  })
  it('extrai os tokens significativos de uma compra de cartão', () => {
    expect(extractExpenseKey('FACEBK 347GXKDYT2 SAO PAULO BRA')).toBe('FACEBK')
  })
  it('devolve null para descrições muito curtas', () => {
    expect(extractExpenseKey('AB')).toBeNull()
  })

  it('extrai o nome depois do separador " · " (extrato de conta)', () => {
    expect(extractExpenseKey('Pix enviado · Andrei Da Silva 11314995901')).toBe('Andrei Da Silva')
    expect(extractExpenseKey('Pix recebido · Cristina Bozan Zanghelini')).toBe('Cristina Bozan Zanghelini')
  })
})

describe('buildMerchantCategoryMap / matchMerchantCategory', () => {
  it('casa uma descrição nova pelo mesmo lojista de uma já categorizada', () => {
    // Descrições reais de cartão: lojista + ID longo de transação + cidade/UF.
    const map = buildMerchantCategoryMap([
      { description: 'FACEBK 347GXKDYT2 SAO PAULO BRA', custom_category: 'Marketing', subcategory: null },
    ])
    expect(matchMerchantCategory('FACEBK 882HHQPLM1 RIO DE J BRA', map)).toEqual({
      custom_category: 'Marketing', subcategory: null,
    })
  })
  it('devolve null quando não há lojista correspondente', () => {
    const map = buildMerchantCategoryMap([])
    expect(matchMerchantCategory('CLICKUP 8886254258 CA', map)).toBeNull()
  })
})
