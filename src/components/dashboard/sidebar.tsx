'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { LayoutDashboard, ArrowLeftRight, BarChart3, Settings, TrendingUp, LogOut, ChevronDown, CalendarCheck } from 'lucide-react'
import { toast } from 'sonner'
import { useState } from 'react'

const navItems = [
  { href: '/dashboard', label: 'Visão Geral', icon: LayoutDashboard },
  { href: '/transactions', label: 'Lançamentos', icon: ArrowLeftRight },
  { href: '/reports', label: 'Relatórios', icon: BarChart3 },
  { href: '/cashflow', label: 'Fechamento', icon: CalendarCheck },
]

const settingsItems = [
  { href: '/settings/accounts', label: 'Contas' },
  { href: '/settings/cards', label: 'Cartões de Crédito' },
  { href: '/settings/categories', label: 'Categorias' },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [settingsOpen, setSettingsOpen] = useState(pathname.startsWith('/settings'))

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    toast.success('Sessão encerrada')
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="flex flex-col w-60 min-h-screen bg-white border-r border-slate-100 px-3 py-5 gap-1 shrink-0">
      <div className="flex items-center gap-2 px-2 mb-5">
        <div className="rounded-xl bg-emerald-600 p-1.5">
          <TrendingUp className="h-5 w-5 text-white" />
        </div>
        <span className="text-base font-bold text-slate-800">FinançasPRO</span>
      </div>

      <nav className="flex flex-col gap-0.5 flex-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = pathname === item.href
          return (
            <Link key={item.href} href={item.href}>
              <span className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                active ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              )}>
                <Icon className="h-4 w-4" />
                {item.label}
              </span>
            </Link>
          )
        })}

        <button
          onClick={() => setSettingsOpen(!settingsOpen)}
          className={cn(
            'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors w-full',
            pathname.startsWith('/settings')
              ? 'bg-emerald-50 text-emerald-700'
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
          )}
        >
          <Settings className="h-4 w-4" />
          <span className="flex-1 text-left">Configurações</span>
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', settingsOpen && 'rotate-180')} />
        </button>

        {settingsOpen && (
          <div className="ml-7 flex flex-col gap-0.5">
            {settingsItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <span className={cn(
                  'flex items-center px-3 py-1.5 rounded-lg text-sm transition-colors',
                  pathname === item.href ? 'text-emerald-700 font-semibold' : 'text-slate-500 hover:text-slate-800'
                )}>
                  {pathname === item.href && <span className="mr-2 h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />}
                  {item.label}
                </span>
              </Link>
            ))}
          </div>
        )}
      </nav>

      <Separator className="my-2" />
      <Button
        variant="ghost"
        className="justify-start gap-3 text-slate-500 hover:text-red-600 hover:bg-red-50 text-sm"
        onClick={handleLogout}
      >
        <LogOut className="h-4 w-4" />
        Sair
      </Button>
    </aside>
  )
}
