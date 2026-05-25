'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'
import {
  type PeriodPreset, PERIOD_PRESET_LABELS, presetToRange,
} from './period-presets'
import { shiftRange, sameSizePrevRange } from './comparison'

type Props = {
  from: string         // YYYY-MM
  to: string           // YYYY-MM
  compareFrom?: string // YYYY-MM
  compareTo?: string   // YYYY-MM
}

export function PeriodSelector({ from, to, compareFrom, compareTo }: Props) {
  const router = useRouter()
  const params = useSearchParams()
  const [open, setOpen] = useState(false)
  const comparing = Boolean(compareFrom && compareTo)

  function setParamsAndPush(updates: Record<string, string | null>) {
    const sp = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(updates)) {
      if (v === null) sp.delete(k)
      else sp.set(k, v)
    }
    router.push(`?${sp.toString()}`)
  }

  function applyRange(nextFrom: string, nextTo: string) {
    setParamsAndPush({ from: nextFrom, to: nextTo })
  }

  function pickPreset(preset: PeriodPreset) {
    setOpen(false)
    if (preset === 'custom') return
    const { from: f, to: t } = presetToRange(preset)
    applyRange(f, t)
  }

  function toggleCompare() {
    if (comparing) {
      setParamsAndPush({ compareFrom: null, compareTo: null })
    } else {
      const shifted = shiftRange({ from, to }, 12)
      setParamsAndPush({ compareFrom: shifted.from, compareTo: shifted.to })
    }
  }

  function applyComparePreset(kind: 'prev' | 'yoy') {
    const r = kind === 'prev'
      ? sameSizePrevRange({ from, to })
      : shiftRange({ from, to }, 12)
    setParamsAndPush({ compareFrom: r.from, compareTo: r.to })
  }

  return (
    <div className="flex flex-col gap-2 items-end">
      <div className="flex flex-wrap items-center gap-2">
        {/* Preset dropdown */}
        <div className="relative">
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 bg-white text-sm hover:bg-stone-50"
          >
            Período <ChevronDown className="h-3.5 w-3.5" />
          </button>
          {open && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
              <div className="absolute left-0 top-full mt-1 z-20 w-52 bg-white border border-stone-200 rounded-lg shadow-lg py-1">
                {(Object.keys(PERIOD_PRESET_LABELS) as PeriodPreset[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => pickPreset(p)}
                    className="block w-full text-left px-3 py-2 text-sm text-stone-700 hover:bg-stone-50"
                  >
                    {PERIOD_PRESET_LABELS[p]}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* De/Até inputs */}
        <label className="flex items-center gap-1.5 text-xs text-stone-500">
          De
          <input
            type="month"
            value={from}
            onChange={(e) => applyRange(e.target.value, to)}
            className="border border-stone-200 rounded-md px-2 py-1 text-sm"
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-stone-500">
          Até
          <input
            type="month"
            value={to}
            onChange={(e) => applyRange(from, e.target.value)}
            className="border border-stone-200 rounded-md px-2 py-1 text-sm"
          />
        </label>

        {/* Compare toggle */}
        <button
          onClick={toggleCompare}
          className={cn(
            'px-3 py-1.5 rounded-lg border text-sm transition-colors',
            comparing
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-white border-stone-200 hover:bg-stone-50 text-stone-700'
          )}
        >
          {comparing ? '✓ Comparando' : 'Comparar com…'}
        </button>
      </div>

      {/* Secondary range (only shown when comparing) */}
      {comparing && (
        <div className="flex flex-wrap items-center gap-2 bg-stone-50 border border-stone-100 px-3 py-2 rounded-lg">
          <span className="text-xs font-medium text-stone-500">Comparar com:</span>
          <button
            onClick={() => applyComparePreset('prev')}
            className="text-xs px-2 py-1 rounded border border-stone-200 hover:bg-white text-stone-600"
          >
            Período anterior
          </button>
          <button
            onClick={() => applyComparePreset('yoy')}
            className="text-xs px-2 py-1 rounded border border-stone-200 hover:bg-white text-stone-600"
          >
            Mesmo período ano passado
          </button>
          <label className="flex items-center gap-1 text-xs text-stone-500">
            De
            <input
              type="month"
              value={compareFrom ?? ''}
              onChange={(e) => setParamsAndPush({ compareFrom: e.target.value })}
              className="border border-stone-200 rounded-md px-2 py-1 text-sm bg-white"
            />
          </label>
          <label className="flex items-center gap-1 text-xs text-stone-500">
            Até
            <input
              type="month"
              value={compareTo ?? ''}
              onChange={(e) => setParamsAndPush({ compareTo: e.target.value })}
              className="border border-stone-200 rounded-md px-2 py-1 text-sm bg-white"
            />
          </label>
        </div>
      )}
    </div>
  )
}
