'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Calendar, Repeat, Target, AlertCircle, ChevronRight, Sparkles } from 'lucide-react'
import { getTransactions } from '@/lib/transactions'
import { buildForecast, type ForecastResult } from '@/lib/forecast'
import { formatCurrency } from '@/lib/format'
import { FixedCostsSection } from '@/components/previsao/fixed-costs-section'
import { RecurringClientsSection } from '@/components/previsao/recurring-clients-section'
import type { Transaction } from '@/types'

export function PrevisaoClient() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [windowMonths, setWindowMonths] = useState(6)
  const [forecast, setForecast] = useState<ForecastResult | null>(null)
  const [fixedCostsMonthly, setFixedCostsMonthly] = useState(0)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      // Pega histórico amplo (últimos 12 meses)
      const now = new Date()
      const months: { month: number; year: number }[] = []
      for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        months.push({ month: d.getMonth() + 1, year: d.getFullYear() })
      }
      const results = await Promise.all(months.map((m) => getTransactions(m)))
      setTransactions(results.flat())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    if (transactions.length === 0 && fixedCostsMonthly === 0) {
      setForecast(null)
      return
    }
    setForecast(buildForecast(transactions, {
      windowMonths,
      projectionMonths: 3,
      fixedCostsMonthly,
    }))
  }, [transactions, windowMonths, fixedCostsMonthly])

  const hasData = forecast && forecast.monthlyTotals.length > 0

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Previsão</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Despesa média, assinaturas recorrentes e projeção dos próximos meses
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Janela:</span>
          <Select value={String(windowMonths)} onValueChange={(v) => { if (v) setWindowMonths(Number(v)) }}>
            <SelectTrigger className="h-8 w-auto text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="3">Últimos 3 meses</SelectItem>
              <SelectItem value="6">Últimos 6 meses</SelectItem>
              <SelectItem value="12">Últimos 12 meses</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Clientes recorrentes (MRR) — receita prevista */}
      <RecurringClientsSection />

      {/* Custos fixos vem sempre, mesmo sem histórico */}
      <FixedCostsSection onChange={setFixedCostsMonthly} />

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-32 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      ) : !hasData ? (
        <Card className="border border-dashed border-slate-200 shadow-none">
          <CardContent className="p-10 text-center">
            <Sparkles className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600 font-medium">Ainda não há histórico suficiente</p>
            <p className="text-slate-400 text-sm mt-1 max-w-md mx-auto">
              Importe algumas faturas ou extratos pra eu calcular sua média mensal e detectar
              gastos recorrentes.
            </p>
            <Link href="/import">
              <Button className="mt-4 bg-emerald-600 hover:bg-emerald-700">Importar extrato</Button>
            </Link>
          </CardContent>
        </Card>
      ) : forecast && (
        <>
          {/* Cards de resumo */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card className="border border-slate-100 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-500 font-medium">Média mensal</span>
                  <Calendar className="h-4 w-4 text-emerald-600" />
                </div>
                <p className="text-2xl font-bold text-slate-800">{formatCurrency(forecast.averageMonthly)}</p>
                <p className="text-xs text-slate-400 mt-1">
                  Média de {forecast.monthlyTotals.length} mês(es) · Mediana {formatCurrency(forecast.medianMonthly)}
                </p>
              </CardContent>
            </Card>

            <Card className="border border-slate-100 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-500 font-medium">Recorrentes / mês</span>
                  <Repeat className="h-4 w-4 text-blue-600" />
                </div>
                <p className="text-2xl font-bold text-slate-800">{formatCurrency(forecast.recurringMonthlyEstimate)}</p>
                <p className="text-xs text-slate-400 mt-1">
                  {forecast.recurring.length} assinatura(s)/serviço(s) detectado(s)
                </p>
              </CardContent>
            </Card>

            <Card className="border border-slate-100 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-500 font-medium">Mês corrente (projeção)</span>
                  <Target className="h-4 w-4 text-amber-600" />
                </div>
                <p className="text-2xl font-bold text-slate-800">{formatCurrency(forecast.currentMonthProjected)}</p>
                <p className="text-xs text-slate-400 mt-1">
                  Já gasto: {formatCurrency(forecast.currentMonthSpend)}
                  {forecast.currentMonthProjected > forecast.averageMonthly * 1.1 && (
                    <span className="text-red-500 font-medium"> · acima da média</span>
                  )}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Real vs Previsto — barras */}
          <Card className="border border-slate-100 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-semibold text-slate-700">Histórico vs. Projeção</h2>
                  <p className="text-xs text-slate-400">Últimos meses fechados e próximos 3 meses estimados</p>
                </div>
              </div>

              <div className="space-y-2.5">
                {[...forecast.monthlyTotals, ...forecast.projections].map((m, idx) => {
                  const isProjection = idx >= forecast.monthlyTotals.length
                  const allValues = [...forecast.monthlyTotals.map((x) => x.total), ...forecast.projections.map((x) => x.total)]
                  const maxValue = Math.max(...allValues, 1)
                  const width = (m.total / maxValue) * 100
                  return (
                    <div key={m.monthKey} className="flex items-center gap-3">
                      <span className="text-xs text-slate-500 w-14 shrink-0">{m.monthLabel}</span>
                      <div className="flex-1 h-7 bg-slate-50 rounded-md relative overflow-hidden">
                        <div
                          className={`h-full rounded-md ${isProjection ? 'bg-amber-200' : 'bg-emerald-200'}`}
                          style={{ width: `${width}%` }}
                        />
                        <div className="absolute inset-0 flex items-center px-2.5">
                          <span className={`text-xs font-semibold ${isProjection ? 'text-amber-800' : 'text-emerald-800'}`}>
                            {formatCurrency(m.total)}
                            {isProjection && <span className="ml-1.5 text-[10px] font-normal opacity-70">prev.</span>}
                            {!isProjection && m.count > 0 && <span className="ml-1.5 text-[10px] font-normal opacity-60">({m.count} lanç.)</span>}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Lista de recorrentes */}
          <Card className="border border-slate-100 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-semibold text-slate-700">Assinaturas e gastos recorrentes</h2>
                  <p className="text-xs text-slate-400">Apareceram em pelo menos 3 meses diferentes</p>
                </div>
                <span className="text-xs text-slate-400">{forecast.recurring.length} item(ns)</span>
              </div>

              {forecast.recurring.length === 0 ? (
                <p className="text-sm text-slate-400 py-6 text-center">Nenhum padrão recorrente detectado ainda.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {forecast.recurring.slice(0, 20).map((r) => (
                    <div key={r.groupKey} className="flex items-center justify-between py-2.5 gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-700 truncate">{r.sampleDescription}</p>
                        <p className="text-xs text-slate-400">
                          {r.monthsOccurred} meses · {r.totalOccurrences} lançamento(s) · último: {r.lastSeen}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-slate-800 whitespace-nowrap">
                        {formatCurrency(r.averageAmount)}
                        <span className="text-xs font-normal text-slate-400 ml-1">/ ocorrência</span>
                      </p>
                    </div>
                  ))}
                  {forecast.recurring.length > 20 && (
                    <p className="text-xs text-slate-400 pt-3 text-center">
                      Mostrando 20 de {forecast.recurring.length}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Planejamento futuro */}
          <Card className="border border-dashed border-blue-200 bg-blue-50/40 shadow-none">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-white p-2 shrink-0">
                  <AlertCircle className="h-4 w-4 text-blue-600" />
                </div>
                <div className="flex-1 text-sm">
                  <p className="font-semibold text-slate-700 mb-1">Em breve</p>
                  <ul className="space-y-1 text-slate-600 text-xs">
                    <li className="flex items-center gap-1.5">
                      <ChevronRight className="h-3 w-3" />
                      Comparativo Real × Previsto no fim do mês (alertas)
                    </li>
                    <li className="flex items-center gap-1.5">
                      <ChevronRight className="h-3 w-3" />
                      Detecção de oportunidades de corte (gastos crescendo)
                    </li>
                    <li className="flex items-center gap-1.5">
                      <ChevronRight className="h-3 w-3" />
                      Importar planilha do Andrei (conta secundária)
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
