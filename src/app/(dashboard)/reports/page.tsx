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

type Tab = 'projects' | 'categories' | 'overview'

function ReportsContent() {
  const searchParams = useSearchParams()
  const now = new Date()
  const month = Number(searchParams.get('month')) || now.getMonth() + 1
  const year = Number(searchParams.get('year')) || now.getFullYear()

  const [tab, setTab] = useState<Tab>('projects')
  const [period, setPeriod] = useState<'month' | 'year'>('year')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      if (period === 'month') {
        const data = await getTransactions({ month, year })
        setTransactions(data)
      } else {
        // Ano inteiro — busca mês a mês e concatena
        const months = Array.from({ length: 12 }, (_, i) => i + 1)
        const results = await Promise.all(
          months.map((m) => getTransactions({ month: m, year }))
        )
        setTransactions(results.flat())
      }
    } finally {
      setLoading(false)
    }
  }, [month, year, period])

  useEffect(() => { fetchData() }, [fetchData])

  const totalIncome = transactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const totalExpenses = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  // Category data
  const expensesByCat = transactions
    .filter((t) => t.type === 'expense')
    .reduce<Record<string, { amount: number; label: string }>>((acc, t) => {
      // Pró-labore quebra por sócio (subcategoria Karine / Andrei).
      const isProLabore = t.category === 'custom' && t.custom_category === 'Pró-labore'
      const key = isProLabore
        ? `Pró-labore · ${t.subcategory ?? 'sócios'}`
        : t.category === 'custom' ? (t.custom_category ?? 'custom') : t.category
      const label = isProLabore ? key : getCategoryLabel(t.category as Category, t.custom_category)
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

  // ─── RECEITA POR TIPO DE PROJETO ─────────────────────────────────────
  // Agrupa por: subcategory (se existir) OU custom_category (fallback)
  const PROJECT_COLORS: Record<string, string> = {
    'Landing page com copy': '#10b981',
    'Landing page sem copy': '#3b82f6',
    'Site institucional': '#8b5cf6',
    'Programação': '#6366f1',
    'Alterações': '#f59e0b',
    'Anúncios': '#f43f5e',
    'Receita curso': '#ec4899',
    'Receita recorrente': '#14b8a6',
    'Ressarcimento sócios': '#94a3b8',
    'Receita Landing Page / Site': '#cbd5e1',  // sem subcategoria
  }

  const projectsByType = transactions
    .filter((t) => t.type === 'income')
    .reduce<Record<string, number>>((acc, t) => {
      let key: string
      if (t.subcategory) key = t.subcategory
      else if (t.custom_category) key = t.custom_category
      else key = 'Sem categoria'
      acc[key] = (acc[key] ?? 0) + Number(t.amount)
      return acc
    }, {})

  const projectData = Object.entries(projectsByType)
    .map(([name, amount]) => ({
      name,
      amount,
      percentage: totalIncome > 0 ? (amount / totalIncome) * 100 : 0,
      color: PROJECT_COLORS[name] ?? '#94a3b8',
    }))
    .sort((a, b) => b.amount - a.amount)

  // Top clientes (por description extraída)
  const clientsByName = transactions
    .filter((t) => t.type === 'income' && t.custom_category === 'Receita Landing Page / Site')
    .reduce<Record<string, { amount: number; count: number; subcategory: string | null }>>((acc, t) => {
      const m1 = t.description.match(/^([^—]+?)\s*—/)
      const m2 = t.description.match(/Cp\s*:[\d]+-(.+?)(\s+\d{6,}|$)/)
      const name = m1?.[1].trim() ?? m2?.[1].trim() ?? null
      if (!name || name.length < 3) return acc
      const cur = acc[name] ?? { amount: 0, count: 0, subcategory: t.subcategory ?? null }
      cur.amount += Number(t.amount)
      cur.count += 1
      acc[name] = cur
      return acc
    }, {})

  const topClients = Object.entries(clientsByName)
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10)

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
          <p className="text-slate-500 text-sm mt-0.5 capitalize">
            {period === 'year' ? `Ano ${year}` : `${getMonthName(month)} ${year}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs">
            <button onClick={() => setPeriod('month')}
              className={`px-2.5 py-1 rounded-md font-medium ${period === 'month' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
              Mês
            </button>
            <button onClick={() => setPeriod('year')}
              className={`px-2.5 py-1 rounded-md font-medium ${period === 'year' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
              Ano
            </button>
          </div>
          {period === 'month' && (
            <Suspense>
              <MonthSelector month={month} year={year} />
            </Suspense>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-slate-200 overflow-x-auto">
        {([['projects', 'Projetos / Receita'], ['categories', 'Despesas'], ['overview', 'Entradas x Saídas']] as [Tab, string][]).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
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
      ) : tab === 'projects' ? (
        <div className="space-y-4">
          {/* Resumo */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Card className="border border-slate-100 shadow-sm">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-slate-500">Receita total</p>
                <p className="text-xl font-bold text-emerald-600">{formatCurrency(totalIncome)}</p>
              </CardContent>
            </Card>
            <Card className="border border-slate-100 shadow-sm">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-slate-500">Tipos de projeto</p>
                <p className="text-xl font-bold text-slate-700">{projectData.length}</p>
              </CardContent>
            </Card>
            <Card className="border border-slate-100 shadow-sm col-span-2 sm:col-span-1">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-slate-500">Clientes únicos</p>
                <p className="text-xl font-bold text-slate-700">{Object.keys(clientsByName).length}</p>
              </CardContent>
            </Card>
          </div>

          {projectData.length === 0 ? (
            <Card className="border border-slate-100 shadow-sm">
              <CardContent className="py-16 text-center">
                <p className="text-slate-400 text-sm">Sem receitas no período selecionado</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Pie por tipo de projeto */}
                <Card className="border border-slate-100 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold text-slate-700">Distribuição por tipo</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie data={projectData} cx="50%" cy="50%" innerRadius={55} outerRadius={95}
                          paddingAngle={2} dataKey="amount">
                          {projectData.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(v) => formatCurrency(Number(v))}
                          labelFormatter={(_, p) => p?.[0]?.payload?.name ?? ''}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Lista por tipo */}
                <Card className="border border-slate-100 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold text-slate-700">Receita por tipo</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y divide-slate-50">
                      {projectData.map((item) => (
                        <div key={item.name} className="flex items-center gap-3 px-4 py-2.5">
                          <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-700 truncate">{item.name}</p>
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

              {/* Top 10 clientes */}
              {topClients.length > 0 && (
                <Card className="border border-slate-100 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold text-slate-700">Top 10 clientes — Landing Page / Site</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y divide-slate-50">
                      {topClients.map((c, idx) => (
                        <div key={c.name} className="flex items-center gap-3 px-4 py-2.5">
                          <span className="text-xs text-slate-400 font-mono w-6">#{idx + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-700 truncate">{c.name}</p>
                            <p className="text-xs text-slate-400">
                              {c.count} lançamento(s)
                              {c.subcategory && (
                                <Badge variant="outline" className="ml-2 text-[10px] py-0 px-1.5 h-4 bg-emerald-50 border-emerald-200 text-emerald-700">
                                  {c.subcategory}
                                </Badge>
                              )}
                            </p>
                          </div>
                          <p className="text-sm font-semibold text-emerald-700 shrink-0">{formatCurrency(c.amount)}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
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
