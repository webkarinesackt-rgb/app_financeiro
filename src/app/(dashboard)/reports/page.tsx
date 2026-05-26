'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getTransactions } from '@/lib/transactions'
import { formatCurrency } from '@/lib/format'
import { getCategoryLabelByWorkspace, getCategoryColorByWorkspace, type Transaction } from '@/types'
import { useWorkspace } from '@/hooks/use-workspace'
import { PeriodSelector } from '@/components/reports/period-selector'
import { presetToRange } from '@/components/reports/period-presets'
import { DeltaBadge } from '@/components/reports/delta-badge'

type Tab = 'projects' | 'categories' | 'overview'

// ─── Project colors (Fysi-specific, kept for business workspace) ──────────────
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
  'Receita Landing Page / Site': '#cbd5e1',
}

function ReportsContent() {
  const searchParams = useSearchParams()
  const workspace = useWorkspace()

  // ─── Period resolution (from/to take priority; legacy ?month=&year= compat) ──
  const legacyMonth = Number(searchParams.get('month'))
  const legacyYear = Number(searchParams.get('year'))

  const defaultRange = presetToRange('this_month')
  const fmtYM = (y: number, m: number) => `${y}-${String(m).padStart(2, '0')}`

  const from =
    searchParams.get('from') ??
    (legacyMonth && legacyYear ? fmtYM(legacyYear, legacyMonth) : defaultRange.from)
  const to =
    searchParams.get('to') ??
    (legacyMonth && legacyYear ? fmtYM(legacyYear, legacyMonth) : defaultRange.to)

  const compareFrom = searchParams.get('compareFrom') ?? undefined
  const compareTo = searchParams.get('compareTo') ?? undefined
  const comparing = Boolean(compareFrom && compareTo)

  const [tab, setTab] = useState<Tab>('projects')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [transactionsB, setTransactionsB] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      if (comparing && compareFrom && compareTo) {
        const [a, b] = await Promise.all([
          getTransactions({ from, to }),
          getTransactions({ from: compareFrom, to: compareTo }),
        ])
        setTransactions(a)
        setTransactionsB(b)
      } else {
        const a = await getTransactions({ from, to })
        setTransactions(a)
        setTransactionsB([])
      }
    } finally {
      setLoading(false)
    }
  }, [from, to, compareFrom, compareTo, comparing])

  useEffect(() => { fetchData() }, [fetchData])

  // ─── Totals ──────────────────────────────────────────────────────────────────
  const totalIncome = transactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const totalExpenses = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const totalIncomeB = transactionsB.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const totalExpensesB = transactionsB.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  // ─── Category aggregation (A) ─────────────────────────────────────────────
  const expensesByCat = transactions
    .filter((t) => t.type === 'expense')
    .reduce<Record<string, { amount: number; label: string; customKey?: string }>>((acc, t) => {
      const key = t.category === 'custom' ? (t.custom_category ?? 'custom') : t.category
      const label = getCategoryLabelByWorkspace(workspace, t.category, t.custom_category)
      acc[key] = { amount: (acc[key]?.amount ?? 0) + t.amount, label, customKey: t.category === 'custom' ? (t.custom_category ?? 'custom') : undefined }
      return acc
    }, {})

  const categoryData = Object.entries(expensesByCat)
    .map(([cat, { amount, label, customKey }]) => {
      // cat is the JOIN key: for custom transactions it's the custom_category string value
      // For non-custom transactions it's the built-in category slug
      // We need to reconstruct the original category/customCategory for the color helper
      const isCustom = Boolean(customKey)
      const origCategory = isCustom ? 'custom' : cat
      const origCustomCategory = isCustom ? cat : undefined
      return {
        category: cat,
        label,
        amount,
        percentage: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0,
        color: getCategoryColorByWorkspace(workspace, origCategory, origCustomCategory),
      }
    })
    .sort((a, b) => b.amount - a.amount)

  // ─── Category aggregation (B) ─────────────────────────────────────────────
  const expensesByCatB = transactionsB
    .filter((t) => t.type === 'expense')
    .reduce<Record<string, { amount: number; label: string }>>((acc, t) => {
      const key = t.category === 'custom' ? (t.custom_category ?? 'custom') : t.category
      const label = getCategoryLabelByWorkspace(workspace, t.category, t.custom_category)
      acc[key] = { amount: (acc[key]?.amount ?? 0) + t.amount, label }
      return acc
    }, {})

  // ─── Project / income aggregation ────────────────────────────────────────
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

  // ─── Projects B ──────────────────────────────────────────────────────────
  const projectsByTypeB = transactionsB
    .filter((t) => t.type === 'income')
    .reduce<Record<string, number>>((acc, t) => {
      let key: string
      if (t.subcategory) key = t.subcategory
      else if (t.custom_category) key = t.custom_category
      else key = 'Sem categoria'
      acc[key] = (acc[key] ?? 0) + Number(t.amount)
      return acc
    }, {})

  // ─── Top clients ──────────────────────────────────────────────────────────
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

  // ─── Bar data for overview tab ────────────────────────────────────────────
  const barData = comparing
    ? [
        { name: 'Período A', receitas: totalIncome, despesas: totalExpenses },
        { name: 'Período B', receitas: totalIncomeB, despesas: totalExpensesB },
      ]
    : [{ name: 'Período', receitas: totalIncome, despesas: totalExpenses }]

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Relatórios</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {from === to ? from : `${from} → ${to}`}
            {comparing && compareFrom && compareTo && (
              <span className="ml-2 text-stone-400">vs {compareFrom === compareTo ? compareFrom : `${compareFrom} → ${compareTo}`}</span>
            )}
          </p>
        </div>
        <Suspense>
          <PeriodSelector from={from} to={to} compareFrom={compareFrom} compareTo={compareTo} />
        </Suspense>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-slate-200 overflow-x-auto">
        {(
          [
            ['projects', 'Projetos / Receita'],
            ['categories', 'Despesas'],
            ['overview', 'Entradas x Saídas'],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
              tab === id
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-64 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : tab === 'projects' ? (
        /* ── PROJECTS TAB ─────────────────────────────────────────────────── */
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Card className="border border-slate-100 shadow-sm">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-slate-500">Receita total</p>
                <p className="text-xl font-bold text-emerald-600">{formatCurrency(totalIncome)}</p>
                {comparing && (
                  <>
                    <p className="text-xs text-slate-400 mt-1">vs {formatCurrency(totalIncomeB)}</p>
                    <DeltaBadge current={totalIncome} previous={totalIncomeB} />
                  </>
                )}
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
                {/* Pie */}
                <Card className="border border-slate-100 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold text-slate-700">Distribuição por tipo</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie
                          data={projectData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={95}
                          paddingAngle={2}
                          dataKey="amount"
                        >
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

                {/* List */}
                <Card className="border border-slate-100 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold text-slate-700">Receita por tipo</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y divide-slate-50">
                      {projectData.map((item) => {
                        const previousAmount = projectsByTypeB[item.name] ?? 0
                        return (
                          <div key={item.name} className="flex items-center gap-3 px-4 py-2.5">
                            <div
                              className="h-3 w-3 rounded-full shrink-0"
                              style={{ backgroundColor: item.color }}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-700 truncate">{item.name}</p>
                              <div className="mt-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full"
                                  style={{ width: `${item.percentage}%`, backgroundColor: item.color }}
                                />
                              </div>
                              {!comparing && (
                                <p className="text-[11px] text-slate-400 mt-0.5">{item.percentage.toFixed(1)}%</p>
                              )}
                            </div>
                            <div className="text-right shrink-0 min-w-[5rem]">
                              <p className="text-sm font-semibold text-slate-700">{formatCurrency(item.amount)}</p>
                              {comparing && (
                                <p className="text-xs text-slate-400">vs {formatCurrency(previousAmount)}</p>
                              )}
                            </div>
                            {comparing && (
                              <div className="shrink-0 min-w-[5rem] text-right">
                                <DeltaBadge current={item.amount} previous={previousAmount} />
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Top 10 clients */}
              {topClients.length > 0 && (
                <Card className="border border-slate-100 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold text-slate-700">
                      Top 10 clientes — Landing Page / Site
                    </CardTitle>
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
                                <Badge
                                  variant="outline"
                                  className="ml-2 text-[10px] py-0 px-1.5 h-4 bg-emerald-50 border-emerald-200 text-emerald-700"
                                >
                                  {c.subcategory}
                                </Badge>
                              )}
                            </p>
                          </div>
                          <p className="text-sm font-semibold text-emerald-700 shrink-0">
                            {formatCurrency(c.amount)}
                          </p>
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
        /* ── CATEGORIES TAB ──────────────────────────────────────────────────── */
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="border border-slate-100 shadow-sm">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-slate-500">Total de despesas</p>
                <p className="text-xl font-bold text-red-500">{formatCurrency(totalExpenses)}</p>
                {comparing && (
                  <>
                    <p className="text-xs text-slate-400 mt-1">vs {formatCurrency(totalExpensesB)}</p>
                    <DeltaBadge current={totalExpenses} previous={totalExpensesB} invertColor />
                  </>
                )}
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
              {/* Pie */}
              <Card className="border border-slate-100 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold text-slate-700">Distribuição</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={95}
                        paddingAngle={2}
                        dataKey="amount"
                      >
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

              {/* Category list with optional B column */}
              <Card className="border border-slate-100 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold text-slate-700">Por Categoria</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-slate-50">
                    {categoryData.map((item) => {
                      const previousAmount =
                        (expensesByCatB[item.category]?.amount) ?? 0
                      return (
                        <div key={item.category} className="flex items-center gap-3 px-4 py-2.5">
                          <div
                            className="h-3 w-3 rounded-full shrink-0"
                            style={{ backgroundColor: item.color }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-700 truncate">{item.label}</p>
                            <div className="mt-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{ width: `${item.percentage}%`, backgroundColor: item.color }}
                              />
                            </div>
                            {!comparing && (
                              <p className="text-[11px] text-slate-400 mt-0.5">{item.percentage.toFixed(1)}%</p>
                            )}
                          </div>
                          <div className="text-right shrink-0 min-w-[5rem]">
                            <p className="text-sm font-semibold text-slate-700">{formatCurrency(item.amount)}</p>
                            {comparing && (
                              <p className="text-xs text-slate-400">vs {formatCurrency(previousAmount)}</p>
                            )}
                          </div>
                          {comparing && (
                            <div className="shrink-0 min-w-[5rem] text-right">
                              <DeltaBadge
                                current={item.amount}
                                previous={previousAmount}
                                invertColor
                              />
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      ) : (
        /* ── OVERVIEW TAB ─────────────────────────────────────────────────────── */
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="border border-slate-100 shadow-sm">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-slate-500">Receitas</p>
                <p className="text-lg font-bold text-emerald-600">{formatCurrency(totalIncome)}</p>
                {comparing && (
                  <>
                    <p className="text-xs text-slate-400 mt-1">vs {formatCurrency(totalIncomeB)}</p>
                    <DeltaBadge current={totalIncome} previous={totalIncomeB} />
                  </>
                )}
              </CardContent>
            </Card>
            <Card className="border border-slate-100 shadow-sm">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-slate-500">Despesas</p>
                <p className="text-lg font-bold text-red-500">{formatCurrency(totalExpenses)}</p>
                {comparing && (
                  <>
                    <p className="text-xs text-slate-400 mt-1">vs {formatCurrency(totalExpensesB)}</p>
                    <DeltaBadge current={totalExpenses} previous={totalExpensesB} invertColor />
                  </>
                )}
              </CardContent>
            </Card>
            <Card className="border border-slate-100 shadow-sm">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-slate-500">Saldo</p>
                <p
                  className={`text-lg font-bold ${
                    totalIncome - totalExpenses >= 0 ? 'text-blue-600' : 'text-red-500'
                  }`}
                >
                  {formatCurrency(totalIncome - totalExpenses)}
                </p>
                {comparing && (
                  <DeltaBadge
                    current={totalIncome - totalExpenses}
                    previous={totalIncomeB - totalExpensesB}
                  />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Bar chart */}
          <Card className="border border-slate-100 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-slate-700">
                {comparing ? 'Entradas x Saídas — Período A vs B' : 'Entradas x Saídas'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={barData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                  <Legend />
                  <Bar dataKey="receitas" name="Receitas" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="despesas" name="Despesas" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Distribution breakdown */}
          <Card className="border border-slate-100 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-slate-700">Distribuição por Tipo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                {
                  label: 'Receitas',
                  value: totalIncome,
                  color: '#10b981',
                  pct:
                    totalIncome + totalExpenses > 0
                      ? (totalIncome / (totalIncome + totalExpenses)) * 100
                      : 0,
                },
                {
                  label: 'Despesas',
                  value: totalExpenses,
                  color: '#f43f5e',
                  pct:
                    totalIncome + totalExpenses > 0
                      ? (totalExpenses / (totalIncome + totalExpenses)) * 100
                      : 0,
                },
              ].map((row) => (
                <div key={row.label} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-slate-700">{row.label}</span>
                    <span className="font-semibold" style={{ color: row.color }}>
                      {formatCurrency(row.value)}
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${row.pct}%`, backgroundColor: row.color }}
                    />
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
