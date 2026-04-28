'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MonthSelector } from '@/components/dashboard/month-selector'
import { getTransactions } from '@/lib/transactions'
import { formatCurrency, getMonthName } from '@/lib/format'
import { getCategoryLabel, CATEGORY_COLORS, type Transaction, type Category } from '@/types'
import { Badge } from '@/components/ui/badge'

type Tab = 'categories' | 'overview'

function ReportsContent() {
  const searchParams = useSearchParams()
  const now = new Date()
  const month = Number(searchParams.get('month')) || now.getMonth() + 1
  const year = Number(searchParams.get('year')) || now.getFullYear()

  const [tab, setTab] = useState<Tab>('categories')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getTransactions({ month, year })
      setTransactions(data)
    } finally {
      setLoading(false)
    }
  }, [month, year])

  useEffect(() => { fetchData() }, [fetchData])

  const totalIncome = transactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const totalExpenses = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  // Category data
  const expensesByCat = transactions
    .filter((t) => t.type === 'expense')
    .reduce<Record<string, { amount: number; label: string }>>((acc, t) => {
      const key = t.category === 'custom' ? (t.custom_category ?? 'custom') : t.category
      const label = getCategoryLabel(t.category as Category, t.custom_category)
      acc[key] = { amount: (acc[key]?.amount ?? 0) + t.amount, label }
      return acc
    }, {})

  const categoryData = Object.entries(expensesByCat)
    .map(([cat, { amount, label }]) => ({
      category: cat as Category,
      label,
      amount,
      percentage: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0,
      color: CATEGORY_COLORS[cat as Category] ?? '#94a3b8',
    }))
    .sort((a, b) => b.amount - a.amount)

  // Last 6 months comparison
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    let m = month - 5 + i
    let y = year
    while (m <= 0) { m += 12; y-- }
    while (m > 12) { m -= 12; y++ }
    return { month: m, year: y, name: getMonthName(m).slice(0, 3).toUpperCase() }
  })

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Relatórios</h1>
          <p className="text-slate-500 text-sm mt-0.5 capitalize">{getMonthName(month)} {year}</p>
        </div>
        <Suspense>
          <MonthSelector month={month} year={year} />
        </Suspense>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-slate-200">
        {([['categories', 'Categorias'], ['overview', 'Entradas x Saídas']] as [Tab, string][]).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === id ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid gap-4">
          {[1, 2].map((i) => <div key={i} className="h-64 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      ) : tab === 'categories' ? (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="border border-slate-100 shadow-sm">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-slate-500">Total de despesas</p>
                <p className="text-xl font-bold text-red-500">{formatCurrency(totalExpenses)}</p>
              </CardContent>
            </Card>
            <Card className="border border-slate-100 shadow-sm">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-slate-500">Categorias</p>
                <p className="text-xl font-bold text-slate-700">{categoryData.length}</p>
              </CardContent>
            </Card>
          </div>

          {categoryData.length === 0 ? (
            <Card className="border border-slate-100 shadow-sm">
              <CardContent className="py-16 text-center">
                <p className="text-slate-400 text-sm">Sem despesas no período selecionado</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Pie Chart */}
              <Card className="border border-slate-100 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold text-slate-700">Distribuição</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={categoryData} cx="50%" cy="50%" innerRadius={55} outerRadius={95}
                        paddingAngle={2} dataKey="amount">
                        {categoryData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v) => formatCurrency(Number(v))}
                        labelFormatter={(_, p) => p?.[0]?.payload?.label ?? ''}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Category list */}
              <Card className="border border-slate-100 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold text-slate-700">Por Categoria</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-slate-50">
                    {categoryData.map((item) => (
                      <div key={item.category} className="flex items-center gap-3 px-4 py-2.5">
                        <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-700 truncate">{item.label}</p>
                          <div className="mt-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${item.percentage}%`, backgroundColor: item.color }} />
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold text-slate-700">{formatCurrency(item.amount)}</p>
                          <p className="text-xs text-slate-400">{item.percentage.toFixed(1)}%</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Month summary */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="border border-slate-100 shadow-sm">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-slate-500">Receitas</p>
                <p className="text-lg font-bold text-emerald-600">{formatCurrency(totalIncome)}</p>
              </CardContent>
            </Card>
            <Card className="border border-slate-100 shadow-sm">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-slate-500">Despesas</p>
                <p className="text-lg font-bold text-red-500">{formatCurrency(totalExpenses)}</p>
              </CardContent>
            </Card>
            <Card className="border border-slate-100 shadow-sm">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-slate-500">Saldo</p>
                <p className={`text-lg font-bold ${totalIncome - totalExpenses >= 0 ? 'text-blue-600' : 'text-red-500'}`}>
                  {formatCurrency(totalIncome - totalExpenses)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Bar chart */}
          <Card className="border border-slate-100 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-slate-700">Entradas x Saídas — mês atual</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={[{ name: getMonthName(month).slice(0,3).toUpperCase(), receitas: totalIncome, despesas: totalExpenses }]}
                  margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                  <Legend />
                  <Bar dataKey="receitas" name="Receitas" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="despesas" name="Despesas" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Transaction breakdown */}
          <Card className="border border-slate-100 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-slate-700">Distribuição por Tipo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: 'Receitas', value: totalIncome, color: '#10b981', pct: totalIncome + totalExpenses > 0 ? (totalIncome / (totalIncome + totalExpenses)) * 100 : 0 },
                { label: 'Despesas', value: totalExpenses, color: '#f43f5e', pct: totalIncome + totalExpenses > 0 ? (totalExpenses / (totalIncome + totalExpenses)) * 100 : 0 },
              ].map((row) => (
                <div key={row.label} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-slate-700">{row.label}</span>
                    <span className="font-semibold" style={{ color: row.color }}>{formatCurrency(row.value)}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${row.pct}%`, backgroundColor: row.color }} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

export default function ReportsPage() {
  return (
    <Suspense>
      <ReportsContent />
    </Suspense>
  )
}
