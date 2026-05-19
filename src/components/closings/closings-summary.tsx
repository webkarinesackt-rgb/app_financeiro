'use client'

import { formatCurrency } from '@/lib/format'
import { TrendingUp, Hash, Coins, Trophy } from 'lucide-react'
import type { Closing } from '@/types'

interface ClosingsSummaryProps {
  closings: Closing[]
}

export function ClosingsSummary({ closings }: ClosingsSummaryProps) {
  const total = closings.reduce((s, c) => s + Number(c.total_value), 0)
  const count = closings.length
  const average = count > 0 ? total / count : 0

  const byChannel = closings.reduce<Record<string, number>>((acc, c) => {
    const key = c.channel ?? 'Sem canal'
    acc[key] = (acc[key] ?? 0) + Number(c.total_value)
    return acc
  }, {})
  const topChannel = Object.entries(byChannel).sort((a, b) => b[1] - a[1])[0]

  const cards = [
    {
      label: 'Total fechado',
      value: formatCurrency(total),
      icon: TrendingUp,
      color: 'emerald',
    },
    {
      label: 'Fechamentos',
      value: String(count),
      icon: Hash,
      color: 'blue',
    },
    {
      label: 'Ticket médio',
      value: formatCurrency(average),
      icon: Coins,
      color: 'amber',
    },
    {
      label: 'Canal top',
      value: topChannel ? topChannel[0] : '—',
      sub: topChannel ? formatCurrency(topChannel[1]) : null,
      icon: Trophy,
      color: 'purple',
    },
  ] as const

  const palette: Record<string, { bg: string; border: string; text: string; icon: string }> = {
    emerald: { bg: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-emerald-700', icon: 'text-emerald-600' },
    blue:    { bg: 'bg-blue-50',    border: 'border-blue-100',    text: 'text-blue-700',    icon: 'text-blue-600' },
    amber:   { bg: 'bg-amber-50',   border: 'border-amber-100',   text: 'text-amber-700',   icon: 'text-amber-600' },
    purple:  { bg: 'bg-purple-50',  border: 'border-purple-100',  text: 'text-purple-700',  icon: 'text-purple-600' },
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((c) => {
        const Icon = c.icon
        const p = palette[c.color]
        return (
          <div key={c.label} className={`${p.bg} border ${p.border} rounded-xl p-3.5`}>
            <div className="flex items-center justify-between">
              <p className={`text-xs ${p.text} font-medium`}>{c.label}</p>
              <Icon className={`h-4 w-4 ${p.icon}`} />
            </div>
            <p className={`text-lg font-bold ${p.text} mt-1 truncate`}>{c.value}</p>
            {'sub' in c && c.sub && (
              <p className={`text-xs ${p.text} opacity-70 mt-0.5`}>{c.sub}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
