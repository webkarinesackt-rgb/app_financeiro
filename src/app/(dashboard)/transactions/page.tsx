'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { TransactionList } from '@/components/transactions/transaction-list'
import { TransactionForm } from '@/components/transactions/transaction-form'
import { TransactionFilters } from '@/components/transactions/transaction-filters'
import { getTransactions } from '@/lib/transactions'
import { getAccounts } from '@/lib/accounts'
import { getCreditCards } from '@/lib/credit-cards'
import { formatCurrency } from '@/lib/format'
import type { Transaction, Account, CreditCard } from '@/types'

function TransactionsContent() {
  const searchParams = useSearchParams()
  const now = new Date()
  const month = Number(searchParams.get('month')) || now.getMonth() + 1
  const year = Number(searchParams.get('year')) || now.getFullYear()
  const category = searchParams.get('category') ?? 'all'
  const type = searchParams.get('type') ?? 'all'
  const accountId = searchParams.get('accountId') ?? 'all'
  const creditCardId = searchParams.get('creditCardId') ?? 'all'

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [cards, setCards] = useState<CreditCard[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [txs, accs, crds] = await Promise.all([
        getTransactions({ month, year, category, type, accountId, creditCardId }),
        getAccounts(),
        getCreditCards(),
      ])
      setTransactions(txs)
      setAccounts(accs)
      setCards(crds)
    } finally {
      setLoading(false)
    }
  }, [month, year, category, type, accountId, creditCardId])

  useEffect(() => { fetchAll() }, [fetchAll])

  const totalIncome = transactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const totalExpenses = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  // Active filter label
  const activeAccount = accountId !== 'all' ? accounts.find((a) => a.id === accountId) : null
  const activeCard = creditCardId !== 'all' ? cards.find((c) => c.id === creditCardId) : null
  const contextLabel = activeAccount
    ? `Conta: ${activeAccount.name}`
    : activeCard
    ? `Cartão: ${activeCard.name}`
    : null

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Transações</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {contextLabel
              ? <span className="text-emerald-700 font-medium">{contextLabel} · </span>
              : null}
            {transactions.length} encontrada(s)
          </p>
        </div>
        <Button
          className="bg-emerald-600 hover:bg-emerald-700 gap-2 self-start sm:self-auto"
          onClick={() => setShowForm(true)}
        >
          <Plus className="h-4 w-4" />
          Nova Transação
        </Button>
      </div>

      <Suspense>
        <TransactionFilters
          month={month}
          year={year}
          category={category}
          type={type}
          accountId={accountId}
          creditCardId={creditCardId}
        />
      </Suspense>

      {transactions.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
            <p className="text-xs text-emerald-600 font-medium">Receitas</p>
            <p className="text-lg font-bold text-emerald-700">{formatCurrency(totalIncome)}</p>
          </div>
          <div className="bg-red-50 border border-red-100 rounded-xl p-3">
            <p className="text-xs text-red-500 font-medium">Despesas</p>
            <p className="text-lg font-bold text-red-600">{formatCurrency(totalExpenses)}</p>
          </div>
          <div className={`col-span-2 sm:col-span-1 border rounded-xl p-3 ${
            totalIncome - totalExpenses >= 0 ? 'bg-blue-50 border-blue-100' : 'bg-red-50 border-red-100'
          }`}>
            <p className={`text-xs font-medium ${totalIncome - totalExpenses >= 0 ? 'text-blue-600' : 'text-red-500'}`}>Saldo</p>
            <p className={`text-lg font-bold ${totalIncome - totalExpenses >= 0 ? 'text-blue-700' : 'text-red-600'}`}>
              {formatCurrency(totalIncome - totalExpenses)}
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <TransactionList
          transactions={transactions}
          accounts={accounts}
          cards={cards}
          onRefresh={fetchAll}
        />
      )}

      <TransactionForm
        open={showForm}
        onClose={() => setShowForm(false)}
        onSuccess={fetchAll}
      />
    </div>
  )
}

export default function TransactionsPage() {
  return (
    <Suspense>
      <TransactionsContent />
    </Suspense>
  )
}
