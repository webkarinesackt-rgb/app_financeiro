'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Wallet, Clock } from 'lucide-react'
import { getTransactions } from '@/lib/transactions'
import { formatCurrency } from '@/lib/format'
import type { Transaction } from '@/types'

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

function CashFlowContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const now = new Date()
  const month = Number(searchParams.get('month')) || now.getMonth() + 1
  const year = Number(searchParams.get('year')) || now.getFullYear()

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [prevTransactions, setPrevTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  function navigate(delta: number) {
    const d = new Date(year, month - 1 + delta, 1)
    const params = new URLSearchParams(searchParams.toString())
    params.set('month', String(d.getMonth() + 1))
    params.set('year', String(d.getFullYear()))
    router.push(`/cashflow?${params.toString()}`)
  }

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const prevMonth = month === 1 ? 12 : month - 1
      const prevYear = month === 1 ? year - 1 : year
      const [txs, prev] = await Promise.all([
        getTransactions({ month, year }),
        getTransactions({ month: prevMonth, year: prevYear }),
      ])
      setTransactions(txs)
      setPrevTransactions(prev)
    } finally {
      setLoading(false)
    }
  }, [month, year])

  useEffect(() => { fetchData() }, [fetchData])

  const income = transactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expenses = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const balance = income - expenses

  const prevIncome = prevTransactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const prevExpenses = prevTransactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const prevBalance = prevIncome - prevExpenses

  // Receivables: income installments with future dates
  const today = new Date().toISOString().split('T')[0]
  const receivables = transactions.filter(
    (t) => t.type === 'income' && t.installment_group_id && t.date > today
  )
  const receivablesTotal = receivables.reduce((s, t) => s + t.amount, 0)

  // Actual received so far this month
  const actualIncome = transactions.filter(
    (t) => t.type === 'income' && t.date <= today
  ).reduce((s, t) => s + t.amount, 0)

  // Group by week for cash flow chart
  const weeks = [1, 2, 3, 4, 5].map((week) => {
    const weekStart = (week - 1) * 7 + 1
    const weekEnd = Math.min(week * 7, new Date(year, month, 0).getDate())
    const startStr = `${year}-${String(month).padStart(2, '0')}-${String(weekStart).padStart(2, '0')}`
    const endStr = `${year}-${String(month).padStart(2, '0')}-${String(weekEnd).padStart(2, '0')}`
    const weekIncome = transactions.filter((t) => t.type === 'income' && t.date >= startStr && t.date <= endStr).reduce((s, t) => s + t.amount, 0)
    const weekExpenses = transactions.filter((t) => t.type === 'expense' && t.date >= startStr && t.date <= endStr).reduce((s, t) => s + t.amount, 0)
    return { week, weekIncome, weekExpenses, net: weekIncome - weekExpenses }
  }).filter((w) => w.weekIncome > 0 || w.weekExpenses > 0)

  function pctChange(current: number, prev: number) {
    if (prev === 0) return null
    return ((current - prev) / prev) * 100
  }

  const incomePct = pctChange(income, prevIncome)
  const expensesPct = pctChange(expenses, prevExpenses)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Fechamento Mensal</h1>
          <p className="text-slate-500 text-sm mt-0.5">Análise de fluxo de caixa</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(-1)} className="h-8 w-8 p-0">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium text-slate-700 min-w-[120px] text-center">
            {MONTHS[month - 1]} {year}
          </span>
          <Button variant="outline" size="sm" onClick={() => navigate(1)} className="h-8 w-8 p-0">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[1,2,3,4].map((i) => <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card className="border border-emerald-100 bg-emerald-50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                  <p className="text-xs font-medium text-emerald-600">Total Receitas</p>
                </div>
                <p className="text-xl font-bold text-emerald-700">{formatCurrency(income)}</p>
                {incomePct !== null && (
                  <p className={`text-xs mt-1 ${incomePct >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {incomePct >= 0 ? '▲' : '▼'} {Math.abs(incomePct).toFixed(1)}% vs mês anterior
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="border border-red-100 bg-red-50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingDown className="h-4 w-4 text-red-500" />
                  <p className="text-xs font-medium text-red-500">Total Despesas</p>
                </div>
                <p className="text-xl font-bold text-red-600">{formatCurrency(expenses)}</p>
                {expensesPct !== null && (
                  <p className={`text-xs mt-1 ${expensesPct <= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {expensesPct >= 0 ? '▲' : '▼'} {Math.abs(expensesPct).toFixed(1)}% vs mês anterior
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className={`border ${balance >= 0 ? 'border-blue-100 bg-blue-50' : 'border-red-100 bg-red-50'}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Wallet className={`h-4 w-4 ${balance >= 0 ? 'text-blue-600' : 'text-red-500'}`} />
                  <p className={`text-xs font-medium ${balance >= 0 ? 'text-blue-600' : 'text-red-500'}`}>Saldo do Mês</p>
                </div>
                <p className={`text-xl font-bold ${balance >= 0 ? 'text-blue-700' : 'text-red-600'}`}>{formatCurrency(balance)}</p>
                {prevBalance !== 0 && (
                  <p className="text-xs text-slate-400 mt-1">Anterior: {formatCurrency(prevBalance)}</p>
                )}
              </CardContent>
            </Card>

            <Card className="border border-amber-100 bg-amber-50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="h-4 w-4 text-amber-600" />
                  <p className="text-xs font-medium text-amber-600">A Receber</p>
                </div>
                <p className="text-xl font-bold text-amber-700">{formatCurrency(actualIncome)}</p>
                {receivablesTotal > 0 && (
                  <p className="text-xs text-amber-500 mt-1">+{formatCurrency(receivablesTotal)} previsto</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Weekly breakdown */}
          {weeks.length > 0 && (
            <Card className="border border-slate-100 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-700">Fluxo por Semana</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  {weeks.map((w) => {
                    const maxVal = Math.max(...weeks.map((x) => Math.max(x.weekIncome, x.weekExpenses)), 1)
                    return (
                      <div key={w.week} className="space-y-1">
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>Semana {w.week}</span>
                          <span className={`font-medium ${w.net >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {w.net >= 0 ? '+' : ''}{formatCurrency(w.net)}
                          </span>
                        </div>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400 w-16">Receitas</span>
                            <div className="flex-1 bg-slate-100 rounded-full h-2">
                              <div className="bg-emerald-400 h-2 rounded-full" style={{ width: `${(w.weekIncome / maxVal) * 100}%` }} />
                            </div>
                            <span className="text-xs text-slate-500 w-20 text-right">{formatCurrency(w.weekIncome)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400 w-16">Despesas</span>
                            <div className="flex-1 bg-slate-100 rounded-full h-2">
                              <div className="bg-red-400 h-2 rounded-full" style={{ width: `${(w.weekExpenses / maxVal) * 100}%` }} />
                            </div>
                            <span className="text-xs text-slate-500 w-20 text-right">{formatCurrency(w.weekExpenses)}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Receivables breakdown */}
          {receivables.length > 0 && (
            <Card className="border border-amber-100 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-500" />
                  Parcelas a Receber neste Mês
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="divide-y divide-slate-50">
                  {receivables.map((t) => (
                    <div key={t.id} className="flex items-center justify-between py-2.5">
                      <div>
                        <p className="text-sm text-slate-700 font-medium">{t.description}</p>
                        <p className="text-xs text-slate-400">{t.date}</p>
                      </div>
                      <span className="text-sm font-bold text-amber-600">+{formatCurrency(t.amount)}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 pt-2 border-t border-amber-100 flex justify-between">
                  <span className="text-xs text-amber-600 font-medium">Total previsto</span>
                  <span className="text-sm font-bold text-amber-700">{formatCurrency(receivablesTotal)}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Month comparison */}
          <Card className="border border-slate-100 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-700">Comparativo com Mês Anterior</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-slate-400 mb-1">Receitas</p>
                  <p className="text-sm font-bold text-emerald-600">{formatCurrency(income)}</p>
                  <p className="text-xs text-slate-400 mt-0.5">vs {formatCurrency(prevIncome)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">Despesas</p>
                  <p className="text-sm font-bold text-red-500">{formatCurrency(expenses)}</p>
                  <p className="text-xs text-slate-400 mt-0.5">vs {formatCurrency(prevExpenses)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">Saldo</p>
                  <p className={`text-sm font-bold ${balance >= 0 ? 'text-blue-600' : 'text-red-500'}`}>{formatCurrency(balance)}</p>
                  <p className="text-xs text-slate-400 mt-0.5">vs {formatCurrency(prevBalance)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

export default function CashFlowPage() {
  return (
    <Suspense>
      <CashFlowContent />
    </Suspense>
  )
}
