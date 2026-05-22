import { describe, it, expect } from 'vitest'
import { parseBankCsv } from '@/lib/bank-csv'

// Extrato de conta corrente do Banco Inter: colunas separadas
// "Histórico" (tipo: Pix enviado) e "Descrição" (nome do pagador/recebedor).
const INTER_CHECKING = `Extrato Conta Corrente
Conta ;232818495
Período ;01/01/2025 a 19/05/2026
Saldo ;0,00

Data Lançamento;Histórico;Descrição;Valor;Saldo
07/05/2026;Pix enviado ;Andrei Da Silva 11314995901;-348,79;0,00
04/05/2026;Pix recebido;Vanderlei Da Silva;990,00;1.598,62
04/05/2026;Resgate;Cdb Di Liq Banco Inter Sa;1.047,52;429,78`

describe('parseBankCsv — extrato de conta corrente Inter', () => {
  it('detecta o formato checking', () => {
    expect(parseBankCsv(INTER_CHECKING).format).toBe('checking')
  })

  it('mantém o NOME do pagamento na descrição (não só "Pix enviado")', () => {
    const { transactions } = parseBankCsv(INTER_CHECKING)
    const andrei = transactions.find((t) => t.description.includes('Andrei Da Silva'))
    expect(andrei).toBeDefined()
    expect(andrei!.description).toContain('Pix enviado')
    expect(andrei!.description).toContain('Andrei Da Silva')
  })

  it('classifica o sinal: negativo = expense, positivo = income', () => {
    const { transactions } = parseBankCsv(INTER_CHECKING)
    const andrei = transactions.find((t) => t.description.includes('Andrei Da Silva 11314995901'))
    const vanderlei = transactions.find((t) => t.description.includes('Vanderlei'))
    expect(andrei!.type).toBe('expense')
    expect(vanderlei!.type).toBe('income')
  })
})
