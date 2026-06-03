'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts'
import {
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  Wallet, Target, Repeat, Briefcase, AlertCircle, ChevronRight, Printer,
  ChevronLeft, Eye, EyeOff,
} from 'lucide-react'
import { getTransactions } from '@/lib/transactions'
import { getRecurringClients, sumMonthlyRecurringRevenue } from '@/lib/recurring-clients'
import { getFixedCosts, sumMonthlyFixedCosts } from '@/lib/fixed-costs'
import { formatCurrency, getMonthName } from '@/lib/format'
import { getTrendMonths, getYearToDateMonths, yearToDateLabel, splitExpensesByOrigin } from '@/lib/panorama'
import { CUSTOM_EXPENSE_COLORS, CATEGORY_COLORS, type Transaction, type RecurringClient, type FixedCost, type Category } from '@/types'

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
  'Sem categoria': '#cbd5e1',
}

// Cores das despesas — usa o mapa compartilhado (Marketing, Equipe, Pró-labore, etc.)
// com fallback nas cores das categorias built-in.
function expenseColor(name: string): string {
  return CUSTOM_EXPENSE_COLORS[name] ?? CATEGORY_COLORS[name as Category] ?? '#94a3b8'
}

type PeriodMode = 'month' | 'year' | 'custom'

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export function PanoramaClient() {
  const now = new Date()
  const [period, setPeriod] = useState<PeriodMode>('month')
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  // Range custom — 'YYYY-MM'. Default = mês atual.
  const [customFrom, setCustomFrom] = useState(`${now.getFullYear()}-${pad(now.getMonth() + 1)}`)
  const [customTo, setCustomTo] = useState(`${now.getFullYear()}-${pad(now.getMonth() + 1)}`)
  // Comparação só quando o usuário pedir.
  const [comparing, setComparing] = useState(false)

  const [currentTx, setCurrentTx] = useState<Transaction[]>([])
  const [prevTx, setPrevTx] = useState<Transaction[]>([])
  const [recurringClients, setRecurringClients] = useState<RecurringClient[]>([])
  const [fixedCosts, setFixedCosts] = useState<FixedCost[]>([])
  const [loading, setLoading] = useState(true)
  const [monthsBack, setMonthsBack] = useState<6 | 12>(6)
  const [showEvolution, setShowEvolution] = useState(true)
  const [trend, setTrend] = useState<{ name: string; receita: number; despesa: number; lucro: number }[]>([])

  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year

  function shiftMonth(delta: number) {
    let m = month + delta
    let y = year
    while (m < 1) { m += 12; y-- }
    while (m > 12) { m -= 12; y++ }
    setMonth(m); setYear(y)
  }

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      if (period === 'month') {
        const tasks: Promise<unknown>[] = [
          getTransactions({ month, year }),
          getRecurringClients(),
          getFixedCosts(),
        ]
        if (comparing) tasks.push(getTransactions({ month: prevMonth, year: prevYear }))
        const results = await Promise.allSettled(tasks)
        if (results[0].status === 'fulfilled') setCurrentTx(results[0].value as Transaction[])
        if (results[1].status === 'fulfilled') setRecurringClients(results[1].value as RecurringClient[])
        if (results[2].status === 'fulfilled') setFixedCosts(results[2].value as FixedCost[])
        if (comparing && results[3]?.status === 'fulfilled') setPrevTx(results[3].value as Transaction[])
        else setPrevTx([])
      } else if (period === 'year') {
        const ytdMonths = getYearToDateMonths(month)
        const tasks: Promise<unknown>[] = [
          Promise.all(ytdMonths.map((m) => getTransactions({ month: m, year }))),
          getRecurringClients(),
          getFixedCosts(),
        ]
        if (comparing) tasks.push(Promise.all(ytdMonths.map((m) => getTransactions({ month: m, year: year - 1 }))))
        const results = await Promise.allSettled(tasks)
        if (results[0].status === 'fulfilled') setCurrentTx((results[0].value as Transaction[][]).flat())
        if (results[1].status === 'fulfilled') setRecurringClients(results[1].value as RecurringClient[])
        if (results[2].status === 'fulfilled') setFixedCosts(results[2].value as FixedCost[])
        if (comparing && results[3]?.status === 'fulfilled') setPrevTx((results[3].value as Transaction[][]).flat())
        else setPrevTx([])
      } else {
        // custom range — from/to em 'YYYY-MM'
        const [cur, rc, fc] = await Promise.allSettled([
          getTransactions({ from: customFrom, to: customTo }),
          getRecurringClients(),
          getFixedCosts(),
        ])
        if (cur.status === 'fulfilled') setCurrentTx(cur.value as Transaction[])
        if (rc.status === 'fulfilled') setRecurringClients(rc.value as RecurringClient[])
        if (fc.status === 'fulfilled') setFixedCosts(fc.value as FixedCost[])
        setPrevTx([])  // sem comparativo em custom por enquanto
      }
    } finally {
      setLoading(false)
    }
  }, [period, month, year, prevMonth, prevYear, customFrom, customTo, comparing])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    const months = getTrendMonths(new Date(), monthsBack)
    Promise.all(months.map((m) => getTransactions({ month: m.month, year: m.year })))
      .then((results) => {
        setTrend(results.map((txs, i) => {
          const receita = txs.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
          const despesa = txs.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
          return {
            name: getMonthName(months[i].month).slice(0, 3).toUpperCase(),
            receita, despesa, lucro: receita - despesa,
          }
        }))
      })
      .catch(() => {})
  }, [monthsBack])

  // KPIs principais
  const income = currentTx.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const expense = currentTx.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
  const lucro = income - expense
  const margem = income > 0 ? (lucro / income) * 100 : 0

  const prevIncome = prevTx.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const prevExpense = prevTx.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
  const prevLucro = prevIncome - prevExpense

  const incomeDelta = prevIncome > 0 ? ((income - prevIncome) / prevIncome) * 100 : 0
  const expenseDelta = prevExpense > 0 ? ((expense - prevExpense) / prevExpense) * 100 : 0
  const lucroDelta = prevLucro !== 0 ? ((lucro - prevLucro) / Math.abs(prevLucro)) * 100 : 0

  const mrr = sumMonthlyRecurringRevenue(recurringClients)
  const arr = mrr * 12
  const monthlyFixedCosts = sumMonthlyFixedCosts(fixedCosts)

  // Receita por tipo de projeto
  const incomeByType = currentTx
    .filter((t) => t.type === 'income')
    .reduce<Record<string, number>>((acc, t) => {
      const key = t.subcategory ?? t.custom_category ?? 'Sem categoria'
      acc[key] = (acc[key] ?? 0) + Number(t.amount)
      return acc
    }, {})

  const incomeBreakdown = Object.entries(incomeByType)
    .map(([name, amount]) => ({
      name,
      amount,
      percentage: income > 0 ? (amount / income) * 100 : 0,
      color: PROJECT_COLORS[name] ?? '#94a3b8',
    }))
    .sort((a, b) => b.amount - a.amount)

  // Despesa por categoria
  const expenseByType = currentTx
    .filter((t) => t.type === 'expense')
    .reduce<Record<string, number>>((acc, t) => {
      const key = t.custom_category ?? t.category ?? 'Outros'
      acc[key] = (acc[key] ?? 0) + Number(t.amount)
      return acc
    }, {})

  const expenseBreakdown = Object.entries(expenseByType)
    .map(([name, amount]) => ({
      name,
      amount,
      percentage: expense > 0 ? (amount / expense) * 100 : 0,
      color: expenseColor(name),
    }))
    .sort((a, b) => b.amount - a.amount)

  // Despesa por origem: cartão / conta / Asaas
  const originSplit = splitExpensesByOrigin(currentTx)
  const originRows = [
    { label: 'Cartão de crédito', value: originSplit.card, color: '#8b5cf6' },
    { label: 'Conta bancária', value: originSplit.account, color: '#3b82f6' },
    { label: 'Asaas', value: originSplit.asaas, color: '#06b6d4' },
  ].filter((r) => r.value > 0)

  // Pró-labore dos sócios: total + split por sócio (subcategoria)
  const proLaboreTx = currentTx.filter((t) => t.type === 'expense' && t.custom_category === 'Pró-labore')
  const proLabore = {
    total: proLaboreTx.reduce((s, t) => s + Number(t.amount), 0),
    karine: proLaboreTx.filter((t) => t.subcategory === 'Karine').reduce((s, t) => s + Number(t.amount), 0),
    andrei: proLaboreTx.filter((t) => t.subcategory === 'Andrei').reduce((s, t) => s + Number(t.amount), 0),
  }
  const proLaboreSemSocio = proLabore.total - proLabore.karine - proLabore.andrei

  // Top 5 clientes por receita
  const clientsByName = currentTx
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
    .slice(0, 5)

  function fmtCustom(ym: string): string {
    const [y, m] = ym.split('-').map(Number)
    if (!y || !m) return ym
    return `${getMonthName(m)} ${y}`
  }

  const periodLabel =
    period === 'month' ? `${getMonthName(month)} ${year}` :
    period === 'year'  ? yearToDateLabel(month, year) :
    customFrom === customTo ? fmtCustom(customFrom) : `${fmtCustom(customFrom)} → ${fmtCustom(customTo)}`

  const prevPeriodLabel =
    period === 'month' ? getMonthName(prevMonth) :
    period === 'year'  ? yearToDateLabel(month, year - 1) :
    ''

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="hidden print:block mb-4">
        <p className="text-xs text-slate-500">
          Panorama — {periodLabel} · gerado em {new Date().toLocaleDateString('pt-BR')}
        </p>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="eyebrow text-stone-500 mb-1">Visão Geral</p>
          <h1 className="font-display text-4xl sm:text-5xl text-stone-900 tracking-tight leading-none">Panorama</h1>
          <p className="text-stone-500 text-sm mt-2 capitalize italic font-display">{periodLabel}</p>
        </div>
        <div className="flex flex-col items-end gap-2 print:hidden">
          <div className="flex items-center gap-2">
            {/* Mode toggle */}
            <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs">
              <button onClick={() => setPeriod('month')}
                className={`px-3 py-1 rounded-md font-medium ${period === 'month' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
                Mês
              </button>
              <button onClick={() => setPeriod('year')}
                className={`px-3 py-1 rounded-md font-medium ${period === 'year' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
                Ano
              </button>
              <button onClick={() => setPeriod('custom')}
                className={`px-3 py-1 rounded-md font-medium ${period === 'custom' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
                Período
              </button>
            </div>

            {/* Navegação por mês */}
            {period === 'month' && (
              <div className="inline-flex items-center gap-1 text-xs">
                <button onClick={() => shiftMonth(-1)} className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-slate-100">
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <span className="min-w-[110px] text-center font-medium capitalize">{getMonthName(month)} {year}</span>
                <button onClick={() => shiftMonth(1)} className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-slate-100">
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Navegação por ano */}
            {period === 'year' && (
              <div className="inline-flex items-center gap-1 text-xs">
                <button onClick={() => setYear(year - 1)} className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-slate-100">
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <span className="min-w-[60px] text-center font-medium">{year}</span>
                <button onClick={() => setYear(year + 1)} className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-slate-100">
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Range custom */}
            {period === 'custom' && (
              <div className="inline-flex items-center gap-1 text-xs">
                <input type="month" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
                  className="h-7 px-2 rounded-md border border-slate-200 text-xs" />
                <span className="text-slate-400">→</span>
                <input type="month" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
                  className="h-7 px-2 rounded-md border border-slate-200 text-xs" />
              </div>
            )}

            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => window.print()}>
              <Printer className="h-3.5 w-3.5" />
              PDF
            </Button>
          </div>

          {/* Toggle comparativo — só faz sentido em mês/ano */}
          {period !== 'custom' && (
            <label className="inline-flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer select-none">
              <input type="checkbox" checked={comparing} onChange={(e) => setComparing(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-300" />
              Comparar com {period === 'month' ? 'mês anterior' : 'ano anterior'}
            </label>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-32 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <>
          {/* KPIs principais */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 break-inside-avoid">
            <KPICard
              label="Receita"
              value={income}
              delta={incomeDelta}
              prevLabel={prevPeriodLabel}
              prevValue={prevIncome}
              color="emerald"
              icon={<TrendingUp className="h-4 w-4" />}
              showComparison={comparing}
            />
            <KPICard
              label="Despesa"
              value={expense}
              delta={expenseDelta}
              prevLabel={prevPeriodLabel}
              prevValue={prevExpense}
              color="red"
              icon={<TrendingDown className="h-4 w-4" />}
              invertDelta
              showComparison={comparing}
            />
            <KPICard
              label="Lucro líquido"
              value={lucro}
              delta={lucroDelta}
              prevLabel={prevPeriodLabel}
              prevValue={prevLucro}
              color={lucro >= 0 ? 'blue' : 'red'}
              icon={<Wallet className="h-4 w-4" />}
              showComparison={comparing}
            />
            <Card className="border border-slate-100 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-amber-600 font-medium">Margem</span>
                  <Target className="h-4 w-4 text-amber-600" />
                </div>
                <p className="display-num text-2xl sm:text-3xl text-stone-800">{margem.toFixed(1)}<span className="text-base ml-0.5 text-stone-400">%</span></p>
                <p className="text-xs text-slate-400 mt-1">
                  R$ {formatCurrency(lucro).replace('R$', '').trim()} de R$ {formatCurrency(income).replace('R$', '').trim()}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Breakdowns — por tipo de projeto + por categoria (movido pra cima) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 break-inside-avoid">
            {/* Receita por tipo */}
            <Card className="border border-slate-100 shadow-sm">
              <CardContent className="p-5">
                <h2 className="text-sm font-semibold text-slate-700 mb-3">Receita por tipo de projeto</h2>
                {incomeBreakdown.length === 0 ? (
                  <p className="text-sm text-slate-400 py-6 text-center">Sem dados no período</p>
                ) : (
                  <div className="flex items-center gap-4">
                    <div className="shrink-0">
                      <ResponsiveContainer width={120} height={120}>
                        <PieChart>
                          <Pie data={incomeBreakdown} cx="50%" cy="50%" innerRadius={30} outerRadius={55}
                            paddingAngle={2} dataKey="amount">
                            {incomeBreakdown.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                          </Pie>
                          <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      {incomeBreakdown.slice(0, 6).map((item) => (
                        <div key={item.name} className="flex items-center gap-2 text-xs">
                          <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                          <span className="truncate text-slate-600 flex-1">{item.name}</span>
                          <span className="font-semibold text-slate-700">{item.percentage.toFixed(0)}%</span>
                        </div>
                      ))}
                      {incomeBreakdown.length > 6 && <p className="text-xs text-slate-400">+{incomeBreakdown.length - 6} outros</p>}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Despesa por categoria */}
            <Card className="border border-slate-100 shadow-sm">
              <CardContent className="p-5">
                <h2 className="text-sm font-semibold text-slate-700 mb-3">Despesa por categoria</h2>
                {expenseBreakdown.length === 0 ? (
                  <p className="text-sm text-slate-400 py-6 text-center">Sem dados no período</p>
                ) : (
                  <div className="flex items-center gap-4">
                    <div className="shrink-0">
                      <ResponsiveContainer width={120} height={120}>
                        <PieChart>
                          <Pie data={expenseBreakdown} cx="50%" cy="50%" innerRadius={30} outerRadius={55}
                            paddingAngle={2} dataKey="amount">
                            {expenseBreakdown.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                          </Pie>
                          <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      {expenseBreakdown.slice(0, 6).map((item) => (
                        <div key={item.name} className="flex items-center gap-2 text-xs">
                          <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                          <span className="truncate text-slate-600 flex-1">{item.name}</span>
                          <span className="font-semibold text-slate-700">{item.percentage.toFixed(0)}%</span>
                        </div>
                      ))}
                      {expenseBreakdown.length > 6 && <p className="text-xs text-slate-400">+{expenseBreakdown.length - 6} outras</p>}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Evolução / tendência */}
          <Card className="border border-slate-100 shadow-sm break-inside-avoid">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-slate-700">Evolução</h2>
                  <button
                    onClick={() => setShowEvolution(!showEvolution)}
                    title={showEvolution ? 'Ocultar gráfico' : 'Mostrar gráfico'}
                    className="h-6 w-6 inline-flex items-center justify-center rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors print:hidden"
                  >
                    {showEvolution ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
                {showEvolution && (
                  <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs">
                    <button onClick={() => setMonthsBack(6)}
                      className={`px-2.5 py-1 rounded-md font-medium ${monthsBack === 6 ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
                      6 meses
                    </button>
                    <button onClick={() => setMonthsBack(12)}
                      className={`px-2.5 py-1 rounded-md font-medium ${monthsBack === 12 ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
                      12 meses
                    </button>
                  </div>
                )}
              </div>
              {showEvolution && (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={trend} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="receita" name="Receita" fill="#10b981" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="despesa" name="Despesa" fill="#f43f5e" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="lucro" name="Lucro" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Despesa por origem */}
          {originRows.length > 0 && (
            <Card className="border border-slate-100 shadow-sm break-inside-avoid">
              <CardContent className="p-5">
                <h2 className="text-sm font-semibold text-slate-700 mb-3">Despesa por origem</h2>
                <div className="space-y-2.5">
                  {originRows.map((row) => {
                    const pct = expense > 0 ? (row.value / expense) * 100 : 0
                    return (
                      <div key={row.label} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="flex items-center gap-2 text-slate-600">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: row.color }} />
                            {row.label}
                          </span>
                          <span className="font-semibold text-slate-700">
                            {formatCurrency(row.value)} <span className="text-xs text-slate-400">{pct.toFixed(0)}%</span>
                          </span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: row.color }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Pró-labore dos sócios */}
          {proLabore.total > 0 && (
            <Card className="border border-teal-100 bg-teal-50/40 shadow-sm break-inside-avoid">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Briefcase className="h-4 w-4 text-teal-700" />
                  <span className="text-sm font-semibold text-slate-700">Pró-labore dos sócios</span>
                </div>
                <p className="display-num text-2xl sm:text-3xl text-teal-800 break-words">{formatCurrency(proLabore.total)}</p>
                <p className="text-xs text-slate-500 mt-1">
                  Karine {formatCurrency(proLabore.karine)} · Andrei {formatCurrency(proLabore.andrei)}
                  {proLaboreSemSocio > 0.005 && <> · A separar {formatCurrency(proLaboreSemSocio)}</>}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Top clientes */}
          {topClients.length > 0 && (
            <Card className="border border-slate-100 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-slate-700">Top 5 clientes do período</h2>
                  <Link href="/reports" className="text-xs text-emerald-700 hover:underline">Ver mais →</Link>
                </div>
                <div className="divide-y divide-slate-100">
                  {topClients.map((c, idx) => (
                    <div key={c.name} className="flex items-center gap-3 py-2.5">
                      <span className="text-xs text-slate-400 font-mono w-6 shrink-0">#{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">{c.name}</p>
                        <p className="text-xs text-slate-400">
                          {c.count} lançamento(s){c.subcategory && ` · ${c.subcategory}`}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-emerald-700 shrink-0">{formatCurrency(c.amount)}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* MRR + Custos fixos (movido pro final) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 break-inside-avoid">
            <Card className="border border-emerald-100 bg-emerald-50/40 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Repeat className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm font-semibold text-slate-700">MRR · Receita recorrente mensal</span>
                  </div>
                  <Link href="/previsao" className="text-xs text-emerald-700 hover:underline">Ver →</Link>
                </div>
                <p className="display-num text-2xl sm:text-3xl text-emerald-800 break-words private">{formatCurrency(mrr)} <span className="text-xs font-normal text-stone-500 ml-1 not-italic">/ mês</span></p>
                <p className="text-xs text-slate-500 mt-1">
                  {recurringClients.filter((c) => c.active).length} cliente(s) ativo(s) · ARR projetado {formatCurrency(arr)}
                </p>
              </CardContent>
            </Card>

            <Card className="border border-red-100 bg-red-50/40 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-red-600" />
                    <span className="text-sm font-semibold text-slate-700">Custos fixos mensais</span>
                  </div>
                  <Link href="/previsao" className="text-xs text-red-700 hover:underline">Ver →</Link>
                </div>
                <p className="display-num text-2xl sm:text-3xl text-red-800 break-words private">{formatCurrency(monthlyFixedCosts)} <span className="text-xs font-normal text-stone-500 ml-1 not-italic">/ mês</span></p>
                <p className="text-xs text-slate-500 mt-1">
                  Equipe + Ferramentas + Infra · projeção anual {formatCurrency(monthlyFixedCosts * 12)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Atalhos */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 print:hidden">
            <Link href="/a-cobrar"><Button variant="outline" className="w-full justify-start gap-2 h-10">
              <AlertCircle className="h-4 w-4 text-amber-600" />A Cobrar<ChevronRight className="h-3 w-3 ml-auto" />
            </Button></Link>
            <Link href="/previsao"><Button variant="outline" className="w-full justify-start gap-2 h-10">
              <Target className="h-4 w-4 text-blue-600" />Previsão<ChevronRight className="h-3 w-3 ml-auto" />
            </Button></Link>
            <Link href="/reports"><Button variant="outline" className="w-full justify-start gap-2 h-10">
              <Briefcase className="h-4 w-4 text-purple-600" />Relatórios<ChevronRight className="h-3 w-3 ml-auto" />
            </Button></Link>
          </div>
        </>
      )}
    </div>
  )
}

interface KPICardProps {
  label: string
  value: number
  delta: number
  prevLabel: string
  prevValue: number
  color: 'emerald' | 'red' | 'blue'
  icon: React.ReactNode
  invertDelta?: boolean
  showComparison?: boolean
}

function KPICard({ label, value, delta, prevLabel, prevValue, color, icon, invertDelta, showComparison }: KPICardProps) {
  // Paleta Fysi: brand-soft + ink + variações refinadas
  const palette: Record<string, { bg: string; border: string; text: string; deltaUp: string; deltaDown: string }> = {
    emerald: { bg: 'bg-[color:var(--brand-soft)]/60', border: 'border-[color:var(--brand)]/20', text: 'text-[color:var(--brand-deep)]', deltaUp: 'text-[color:var(--brand-deep)]', deltaDown: 'text-red-700' },
    red:     { bg: 'bg-red-50/60',                    border: 'border-red-200/50',              text: 'text-red-800',                   deltaUp: 'text-red-700',                deltaDown: 'text-[color:var(--brand-deep)]' },
    blue:    { bg: 'bg-stone-50',                     border: 'border-stone-200/60',            text: 'text-[color:var(--ink)]',        deltaUp: 'text-[color:var(--brand-deep)]', deltaDown: 'text-red-700' },
  }
  const p = palette[color]
  const positiveDelta = invertDelta ? delta < 0 : delta > 0
  const deltaClass = positiveDelta ? p.deltaUp : p.deltaDown
  const DeltaIcon = delta >= 0 ? ArrowUpRight : ArrowDownRight

  return (
    <Card className={`border ${p.border} ${p.bg} shadow-sm`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-1">
          <span className={`text-xs ${p.text} font-medium`}>{label}</span>
          <span className={p.text}>{icon}</span>
        </div>
        <p className={`display-num text-2xl sm:text-3xl private ${p.text} break-words tracking-tight`}>{formatCurrency(value)}</p>
        {showComparison && prevValue > 0 && (
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
            <DeltaIcon className={`h-3 w-3 ${deltaClass}`} />
            <span className={deltaClass}>{Math.abs(delta).toFixed(0)}%</span>
            <span>vs {prevLabel}</span>
          </p>
        )}
        {showComparison && prevValue === 0 && (
          <p className="text-xs text-slate-400 mt-1">sem comparativo</p>
        )}
      </CardContent>
    </Card>
  )
}
