'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, Loader2, ExternalLink } from 'lucide-react'
import { formatCurrency } from '@/lib/format'

interface OverdueItem {
  id: string
  integrationId: string
  integrationName: string
  customerName: string
  description: string | null
  value: number
  dueDate: string
  daysOverdue: number
  invoiceUrl: string | null
}

export function OverdueList() {
  const [items, setItems] = useState<OverdueItem[] | null>(null)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/asaas/overdue', { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : Promise.reject(new Error(`${r.status}`)))
      .then((j) => { if (!cancelled) { setItems(j.overdue); setTotal(j.total) } })
      .catch((e) => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  return (
    <Card className="border border-slate-100 shadow-sm">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold text-slate-700 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" /> Cobranças atrasadas
        </CardTitle>
        {items && items.length > 0 && (
          <span className="text-sm font-semibold text-amber-600">{formatCurrency(total)}</span>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8 text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : error ? (
          <p className="text-red-500 text-sm py-2">Erro ao carregar: {error}</p>
        ) : !items || items.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-8">Nenhuma cobrança atrasada 🎉</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.slice(0, 6).map((it) => (
              <div key={it.id} className="flex items-center justify-between py-2.5 gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800 truncate">{it.customerName}</p>
                  <p className="text-xs text-slate-400 truncate">
                    {it.description || it.integrationName} · {it.daysOverdue}d atraso
                  </p>
                </div>
                <div className="text-right shrink-0 flex items-center gap-2">
                  <span className="text-sm font-semibold text-amber-700">{formatCurrency(it.value)}</span>
                  {it.invoiceUrl && (
                    <a href={it.invoiceUrl} target="_blank" rel="noopener noreferrer"
                      className="text-slate-400 hover:text-slate-700">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              </div>
            ))}
            {items.length > 6 && (
              <p className="text-xs text-slate-400 text-center pt-2">+ {items.length - 6} outras cobranças atrasadas</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
