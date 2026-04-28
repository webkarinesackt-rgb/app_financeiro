import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowUpRight } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/format'
import { getCategoryLabel } from '@/types'
import type { Transaction } from '@/types'

interface RecentTransactionsProps {
  transactions: Transaction[]
}

export function RecentTransactions({ transactions }: RecentTransactionsProps) {
  return (
    <Card className="border border-slate-100 shadow-sm">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold text-slate-700">
          Transações Recentes
        </CardTitle>
        <Link href="/transactions">
          <Button variant="ghost" size="sm" className="text-emerald-600 hover:text-emerald-700 gap-1 h-8">
            Ver todas <ArrowUpRight className="h-3 w-3" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-8">
            Nenhuma transação no período
          </p>
        ) : (
          <div className="space-y-3">
            {transactions.slice(0, 5).map((t) => (
              <div key={t.id} className="flex items-center justify-between py-1">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${
                    t.type === 'income' ? 'bg-emerald-500' : 'bg-red-400'
                  }`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{t.description}</p>
                    <p className="text-xs text-slate-400">{formatDate(t.date)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <Badge variant="outline" className="text-xs hidden sm:flex">
                    {getCategoryLabel(t.category, t.custom_category)}
                  </Badge>
                  <span className={`text-sm font-semibold ${
                    t.type === 'income' ? 'text-emerald-600' : 'text-red-500'
                  }`}>
                    {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
