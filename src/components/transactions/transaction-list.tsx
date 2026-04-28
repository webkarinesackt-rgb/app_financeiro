'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { MoreVertical, Pencil, Trash2, TrendingUp, TrendingDown, RefreshCw, Wallet, CreditCard as CardIcon } from 'lucide-react'
import { toast } from 'sonner'
import { deleteTransaction } from '@/lib/transactions'
import { formatCurrency, formatDate } from '@/lib/format'
import { getCategoryLabel, getBankColor, RECURRENCE_LABELS } from '@/types'
import { TransactionForm } from './transaction-form'
import type { Transaction, Account, CreditCard } from '@/types'

interface TransactionListProps {
  transactions: Transaction[]
  accounts?: Account[]
  cards?: CreditCard[]
  onRefresh: () => void
}

export function TransactionList({ transactions, accounts = [], cards = [], onRefresh }: TransactionListProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  function filterByAccount(accountId: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('accountId', accountId)
    params.delete('creditCardId')
    router.push(`/transactions?${params.toString()}`)
  }

  function filterByCard(cardId: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('creditCardId', cardId)
    params.delete('accountId')
    router.push(`/transactions?${params.toString()}`)
  }

  async function handleDelete() {
    if (!deletingId) return
    setDeleteLoading(true)
    try {
      await deleteTransaction(deletingId)
      toast.success('Transação excluída')
      onRefresh()
    } catch {
      toast.error('Erro ao excluir transação')
    } finally {
      setDeleteLoading(false)
      setDeletingId(null)
    }
  }

  if (transactions.length === 0) {
    return (
      <Card className="border border-slate-100 shadow-sm">
        <CardContent className="py-16 text-center">
          <p className="text-slate-400 text-sm">Nenhuma transação encontrada para os filtros selecionados</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card className="border border-slate-100 shadow-sm">
        <CardContent className="p-0">
          <div className="divide-y divide-slate-50">
            {transactions.map((t) => {
              const account = t.account_id ? accounts.find((a) => a.id === t.account_id) : null
              const card = t.credit_card_id ? cards.find((c) => c.id === t.credit_card_id) : null

              return (
                <div key={t.id} className="flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50/50 transition-colors">
                  {/* Icon */}
                  <div className={`rounded-full p-1.5 shrink-0 ${t.type === 'income' ? 'bg-emerald-50' : 'bg-red-50'}`}>
                    {t.type === 'income'
                      ? <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                      : <TrendingDown className="h-3.5 w-3.5 text-red-500" />}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-medium text-slate-700 truncate">{t.description}</p>
                      {t.installment_total && t.installment_current && (
                        <span className="text-xs bg-slate-100 text-slate-500 rounded-full px-1.5 py-0.5 shrink-0">
                          {t.installment_current}/{t.installment_total}×
                        </span>
                      )}
                      {t.is_recurring && (
                        <span className="inline-flex items-center gap-0.5 text-xs text-blue-600 bg-blue-50 border border-blue-100 rounded-full px-1.5 py-0.5 shrink-0">
                          <RefreshCw className="h-2.5 w-2.5" />
                          {t.recurrence_interval ? RECURRENCE_LABELS[t.recurrence_interval] : 'Recorrente'}
                        </span>
                      )}
                      <Badge variant="outline" className="text-xs shrink-0 hidden sm:flex">
                        {getCategoryLabel(t.category, t.custom_category)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <p className="text-xs text-slate-400">{formatDate(t.date)}</p>
                      {/* Account chip */}
                      {account && (
                        <button
                          onClick={() => filterByAccount(account.id)}
                          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors"
                        >
                          <span
                            className="h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: account.color || getBankColor(account.bank) }}
                          />
                          {account.name}
                        </button>
                      )}
                      {/* Card chip */}
                      {card && (
                        <button
                          onClick={() => filterByCard(card.id)}
                          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors"
                        >
                          <span
                            className="h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: card.color }}
                          />
                          {card.name}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Amount + actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-sm font-bold ${t.type === 'income' ? 'text-emerald-600' : 'text-red-500'}`}>
                      {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                    </span>

                    <DropdownMenu>
                      <DropdownMenuTrigger className="inline-flex items-center justify-center h-7 w-7 rounded-md text-slate-400 hover:bg-slate-100 transition-colors">
                        <MoreVertical className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditingTx(t)}>
                          <Pencil className="h-3.5 w-3.5 mr-2" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600 focus:text-red-600"
                          onClick={() => setDeletingId(t.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {editingTx && (
        <TransactionForm
          open={!!editingTx}
          transaction={editingTx}
          onClose={() => setEditingTx(null)}
          onSuccess={onRefresh}
        />
      )}

      <Dialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir transação</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir esta transação? Essa ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeletingId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteLoading}>
              {deleteLoading ? 'Excluindo...' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
