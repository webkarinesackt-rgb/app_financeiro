import type { AsaasTransfer } from './client'

// Transferência cujo destinatário é a própria Fysi — movimentação interna,
// não conta como despesa.
export function isFysiTransfer(transfer: AsaasTransfer): boolean {
  const owner = transfer.bankAccount?.ownerName ?? ''
  return /fysi/i.test(owner)
}

export interface MappedExpense {
  type: 'expense'
  amount: number
  description: string
  date: string
  category: 'other'
  custom_category: null
  payment_method: 'pix' | 'transfer'
  notes: string
}

// Converte uma transferência de saída do Asaas numa despesa sem categoria.
// O valor é o pagamento ao terceiro; a taxa entra apenas nas notas.
export function mapTransferToExpense(transfer: AsaasTransfer): MappedExpense {
  const owner = transfer.bankAccount?.ownerName?.trim()
  const description = owner || transfer.description?.trim() || 'Transferência Asaas'
  const fee = transfer.transferFee ?? 0
  return {
    type: 'expense',
    amount: transfer.value,
    description,
    date: transfer.effectiveDate ?? transfer.dateCreated,
    category: 'other',
    custom_category: null,
    payment_method: transfer.type === 'PIX' ? 'pix' : 'transfer',
    notes: `Asaas transferência ${transfer.type}${fee > 0 ? ` • taxa R$ ${fee.toFixed(2)}` : ''}`,
  }
}
