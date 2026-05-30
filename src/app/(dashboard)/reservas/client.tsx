'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, PiggyBank, TrendingUp, ArrowUpRight, Settings2, FileSpreadsheet } from 'lucide-react'
import { getReserveAccountsWithBalances } from '@/lib/accounts'
import { formatCurrency } from '@/lib/format'
import { AccountForm } from '@/components/accounts/account-form'
import type { AccountWithBalance, Account } from '@/types'

export function ReservasClient() {
  const [reserves, setReserves] = useState<AccountWithBalance[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Account | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const rs = await getReserveAccountsWithBalances()
      setReserves(rs)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const total = reserves.reduce((s, a) => s + a.currentBalance, 0)

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Reservas</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Dinheiro guardado, separado do fluxo operacional
          </p>
        </div>
        <Button
          className="bg-emerald-600 hover:bg-emerald-700 gap-2 self-start sm:self-auto"
          onClick={() => setShowForm(true)}
        >
          <Plus className="h-4 w-4" />
          Nova Reserva
        </Button>
      </div>

      {/* Total */}
      <Card className="border border-slate-100 shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="rounded-lg bg-blue-50 p-2">
              <PiggyBank className="h-5 w-5 text-blue-600" />
            </div>
            <span className="text-sm text-slate-500">Total guardado</span>
          </div>
          <p className="text-3xl font-bold text-slate-800 private">{formatCurrency(total)}</p>
          <p className="text-xs text-slate-400 mt-1">
            {reserves.length} reserva(s) ativa(s) · não entra no Saldo Geral
          </p>
        </CardContent>
      </Card>

      {/* Lista de reservas */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : reserves.length === 0 ? (
        <Card className="border border-dashed border-slate-200 shadow-none">
          <CardContent className="p-10 text-center">
            <PiggyBank className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600 font-medium">Nenhuma reserva ainda</p>
            <p className="text-slate-400 text-sm mt-1">
              Cadastre sua primeira reserva (ex: Banco Inter) clicando em &ldquo;Nova Reserva&rdquo;.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {reserves.map((r) => (
            <Card key={r.id} className="border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className="h-10 w-10 rounded-xl flex items-center justify-center text-white font-bold shrink-0"
                      style={{ backgroundColor: r.color }}
                    >
                      {r.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 truncate">{r.name}</p>
                      <p className="text-xs text-slate-400">
                        {r.bank ? r.bank.charAt(0).toUpperCase() + r.bank.slice(1) : 'Reserva'}
                        {' · '}
                        Saldo inicial {formatCurrency(r.initial_balance)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-slate-800">{formatCurrency(r.currentBalance)}</p>
                    <button
                      onClick={() => setEditing(r)}
                      className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700 mt-0.5"
                    >
                      <Settings2 className="h-3 w-3" />
                      Editar
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Banner: próximas features */}
      {reserves.length > 0 && (
        <Card className="border border-dashed border-blue-200 bg-blue-50/40 shadow-none">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-white p-2 shrink-0">
                <TrendingUp className="h-4 w-4 text-blue-600" />
              </div>
              <div className="flex-1 text-sm">
                <p className="font-semibold text-slate-700 mb-1">Em breve</p>
                <ul className="space-y-1 text-slate-600 text-xs">
                  <li className="flex items-center gap-1.5">
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    Upload de planilha (CSV/Excel) com aportes e retiradas
                  </li>
                  <li className="flex items-center gap-1.5">
                    <ArrowUpRight className="h-3.5 w-3.5" />
                    Integração com Banco Inter (Pix + extrato)
                  </li>
                  <li className="flex items-center gap-1.5">
                    <PiggyBank className="h-3.5 w-3.5" />
                    Transferência entre contas (operacional ↔ reserva) em 1 clique
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-slate-400 text-center pt-2">
        Para gerenciar todas as contas (operacionais + reservas):{' '}
        <Link href="/settings/accounts" className="text-emerald-600 hover:text-emerald-700 font-medium">
          Configurações de contas
        </Link>
      </p>

      <AccountForm
        open={showForm}
        onClose={() => setShowForm(false)}
        onSuccess={fetchData}
        defaultKind="reserve"
      />

      {editing && (
        <AccountForm
          open={!!editing}
          onClose={() => setEditing(null)}
          onSuccess={fetchData}
          account={editing}
        />
      )}
    </div>
  )
}
