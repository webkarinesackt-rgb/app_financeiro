'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  AlertTriangle, Phone, ChevronRight, CheckCircle2, Clock, Briefcase, Repeat,
  StickyNote, Plus,
} from 'lucide-react'
import { OverdueList } from '@/components/dashboard/overdue-list'
import { RemindersCard } from '@/components/dashboard/reminders-card'
import { NotesPanel } from '@/components/notes/notes-panel'
import { getACobrarData, whatsappLink, type ACobrarData } from '@/lib/a-cobrar'
import { formatCurrency } from '@/lib/format'
import { CLOSING_STATUS_LABELS } from '@/types'

type Tab = 'cobrar' | 'notes'

export function ACobrarClient() {
  const [tab, setTab] = useState<Tab>('cobrar')
  const [data, setData] = useState<ACobrarData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getACobrarData()
      setData(result)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const recurringCount = data?.recurring.length ?? 0
  const closingsPending = data?.closings.filter((c) => !c.matchedPayment) ?? []
  const closingsCount = closingsPending.length

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">A Cobrar</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Clientes que fecharam mas não pagaram (ou estão atrasados)
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs">
        <button onClick={() => setTab('cobrar')}
          className={`px-3 py-1.5 rounded-md font-medium inline-flex items-center gap-1.5 ${tab === 'cobrar' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
          <AlertTriangle className="h-3.5 w-3.5" /> A Cobrar
        </button>
        <button onClick={() => setTab('notes')}
          className={`px-3 py-1.5 rounded-md font-medium inline-flex items-center gap-1.5 ${tab === 'notes' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
          <StickyNote className="h-3.5 w-3.5" /> Anotações
        </button>
      </div>

      {tab === 'notes' && <NotesPanel />}

      {tab === 'cobrar' && (
        <div className="space-y-5">

      {/* Adicionar cobrança manual (lista de pendências do user) */}
      <RemindersCard type="invoice_pending" />

      {/* Resumo */}
      {loading ? (
        <Card className="border border-slate-100"><CardContent className="p-5">
          <div className="h-20 bg-slate-100 rounded-lg animate-pulse" />
        </CardContent></Card>
      ) : (
        <Card className="border border-amber-200 bg-amber-50/40 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-amber-100 p-2.5">
                <AlertTriangle className="h-5 w-5 text-amber-700" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-amber-700 font-medium">Total potencialmente a cobrar</p>
                <p className="text-2xl font-bold text-amber-900 private">{formatCurrency(data?.totalPending ?? 0)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-amber-700 font-medium">Clientes pendentes</p>
                <p className="text-xl font-bold text-amber-900">{recurringCount + closingsCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recorrentes em atraso */}
      <Card className="border border-slate-100 shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="rounded-lg bg-emerald-50 p-2">
              <Repeat className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-700">Recorrentes em atraso</h2>
              <p className="text-xs text-slate-400">Clientes mensais sem pagamento detectado nos últimos 35 dias</p>
            </div>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-slate-100 rounded-lg animate-pulse" />)}
            </div>
          ) : recurringCount === 0 ? (
            <div className="flex items-center gap-2 py-4 text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
              <p className="text-sm">Todos os clientes recorrentes estão em dia 🎉</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {data?.recurring.map((r) => (
                <div key={r.client.id} className="flex items-center justify-between py-3 gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`h-2 w-2 rounded-full shrink-0 ${r.status === 'never' ? 'bg-red-500' : 'bg-amber-500'}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{r.client.name}</p>
                      <p className="text-xs text-slate-400">
                        {r.status === 'never'
                          ? '🚨 Nenhum pagamento detectado nos últimos 60 dias'
                          : `⚠️ Último pagamento em ${r.lastPaymentDate} (${r.daysSinceLastPayment} dias)`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-emerald-700">{formatCurrency(Number(r.client.amount))}</p>
                    <p className="text-[10px] text-slate-400">/ mês</p>
                  </div>
                  <Link href="/previsao" className="shrink-0">
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                      Ver
                      <ChevronRight className="h-3 w-3" />
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fechamentos sem pagamento */}
      <Card className="border border-slate-100 shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="rounded-lg bg-blue-50 p-2">
              <Briefcase className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-700">Fechamentos sem pagamento</h2>
              <p className="text-xs text-slate-400">Projetos fechados onde não encontrei pagamento batendo o nome</p>
            </div>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-slate-100 rounded-lg animate-pulse" />)}
            </div>
          ) : closingsCount === 0 ? (
            <div className="flex items-center gap-2 py-4 text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
              <p className="text-sm">Nenhum fechamento aparentemente em aberto 🎉</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {closingsPending.map((c) => {
                const wa = whatsappLink(c.project.whatsapp)
                return (
                  <div key={c.project.id} className="flex items-center justify-between py-3 gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="h-2 w-2 rounded-full shrink-0 bg-blue-500" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">
                          {c.project.client_name}
                        </p>
                        <p className="text-xs text-slate-400">
                          {c.project.project_kind ?? 'Projeto'}
                          {' · '}
                          Fechou há {c.daysSinceClose}d
                          {' · '}
                          Status: {CLOSING_STATUS_LABELS[c.project.status]}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-blue-700">{formatCurrency(Number(c.project.total_value))}</p>
                    </div>
                    {wa && (
                      <a href={wa} target="_blank" rel="noopener noreferrer" className="shrink-0">
                        <Button variant="outline" size="sm" className="h-8 text-xs gap-1 text-emerald-700 border-emerald-200">
                          <Phone className="h-3 w-3" />
                          WhatsApp
                        </Button>
                      </a>
                    )}
                    <Link href="/closings" className="shrink-0">
                      <Button variant="ghost" size="sm" className="h-8 text-xs">
                        <ChevronRight className="h-3 w-3" />
                      </Button>
                    </Link>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Asaas atrasadas */}
      <Card className="border border-slate-100 shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="rounded-lg bg-red-50 p-2">
              <Clock className="h-4 w-4 text-red-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-700">Cobranças vencidas no Asaas</h2>
              <p className="text-xs text-slate-400">Cobranças PENDING/OVERDUE com dueDate passado</p>
            </div>
          </div>
          <OverdueList />
        </CardContent>
      </Card>

        </div>
      )}
    </div>
  )
}
