import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/format'
import { computeDelta } from './comparison'

export function DeltaBadge({
  current,
  previous,
  invertColor = false,
}: {
  current: number
  previous: number
  invertColor?: boolean
}) {
  const { abs, pct } = computeDelta(current, previous)
  const positive = abs > 0
  const good = invertColor ? !positive : positive
  const colorClass = abs === 0 ? 'text-stone-500' : good ? 'text-emerald-600' : 'text-red-500'
  return (
    <div className={cn('text-xs font-medium flex items-center gap-1', colorClass)}>
      <span>
        {abs >= 0 ? '↑' : '↓'} {formatCurrency(Math.abs(abs))}
      </span>
      {pct !== null && (
        <span className="opacity-70">
          ({pct >= 0 ? '+' : ''}
          {pct.toFixed(1)}%)
        </span>
      )}
    </div>
  )
}
