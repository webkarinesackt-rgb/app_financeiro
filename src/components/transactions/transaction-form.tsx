'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Loader2, RefreshCw, CreditCard as CardIcon, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { createTransaction, updateTransaction } from '@/lib/transactions'
import { parseBRLAmount } from '@/lib/format'
import { getAccounts } from '@/lib/accounts'
import { getCreditCards } from '@/lib/credit-cards'
import {
  CATEGORY_LABELS, RECURRENCE_LABELS, PAYMENT_METHOD_LABELS,
  INCOME_CATEGORIES, EXPENSE_CATEGORIES, ACCOUNT_PAYMENT_METHODS,
  type Transaction, type TransactionFormData, type TransactionType,
  type Category, type RecurrenceInterval, type PaymentMethod,
  type Account, type CreditCard,
} from '@/types'

interface TransactionFormProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  transaction?: Transaction
  defaultType?: 'income' | 'expense'
}

const today = new Date().toISOString().split('T')[0]

export function TransactionForm({ open, onClose, onSuccess, transaction, defaultType = 'expense' }: TransactionFormProps) {
  const isEditing = !!transaction
  const [loading, setLoading] = useState(false)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [cards, setCards] = useState<CreditCard[]>([])

  const [type, setType] = useState<TransactionType>(transaction?.type ?? defaultType)
  const [amount, setAmount] = useState(transaction ? String(transaction.amount) : '')
  const [description, setDescription] = useState(transaction?.description ?? '')
  const [category, setCategory] = useState<Category>(transaction?.category ?? (defaultType === 'income' ? 'salary' : 'food'))
  const [customCategory, setCustomCategory] = useState(transaction?.custom_category ?? '')
  const [date, setDate] = useState(transaction?.date ?? today)
  const [accountId, setAccountId] = useState(transaction?.account_id ?? '')
  const [creditCardId, setCreditCardId] = useState(transaction?.credit_card_id ?? '')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(transaction?.payment_method ?? 'pix')
  const [installmentTotal, setInstallmentTotal] = useState(transaction?.installment_total ? String(transaction.installment_total) : '')
  const [isInstallment, setIsInstallment] = useState(!!(transaction?.installment_total && transaction.installment_total > 1))
  const [incomeInstallmentTotal, setIncomeInstallmentTotal] = useState('')
  const [isIncomeInstallment, setIsIncomeInstallment] = useState(false)
  const [incomeInstallmentDelay, setIncomeInstallmentDelay] = useState('1')
  const [notes, setNotes] = useState(transaction?.notes ?? '')
  const [isRecurring, setIsRecurring] = useState(transaction?.is_recurring ?? false)
  const [recurrenceInterval, setRecurrenceInterval] = useState<RecurrenceInterval>(transaction?.recurrence_interval ?? 'monthly')

  const usingCard = !!creditCardId
  const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES

  useEffect(() => {
    if (!open) return
    getAccounts().then(setAccounts).catch(() => {})
    getCreditCards().then(setCards).catch(() => {})
  }, [open])

  function handleTypeChange(newType: TransactionType) {
    setType(newType)
    setCategory(newType === 'income' ? 'salary' : 'food')
    setCustomCategory('')
    setCreditCardId('')
    setIsInstallment(false)
    setIsIncomeInstallment(false)
  }

  function handleAccountCardChange(value: string | null) {
    if (!value) return
    if (value.startsWith('acc:')) {
      setAccountId(value.replace('acc:', ''))
      setCreditCardId('')
      setIsInstallment(false)
    } else if (value.startsWith('card:')) {
      setCreditCardId(value.replace('card:', ''))
      setAccountId('')
      setPaymentMethod('credit')
    }
  }

  function handleCategoryChange(value: string | null) {
    if (!value) return
    setCategory(value as Category)
    if (value !== 'custom') setCustomCategory('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const numAmount = parseBRLAmount(amount)
    if (isNaN(numAmount) || numAmount <= 0) { toast.error('Valor inválido'); return }
    if (category === 'custom' && !customCategory.trim()) { toast.error('Informe o nome da categoria personalizada'); return }

    const data: TransactionFormData = {
      type, amount: numAmount, description,
      category,
      custom_category: category === 'custom' ? customCategory.trim() : null,
      date,
      account_id: accountId || null,
      credit_card_id: creditCardId || null,
      payment_method: usingCard ? 'credit' : (paymentMethod || null),
      installment_total: isInstallment && creditCardId
        ? (parseInt(installmentTotal) || null)
        : isIncomeInstallment && type === 'income'
        ? (parseInt(incomeInstallmentTotal) || null)
        : null,
      notes: notes.trim() || null,
      is_recurring: isRecurring,
      recurrence_interval: isRecurring ? recurrenceInterval : null,
    }

    setLoading(true)
    try {
      if (isEditing) {
        await updateTransaction(transaction.id, data)
        toast.success('Transação atualizada!')
      } else {
        const delay = isIncomeInstallment && type === 'income' ? (parseInt(incomeInstallmentDelay) || 1) : 0
        const created = await createTransaction(data, { incomeInstallmentDelay: delay })
        if (created.length > 1) {
          toast.success(`${created.length} parcelas criadas!`)
        } else {
          toast.success('Transação criada!')
        }
      }
      onSuccess()
      onClose()
    } catch {
      toast.error('Erro ao salvar transação')
    } finally {
      setLoading(false)
    }
  }

  const selectedAccountCardValue = accountId ? `acc:${accountId}` : creditCardId ? `card:${creditCardId}` : ''

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Transação' : 'Nova Transação'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type toggle */}
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant={type === 'income' ? 'default' : 'outline'}
              className={type === 'income' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
              onClick={() => handleTypeChange('income')}>Receita</Button>
            <Button type="button" variant={type === 'expense' ? 'default' : 'outline'}
              className={type === 'expense' ? 'bg-red-500 hover:bg-red-600' : ''}
              onClick={() => handleTypeChange('expense')}>Despesa</Button>
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Input id="description" placeholder="Ex: Supermercado, Salário, Projeto X..."
              value={description} onChange={(e) => setDescription(e.target.value)} required />
          </div>

          {/* Valor + Data */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="amount">Valor</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium select-none">R$</span>
                <Input id="amount" type="text" inputMode="decimal" placeholder="0,00"
                  className="pl-9"
                  value={amount} onChange={(e) => setAmount(e.target.value)} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Data</Label>
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
          </div>

          {/* Conta / Cartão */}
          <div className="space-y-2">
            <Label>Conta / Cartão</Label>
            {accounts.length === 0 && cards.length === 0 ? (
              <div className="flex items-center justify-between rounded-lg border border-dashed border-slate-200 px-3 py-2.5 bg-slate-50">
                <p className="text-xs text-slate-400">Nenhuma conta cadastrada</p>
                <Link href="/settings/accounts" onClick={onClose}
                  className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">
                  Adicionar →
                </Link>
              </div>
            ) : (
              <Select value={selectedAccountCardValue} onValueChange={handleAccountCardChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma conta ou cartão..." />
                </SelectTrigger>
                <SelectContent>
                  {accounts.length > 0 && (
                    <>
                      <div className="px-2 py-1 text-xs font-semibold text-slate-400 flex items-center gap-1">
                        <Wallet className="h-3 w-3" /> Contas
                      </div>
                      {accounts.map((acc) => (
                        <SelectItem key={acc.id} value={`acc:${acc.id}`}>{acc.name}</SelectItem>
                      ))}
                    </>
                  )}
                  {cards.length > 0 && type === 'expense' && (
                    <>
                      <div className="px-2 py-1 text-xs font-semibold text-slate-400 flex items-center gap-1">
                        <CardIcon className="h-3 w-3" /> Cartões de Crédito
                      </div>
                      {cards.map((card) => (
                        <SelectItem key={card.id} value={`card:${card.id}`}>{card.name}</SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Método de pagamento (apenas se conta selecionada) */}
          {accountId && !creditCardId && (
            <div className="space-y-2">
              <Label>Método de pagamento</Label>
              <Select value={paymentMethod} onValueChange={(v) => { if (v) setPaymentMethod(v as PaymentMethod) }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACCOUNT_PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Parcelamento (apenas cartão de crédito) */}
          {creditCardId && type === 'expense' && !isEditing && (
            <div className="rounded-lg border border-slate-200 p-3 space-y-2">
              <button type="button" onClick={() => setIsInstallment(!isInstallment)}
                className="flex w-full items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardIcon className={`h-4 w-4 ${isInstallment ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span className="text-sm font-medium text-slate-700">Compra parcelada</span>
                </div>
                <div className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${isInstallment ? 'bg-blue-500' : 'bg-slate-200'}`}>
                  <span className={`inline-block h-4 w-4 translate-y-0.5 rounded-full bg-white shadow transition-transform ${isInstallment ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </div>
              </button>
              {isInstallment && (
                <div className="space-y-1 pt-1 border-t border-slate-100">
                  <Label className="text-xs text-slate-500">Número de parcelas</Label>
                  <Input type="number" min="2" max="48" placeholder="Ex: 12"
                    value={installmentTotal} onChange={(e) => setInstallmentTotal(e.target.value)}
                    className="h-8 text-sm" />
                  {installmentTotal && parseInt(installmentTotal) > 1 && amount && !isNaN(parseBRLAmount(amount)) && (
                    <p className="text-xs text-slate-400">
                      {installmentTotal}× de {formatAmountInstallment(parseBRLAmount(amount), parseInt(installmentTotal))}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Parcelamento de receita */}
          {type === 'income' && !isEditing && (
            <div className="rounded-lg border border-slate-200 p-3 space-y-2">
              <button type="button" onClick={() => setIsIncomeInstallment(!isIncomeInstallment)}
                className="flex w-full items-center justify-between">
                <div className="flex items-center gap-2">
                  <RefreshCw className={`h-4 w-4 ${isIncomeInstallment ? 'text-emerald-600' : 'text-slate-400'}`} />
                  <span className="text-sm font-medium text-slate-700">Receita parcelada</span>
                </div>
                <div className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${isIncomeInstallment ? 'bg-emerald-500' : 'bg-slate-200'}`}>
                  <span className={`inline-block h-4 w-4 translate-y-0.5 rounded-full bg-white shadow transition-transform ${isIncomeInstallment ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </div>
              </button>
              {isIncomeInstallment && (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">Número de parcelas</Label>
                      <Input type="number" min="2" max="48" placeholder="Ex: 3"
                        value={incomeInstallmentTotal} onChange={(e) => setIncomeInstallmentTotal(e.target.value)}
                        className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">1º recebimento em</Label>
                      <Select value={incomeInstallmentDelay} onValueChange={(v) => { if (v) setIncomeInstallmentDelay(v) }}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">Mesmo mês</SelectItem>
                          <SelectItem value="1">+1 mês (Asaas)</SelectItem>
                          <SelectItem value="2">+2 meses</SelectItem>
                          <SelectItem value="3">+3 meses</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {incomeInstallmentTotal && parseInt(incomeInstallmentTotal) > 1 && amount && !isNaN(parseBRLAmount(amount)) && (
                    <p className="text-xs text-slate-400">
                      {incomeInstallmentTotal}× de {formatAmountInstallment(parseBRLAmount(amount), parseInt(incomeInstallmentTotal))}
                      {incomeInstallmentDelay !== '0' && ` · Início ${incomeInstallmentDelay === '1' ? 'no próximo mês' : `em ${incomeInstallmentDelay} meses`}`}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Categoria */}
          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={category} onValueChange={handleCategoryChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat === 'custom' ? '+ Personalizada...' : CATEGORY_LABELS[cat]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {category === 'custom' && (
              <Input placeholder="Nome da categoria (ex: Consultoria Jurídica)"
                value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} autoFocus />
            )}
          </div>

          {/* Recorrência */}
          <div className="rounded-lg border border-slate-200 p-3 space-y-2">
            <button type="button" onClick={() => setIsRecurring(!isRecurring)}
              className="flex w-full items-center justify-between">
              <div className="flex items-center gap-2">
                <RefreshCw className={`h-4 w-4 ${isRecurring ? 'text-emerald-600' : 'text-slate-400'}`} />
                <span className="text-sm font-medium text-slate-700">Transação recorrente</span>
              </div>
              <div className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${isRecurring ? 'bg-emerald-500' : 'bg-slate-200'}`}>
                <span className={`inline-block h-4 w-4 translate-y-0.5 rounded-full bg-white shadow transition-transform ${isRecurring ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </div>
            </button>
            {isRecurring && (
              <div className="pt-1 border-t border-slate-100 space-y-1">
                <Label className="text-xs text-slate-500">Frequência</Label>
                <Select value={recurrenceInterval} onValueChange={(v) => { if (v) setRecurrenceInterval(v as RecurrenceInterval) }}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(RECURRENCE_LABELS) as RecurrenceInterval[]).map((i) => (
                      <SelectItem key={i} value={i}>{RECURRENCE_LABELS[i]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Observação */}
          <div className="space-y-2">
            <Label htmlFor="notes">Observação (opcional)</Label>
            <textarea id="notes" rows={2} placeholder="Anotações adicionais..."
              value={notes} onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none" />
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading}
              className={type === 'income' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-500 hover:bg-red-600'}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {isEditing ? 'Salvar' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function formatAmountInstallment(total: number, n: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total / n)
}
