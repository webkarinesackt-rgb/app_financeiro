'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { MonthSelector } from '@/components/dashboard/month-selector'
import { getAccounts } from '@/lib/accounts'
import { getCreditCards } from '@/lib/credit-cards'
import { getCustomCategories, getUsedBuiltInCategories } from '@/lib/transactions'
import {
  CATEGORY_LABELS, PERSONAL_CATEGORY_LABELS, getSubcategoryOptions,
  type Account, type CreditCard,
} from '@/types'
import { useWorkspace } from '@/hooks/use-workspace'
import { X, Wallet, CreditCard as CardIcon } from 'lucide-react'

interface TransactionFiltersProps {
  month: number
  year: number
  category: string
  subcategory: string
  type: string
  accountId: string
  creditCardId: string
}

export function TransactionFilters({ month, year, category, subcategory, type, accountId, creditCardId }: TransactionFiltersProps) {
  const workspace = useWorkspace()
  const categoryLabels = workspace === 'personal' ? PERSONAL_CATEGORY_LABELS : CATEGORY_LABELS
  const router = useRouter()
  const searchParams = useSearchParams()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [cards, setCards] = useState<CreditCard[]>([])
  const [customCategories, setCustomCategories] = useState<string[]>([])
  const [usedBuiltIn, setUsedBuiltIn] = useState<string[]>([])

  useEffect(() => {
    getAccounts().then(setAccounts).catch(() => {})
    getCreditCards().then(setCards).catch(() => {})
  }, [])

  // Recarrega categorias usadas (custom + padrão) quando o tipo muda
  useEffect(() => {
    const t = type === 'income' || type === 'expense' ? type : undefined
    getCustomCategories(t).then(setCustomCategories).catch(() => setCustomCategories([]))
    getUsedBuiltInCategories(t).then(setUsedBuiltIn).catch(() => setUsedBuiltIn([]))
  }, [type])

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value === 'all') {
      params.delete(key)
    } else {
      params.set(key, value)
      if (key === 'accountId') params.delete('creditCardId')
      if (key === 'creditCardId') params.delete('accountId')
      // Trocar de tipo limpa a categoria (pra evitar filtro inválido tipo "income + Alimentação")
      if (key === 'type') { params.delete('category'); params.delete('subcategory') }
      // Trocar de categoria limpa a subcategoria
      if (key === 'category') params.delete('subcategory')
    }
    router.push(`?${params.toString()}`)
  }

  function clearFilters() {
    const params = new URLSearchParams()
    params.set('month', String(month))
    params.set('year', String(year))
    router.push(`?${params.toString()}`)
  }

  const hasActiveFilters = category !== 'all' || subcategory !== 'all' || type !== 'all' || accountId !== 'all' || creditCardId !== 'all'

  // Mostra dropdown de subcategoria quando a categoria selecionada é uma custom com subs definidas
  const currentCustomCategory = category.startsWith('custom:') ? category.slice(7) : null
  const subOptions = currentCustomCategory ? getSubcategoryOptions(currentCustomCategory) : []

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

      {/* Categoria — reage ao tipo + inclui customizadas */}
      <Select value={category} onValueChange={(v) => setParam('category', v ?? 'all')}>
        <SelectTrigger className="w-[200px] h-8 text-sm">
          <SelectValue placeholder="Categoria" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas as categorias</SelectItem>
          {customCategories.map((name) => (
            <SelectItem key={`custom:${name}`} value={`custom:${name}`}>
              {name}
            </SelectItem>
          ))}
          {(() => {
            // Esconde built-in cujo rótulo já existe como custom (evita "Outros"
            // duplicado no dropdown). A busca já inclui as duas quando filtra.
            const customSet = new Set(customCategories)
            const visible = usedBuiltIn.filter((cat) => {
              const label = (categoryLabels as Record<string, string>)[cat] ?? cat
              return !customSet.has(label)
            })
            if (visible.length === 0) return null
            return (
              <>
                <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase">Padrão (em uso)</div>
                {visible.map((cat) => (
                  <SelectItem key={cat} value={cat}>{(categoryLabels as Record<string, string>)[cat] ?? cat}</SelectItem>
                ))}
              </>
            )
          })()}
        </SelectContent>
      </Select>

      {/* Subcategoria (só aparece se a categoria atual tem subs) */}
      {subOptions.length > 0 && (
        <Select value={subcategory} onValueChange={(v) => setParam('subcategory', v ?? 'all')}>
          <SelectTrigger className="w-[180px] h-8 text-sm">
            <SelectValue placeholder="Tipo de projeto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {subOptions.map((sub) => (
              <SelectItem key={sub} value={sub}>{sub}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

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
