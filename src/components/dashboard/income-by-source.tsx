'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowDownRight } from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import type { AccountWithBalance, Transaction } from '@/types'

interface IncomeBySourceProps {
  transactions: Transaction[]
  accounts: AccountWithBalance[]
}

export function IncomeBySource({ transactions, accounts }: IncomeBySourceProps) {
  // Soma de receitas (income) agrupada por account_id.
  // Transações sem account_id ficam em "Outros".
  const byAccount = new Map<string | null, number>()
  for (const t of transactions) {
    if (t.type !== 'income') continue
    const k = t.account_id ?? null
    byAccount.set(k, (byAccount.get(k) ?? 0) + t.amount)
  }

  const total = Array.from(byAccount.values()).reduce((s, v) => s + v, 0)

  const items = Array.from(byAccount.entries())
    .map(([accountId, amount]) => {
      const acc = accounts.find((a) => a.id === accountId)
      return {
        id: accountId ?? 'none',
        name: acc?.name ?? 'Outros / manual',
        color: acc?.color ?? '#94a3b8',
        amount,
        pct: total > 0 ? (amount / total) * 100 : 0,
      }
    })
    .sort((a, b) => b.amount - a.amount)

  return (
    <Card className="border border-slate-100 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-slate-700 flex items-center gap-2">
          <ArrowDownRight className="h-4 w-4 text-emerald-600" /> Entradas por origem (este mês)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-8">Nenhuma entrada registrada no mês</p>
        ) : (
          <div className="space-y-2.5">
            {items.map((it) => (
              <div key={it.id} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: it.color }} />
                    <span className="text-sm text-slate-700 truncate">{it.name}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-sm font-semibold text-slate-800">{formatCurrency(it.amount)}</span>
                    <span className="text-xs text-slate-400 ml-1.5">{it.pct.toFixed(0)}%</span>
                  </div>
                </div>
                <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${it.pct}%`, backgroundColor: it.color }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
