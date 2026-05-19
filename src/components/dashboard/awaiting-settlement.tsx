'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Clock, Loader2 } from 'lucide-react'
import { formatCurrency } from '@/lib/format'

interface Data {
  total: number
  count: number
  byIntegration: { id: string; name: string; total: number; count: number }[]
}

export function AwaitingSettlement() {
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('/api/asaas/awaiting-settlement', { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : Promise.reject(new Error(`${r.status}`)))
      .then((j) => { if (!cancelled) setData(j) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  return (
    <Card className="border border-blue-100 shadow-sm bg-gradient-to-br from-blue-50/40 to-white">
      <CardContent className="py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
              <Clock className="h-4 w-4 text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-700 leading-tight">Aguardando repasse</p>
              <p className="text-xs text-slate-500">Pagas mas ainda não caíram em conta</p>
            </div>
          </div>
          <div className="text-right shrink-0">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-slate-400 inline" />
            ) : (
              <>
                <p className="text-lg font-bold text-blue-700 leading-tight">
                  {formatCurrency(data?.total ?? 0)}
                </p>
                {data && data.count > 0 && (
                  <p className="text-xs text-slate-400">{data.count} cobranças</p>
                )}
              </>
            )}
          </div>
        </div>

        {data && data.byIntegration.length > 1 && (
          <div className="mt-3 pt-3 border-t border-blue-100 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
            {data.byIntegration.map((b) => (
              <span key={b.id}>{b.name}: <span className="font-semibold text-slate-700">{formatCurrency(b.total)}</span></span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
