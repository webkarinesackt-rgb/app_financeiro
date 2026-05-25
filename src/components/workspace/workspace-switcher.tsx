'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, User, Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWorkspace } from '@/hooks/use-workspace'
import { setWorkspaceAction } from '@/lib/workspace-actions'
import type { WorkspaceType } from '@/types'

const WORKSPACES: { value: WorkspaceType; label: string; Icon: typeof Building2; color: string }[] = [
  { value: 'business', label: 'Fysi', Icon: Building2, color: 'text-emerald-600' },
  { value: 'personal', label: 'Pessoal', Icon: User, color: 'text-indigo-600' },
]

export function WorkspaceSwitcher() {
  const current = useWorkspace()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const active = WORKSPACES.find((w) => w.value === current) ?? WORKSPACES[0]
  const ActiveIcon = active.Icon

  function pick(value: WorkspaceType) {
    setOpen(false)
    if (value === current) return
    startTransition(async () => {
      await setWorkspaceAction(value)
      router.refresh()
    })
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={isPending}
        className={cn(
          'flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[13px] font-medium border border-stone-200/60 bg-white hover:bg-stone-50 transition-colors',
          isPending && 'opacity-50',
        )}
      >
        <ActiveIcon className={cn('h-3.5 w-3.5', active.color)} />
        <span className="text-stone-700">{active.label}</span>
        <ChevronDown className="h-3 w-3 text-stone-400" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-20 w-44 bg-white border border-stone-200 rounded-lg shadow-lg py-1">
            {WORKSPACES.map((w) => {
              const Icon = w.Icon
              return (
                <button
                  key={w.value}
                  onClick={() => pick(w.value)}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-[13px] text-stone-700 hover:bg-stone-50 text-left"
                >
                  <Icon className={cn('h-3.5 w-3.5', w.color)} />
                  <span className="flex-1">{w.label}</span>
                  {w.value === current && <Check className="h-3.5 w-3.5 text-stone-400" />}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
