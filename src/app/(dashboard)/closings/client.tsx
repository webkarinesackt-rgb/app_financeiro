'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus } from 'lucide-react'
import { MonthSelector } from '@/components/dashboard/month-selector'
import { ClosingsSummary } from '@/components/closings/closings-summary'
import { ClosingsTable } from '@/components/closings/closings-table'
import { ClosingForm } from '@/components/closings/closing-form'
import { getClosings } from '@/lib/closings'
import { CLOSING_STATUS_LABELS, CLOSING_CHANNELS, type Closing, type ClosingStatus } from '@/types'

function ClosingsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const now = new Date()
  const month = Number(searchParams.get('month')) || now.getMonth() + 1
  const year = Number(searchParams.get('year')) || now.getFullYear()
  const status = searchParams.get('status') ?? 'all'
  const channel = searchParams.get('channel') ?? 'all'

  const [closings, setClosings] = useState<Closing[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await getClosings({ month, year, status, channel })
      setClosings(rows)
    } finally {
      setLoading(false)
    }
  }, [month, year, status, channel])

  useEffect(() => { fetchAll() }, [fetchAll])

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value === 'all') params.delete(key)
    else params.set(key, value)
    router.push(`?${params.toString()}`)
  }

  const statusOptions: ClosingStatus[] = ['closed', 'in_production', 'delivered', 'paid', 'cancelled']

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Fechamentos do mês</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {closings.length} fechamento(s) no período
          </p>
        </div>
        <Button
          className="bg-emerald-600 hover:bg-emerald-700 gap-2 self-start sm:self-auto"
          onClick={() => setShowForm(true)}
        >
          <Plus className="h-4 w-4" />
          Novo Fechamento
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <MonthSelector month={month} year={year} />

        <Select value={status} onValueChange={(v) => { if (v) setParam('status', v) }}>
          <SelectTrigger className="h-8 w-auto min-w-[140px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            {statusOptions.map((s) => (
              <SelectItem key={s} value={s}>{CLOSING_STATUS_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={channel} onValueChange={(v) => { if (v) setParam('channel', v) }}>
          <SelectTrigger className="h-8 w-auto min-w-[130px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos canais</SelectItem>
            {CLOSING_CHANNELS.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ClosingsSummary closings={closings} />

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <ClosingsTable closings={closings} onRefresh={fetchAll} />
      )}

      <ClosingForm
        open={showForm}
        onClose={() => setShowForm(false)}
        onSuccess={fetchAll}
      />
    </div>
  )
}

export function ClosingsClient() {
  return (
    <Suspense>
      <ClosingsContent />
    </Suspense>
  )
}
