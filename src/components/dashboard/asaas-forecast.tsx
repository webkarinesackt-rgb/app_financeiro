'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, Loader2, AlertCircle } from 'lucide-react'
import { formatCurrency } from '@/lib/format'

interface ForecastMonth {
  month: string
  monthLabel: string
  total: number
  count: number
  byIntegration: Record<string, { name: string; total: number; count: number }>
}

export function AsaasForecast() {
  const [data, setData] = useState<ForecastMonth[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/asaas/forecast?months=3', { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : Promise.reject(new Error(`${r.status}`)))
      .then((j) => { if (!cancelled) setData(j.forecast) })
      .catch((e) => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const grandTotal = data?.reduce((s, m) => s + m.total, 0) ?? 0

  return (
    <Card className="border border-slate-100 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-slate-700 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-emerald-600" /> Próximos recebimentos (Asaas)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8 text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-red-500 text-sm py-2">
            <AlertCircle className="h-4 w-4" /> Erro ao carregar: {error}
          </div>
        ) : !data || data.every((m) => m.count === 0) ? (
          <p className="text-slate-400 text-sm text-center py-8">
            Nenhuma cobrança pendente nos próximos meses
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-baseline justify-between pb-2 border-b border-slate-100">
              <span className="text-xs uppercase tracking-wide text-slate-500">Total previsto</span>
              <span className="text-lg font-bold text-emerald-700">{formatCurrency(grandTotal)}</span>
            </div>
            <div className="space-y-2">
              {data.map((m) => (
                <div key={m.month} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-700 capitalize">{m.monthLabel}</span>
                    {m.count > 0 && (
                      <span className="text-xs text-slate-400">{m.count} cobr.</span>
                    )}
                  </div>
                  <span className={`text-sm font-semibold ${m.total > 0 ? 'text-slate-800' : 'text-slate-300'}`}>
                    {formatCurrency(m.total)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
