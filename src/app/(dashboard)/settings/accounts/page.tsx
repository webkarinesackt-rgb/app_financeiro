'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AccountForm } from '@/components/accounts/account-form'
import { getAllAccountsWithBalances, deleteAccount, moveAccountToWorkspace } from '@/lib/accounts'
import { formatCurrency } from '@/lib/format'
import { getBankColor, getBankName, ACCOUNT_TYPE_LABELS, type AccountWithBalance } from '@/types'
import { Plus, Pencil, Trash2, Wallet, ArrowRightLeft } from 'lucide-react'
import { toast } from 'sonner'
import { useWorkspace } from '@/hooks/use-workspace'

export default function AccountsPage() {
  const workspace = useWorkspace()
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editAccount, setEditAccount] = useState<AccountWithBalance | undefined>()
  const [deleting, setDeleting] = useState<string | null>(null)
  const [moving, setMoving] = useState<string | null>(null)

  const fetchAccounts = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getAllAccountsWithBalances()
      setAccounts(data)
    } finally {
      setLoading(false)
    }
  }, [])

  async function handleMove(id: string, target: 'business' | 'personal') {
    setMoving(id)
    const ok = await moveAccountToWorkspace(id, target)
    if (ok) {
      toast.success(`Conta movida para ${target === 'business' ? 'Fysi' : 'PF'}`)
      fetchAccounts()
    } else {
      toast.error('Não foi possível mover (cache PostgREST stale). Pause/restaure o projeto no Supabase.')
    }
    setMoving(null)
  }

  useEffect(() => { fetchAccounts() }, [fetchAccounts])

  function openNew() {
    setEditAccount(undefined)
    setFormOpen(true)
  }

  function openEdit(acc: AccountWithBalance) {
    setEditAccount(acc)
    setFormOpen(true)
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir esta conta? As transações vinculadas não serão apagadas.')) return
    setDeleting(id)
    try {
      await deleteAccount(id)
      toast.success('Conta excluída')
      fetchAccounts()
    } catch {
      toast.error('Erro ao excluir conta')
    } finally {
      setDeleting(null)
    }
  }

  const currentWsAccounts = accounts.filter((a) => (a.workspace ?? 'business') === workspace)
  const wrongWsAccounts = accounts.filter((a) => (a.workspace ?? 'business') !== workspace)
  const totalBalance = currentWsAccounts.filter((a) => a.include_in_total).reduce((s, a) => s + a.currentBalance, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Contas bancárias</h2>
          <p className="text-sm text-slate-500">Gerencie suas contas e saldos</p>
        </div>
        <Button onClick={openNew} size="sm" className="bg-emerald-600 hover:bg-emerald-700 gap-1.5">
          <Plus className="h-4 w-4" /> Nova conta
        </Button>
      </div>

      {/* Saldo total */}
      {currentWsAccounts.length > 0 && (
        <Card className="border border-emerald-100 bg-emerald-50/50 shadow-none">
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Saldo geral (contas incluídas)</span>
              <span className={`text-base font-bold private ${totalBalance >= 0 ? 'text-emerald-700' : 'text-red-500'}`}>
                {formatCurrency(totalBalance)}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Aviso de contas no workspace errado */}
      {wrongWsAccounts.length > 0 && (
        <Card className="border border-amber-200 bg-amber-50 shadow-none">
          <CardContent className="py-3 px-4 text-xs text-amber-800">
            <strong>{wrongWsAccounts.length} conta(s)</strong> em outro workspace abaixo.
            Use o botão <ArrowRightLeft className="h-3 w-3 inline" /> pra trazer pro workspace
            atual ({workspace === 'personal' ? 'PF' : 'Fysi'}).
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <Card className="border border-slate-100 shadow-sm">
          <CardContent className="py-16 text-center">
            <Wallet className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">Nenhuma conta cadastrada</p>
            <p className="text-slate-400 text-sm mt-1">Adicione uma conta para controlar seu saldo</p>
            <Button onClick={openNew} size="sm" className="mt-4 bg-emerald-600 hover:bg-emerald-700 gap-1.5">
              <Plus className="h-4 w-4" /> Criar primeira conta
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {accounts.map((acc) => (
            <Card key={acc.id} className="border border-slate-100 shadow-sm">
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div
                    className="h-10 w-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                    style={{ backgroundColor: acc.color || getBankColor(acc.bank) }}
                  >
                    {acc.name.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-slate-800 truncate">{acc.name}</p>
                      {(() => {
                        const ws = (acc.workspace ?? 'business') as 'business' | 'personal'
                        const wrongWs = ws !== workspace
                        return (
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${
                            ws === 'personal'
                              ? 'bg-violet-100 text-violet-700'
                              : 'bg-emerald-100 text-emerald-700'
                          } ${wrongWs ? 'ring-1 ring-amber-400' : ''}`}>
                            {ws === 'personal' ? 'PF' : 'Fysi'}
                          </span>
                        )
                      })()}
                      {!acc.include_in_total && (
                        <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded shrink-0">
                          excluída do total
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">
                      {ACCOUNT_TYPE_LABELS[acc.type]}{acc.bank ? ` · ${getBankName(acc.bank)}` : ''}
                    </p>
                  </div>

                  {/* Balance */}
                  <div className="text-right shrink-0 mr-2">
                    <p className={`text-sm font-bold private ${acc.currentBalance >= 0 ? 'text-slate-700' : 'text-red-500'}`}>
                      {formatCurrency(acc.currentBalance)}
                    </p>
                    {acc.initial_balance !== 0 && (
                      <p className="text-xs text-slate-400">inicial: {formatCurrency(acc.initial_balance)}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1 shrink-0">
                    {(() => {
                      const ws = (acc.workspace ?? 'business') as 'business' | 'personal'
                      const target = ws === 'business' ? 'personal' : 'business'
                      const wrongWs = ws !== workspace
                      return wrongWs ? (
                        <button
                          onClick={() => handleMove(acc.id, target)}
                          disabled={moving === acc.id}
                          title={`Mover para ${target === 'personal' ? 'PF' : 'Fysi'}`}
                          className="p-1.5 rounded-lg text-amber-600 hover:text-amber-700 hover:bg-amber-50 transition-colors disabled:opacity-50"
                        >
                          <ArrowRightLeft className="h-3.5 w-3.5" />
                        </button>
                      ) : null
                    })()}
                    <button
                      onClick={() => openEdit(acc)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(acc.id)}
                      disabled={deleting === acc.id}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AccountForm
        open={formOpen}
        account={editAccount}
        onClose={() => setFormOpen(false)}
        onSuccess={fetchAccounts}
      />
    </div>
  )
}
