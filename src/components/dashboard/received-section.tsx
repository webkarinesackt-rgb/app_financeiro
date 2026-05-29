'use client'

import { Card, CardContent } from '@/components/ui/card'
import { ArrowDownLeft } from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import type { AccountWithBalance, Transaction } from '@/types'

interface Props {
  transactions: Transaction[]       // mês atual
  accounts: AccountWithBalance[]
  monthLabel: string                // "Maio/2026"
}

export function ReceivedSection({ transactions, accounts, monthLabel }: Props) {
  const total = sumIncome(transactions)

  // Por origem (account)
  const byAccount = groupByAccount(transactions, accounts)
  const maxBy = byAccount.reduce((m, x) => Math.max(m, x.amount), 0)

  return (
    <section>
      <div className="flex items-baseline justify-between mb-2 px-1">
        <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
          <ArrowDownLeft className="h-3.5 w-3.5" /> Recebido em {monthLabel}
        </h2>
      </div>

      <Card className="border border-emerald-100 shadow-sm bg-gradient-to-br from-emerald-50/40 to-white">
        <CardContent className="pt-5 pb-5 space-y-5">
          {/* Total */}
          <div>
            <p className="text-3xl font-bold text-emerald-700 leading-tight">{formatCurrency(total)}</p>
          </div>

          {/* Por origem */}
          {byAccount.length > 0 && (
            <div className="space-y-2 pt-3 border-t border-emerald-100">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Por origem</p>
              <div className="space-y-1.5">
                {byAccount.map((it) => (
                  <div key={it.id} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: it.color }} />
                        <span className="text-sm text-slate-700 truncate">{it.name}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-sm font-semibold text-slate-800">{formatCurrency(it.amount)}</span>
                        <span className="text-xs text-slate-400 ml-1.5">{((it.amount / total) * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                    <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full"
                        style={{ width: `${(it.amount / maxBy) * 100}%`, backgroundColor: it.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  )
}

function sumIncome(txs: Transaction[]) {
  return txs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
}

interface ByAccount { id: string; name: string; color: string; amount: number }
function groupByAccount(txs: Transaction[], accounts: AccountWithBalance[]): ByAccount[] {
  const map = new Map<string | null, number>()
  for (const t of txs) {
    if (t.type !== 'income') continue
    map.set(t.account_id, (map.get(t.account_id) ?? 0) + t.amount)
  }
  return Array.from(map.entries())
    .map(([id, amount]) => {
      const acc = accounts.find((a) => a.id === id)
      return {
        id: id ?? 'none',
        name: acc?.name ?? 'Outros / manual',
        color: acc?.color ?? '#94a3b8',
        amount,
      }
    })
    .sort((a, b) => b.amount - a.amount)
}
