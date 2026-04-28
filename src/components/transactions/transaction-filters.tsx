'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { MonthSelector } from '@/components/dashboard/month-selector'
import { getAccounts } from '@/lib/accounts'
import { getCreditCards } from '@/lib/credit-cards'
import { CATEGORY_LABELS, INCOME_CATEGORIES, EXPENSE_CATEGORIES, type Account, type CreditCard } from '@/types'
import { X, Wallet, CreditCard as CardIcon } from 'lucide-react'

const ALL_CATEGORIES = [...new Set([...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES])]

interface TransactionFiltersProps {
  month: number
  year: number
  category: string
  type: string
  accountId: string
  creditCardId: string
}

export function TransactionFilters({ month, year, category, type, accountId, creditCardId }: TransactionFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [cards, setCards] = useState<CreditCard[]>([])

  useEffect(() => {
    getAccounts().then(setAccounts).catch(() => {})
    getCreditCards().then(setCards).catch(() => {})
  }, [])

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value === 'all') {
      params.delete(key)
    } else {
      params.set(key, value)
      // account and card are mutually exclusive
      if (key === 'accountId') params.delete('creditCardId')
      if (key === 'creditCardId') params.delete('accountId')
    }
    router.push(`?${params.toString()}`)
  }

  function clearFilters() {
    const params = new URLSearchParams()
    params.set('month', String(month))
    params.set('year', String(year))
    router.push(`?${params.toString()}`)
  }

  const hasActiveFilters = category !== 'all' || type !== 'all' || accountId !== 'all' || creditCardId !== 'all'

  return (
    <div className="flex flex-wrap items-center gap-2">
      <MonthSelector month={month} year={year} />

      {/* Tipo */}
      <Select value={type} onValueChange={(v) => setParam('type', v ?? 'all')}>
        <SelectTrigger className="w-[130px] h-8 text-sm">
          <SelectValue placeholder="Tipo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os tipos</SelectItem>
          <SelectItem value="income">Receitas</SelectItem>
          <SelectItem value="expense">Despesas</SelectItem>
        </SelectContent>
      </Select>

      {/* Categoria */}
      <Select value={category} onValueChange={(v) => setParam('category', v ?? 'all')}>
        <SelectTrigger className="w-[160px] h-8 text-sm">
          <SelectValue placeholder="Categoria" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas as categorias</SelectItem>
          {ALL_CATEGORIES.map((cat) => (
            <SelectItem key={cat} value={cat}>{CATEGORY_LABELS[cat]}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Conta */}
      {accounts.length > 0 && (
        <Select value={accountId} onValueChange={(v) => setParam('accountId', v ?? 'all')}>
          <SelectTrigger className="w-[150px] h-8 text-sm">
            <span className="flex items-center gap-1.5 truncate">
              <Wallet className="h-3 w-3 shrink-0 text-slate-400" />
              <SelectValue placeholder="Conta" />
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as contas</SelectItem>
            {accounts.map((acc) => (
              <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Cartão */}
      {cards.length > 0 && (
        <Select value={creditCardId} onValueChange={(v) => setParam('creditCardId', v ?? 'all')}>
          <SelectTrigger className="w-[150px] h-8 text-sm">
            <span className="flex items-center gap-1.5 truncate">
              <CardIcon className="h-3 w-3 shrink-0 text-slate-400" />
              <SelectValue placeholder="Cartão" />
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os cartões</SelectItem>
            {cards.map((card) => (
              <SelectItem key={card.id} value={card.id}>{card.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" className="h-8 gap-1 text-slate-500" onClick={clearFilters}>
          <X className="h-3 w-3" /> Limpar
        </Button>
      )}
    </div>
  )
}
