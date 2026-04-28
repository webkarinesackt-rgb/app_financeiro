'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getMonthName } from '@/lib/format'

interface MonthSelectorProps {
  month: number
  year: number
}

export function MonthSelector({ month, year }: MonthSelectorProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function navigate(deltaMonth: number) {
    let newMonth = month + deltaMonth
    let newYear = year

    if (newMonth > 12) { newMonth = 1; newYear++ }
    if (newMonth < 1) { newMonth = 12; newYear-- }

    const params = new URLSearchParams(searchParams.toString())
    params.set('month', String(newMonth))
    params.set('year', String(newYear))
    router.push(`?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="text-sm font-semibold text-slate-700 min-w-[120px] text-center capitalize">
        {getMonthName(month)} {year}
      </span>
      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigate(1)}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}
