'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { LayoutDashboard, ArrowLeftRight, BarChart3, Settings, LogOut, ChevronDown, CalendarCheck, Handshake, PiggyBank, LineChart, AlertCircle, Sparkles, Activity } from 'lucide-react'
import { Logo } from '@/components/brand/logo'
import { toast } from 'sonner'
import { useState } from 'react'

const navItems = [
  { href: '/panorama', label: 'Panorama', icon: Activity },
  { href: '/dashboard', label: 'Visão Geral', icon: LayoutDashboard },
  { href: '/transactions', label: 'Lançamentos', icon: ArrowLeftRight },
  { href: '/a-cobrar', label: 'A Cobrar', icon: AlertCircle },
  { href: '/closings', label: 'Fechamentos', icon: Handshake },
  { href: '/reservas', label: 'Reservas', icon: PiggyBank },
  { href: '/previsao', label: 'Previsão', icon: LineChart },
  { href: '/reports', label: 'Relatórios', icon: BarChart3 },
  { href: '/cashflow', label: 'Fluxo de Caixa', icon: CalendarCheck },
  { href: '/categorizar', label: 'Categorizar', icon: Sparkles },
]

const settingsItems = [
  { href: '/settings/accounts', label: 'Contas' },
  { href: '/settings/cards', label: 'Cartões de Crédito' },
  { href: '/settings/categories', label: 'Categorias' },
  { href: '/settings/integrations', label: 'Integrações (Asaas)' },
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
    <aside className="flex flex-col w-64 min-h-screen bg-white/80 backdrop-blur-sm border-r border-stone-200/60 px-3 py-6 gap-1 shrink-0">
      <div className="px-2 mb-7">
        <Logo size="md" />
      </div>
      <div className="hairline mb-4 mx-2" />

      <nav className="flex flex-col gap-0.5 flex-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = pathname === item.href
          return (
            <Link key={item.href} href={item.href}>
              <span className={cn(
                'group relative flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all',
                active
                  ? 'bg-stone-900 text-white shadow-sm shadow-stone-900/10'
                  : 'text-stone-600 hover:bg-stone-100/80 hover:text-stone-900'
              )}>
                <Icon className={cn('h-[15px] w-[15px] transition-colors', active ? 'text-[color:var(--accent-gold)]' : '')} />
                {item.label}
                {active && (
                  <span className="ml-auto h-1 w-1 rounded-full bg-[color:var(--accent-gold)]" />
                )}
              </span>
            </Link>
          )
        })}

        <button
          onClick={() => setSettingsOpen(!settingsOpen)}
          className={cn(
            'flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all w-full',
            pathname.startsWith('/settings')
              ? 'bg-stone-900 text-white shadow-sm shadow-stone-900/10'
              : 'text-stone-600 hover:bg-stone-100/80 hover:text-stone-900'
          )}
        >
          <Settings className={cn('h-[15px] w-[15px]', pathname.startsWith('/settings') ? 'text-[color:var(--accent-gold)]' : '')} />
          <span className="flex-1 text-left">Configurações</span>
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', settingsOpen && 'rotate-180')} />
        </button>

        {settingsOpen && (
          <div className="ml-7 mt-1 flex flex-col gap-0.5 border-l border-stone-200 pl-3">
            {settingsItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <span className={cn(
                  'flex items-center px-2 py-1.5 rounded-md text-xs transition-colors',
                  pathname === item.href
                    ? 'text-stone-900 font-semibold'
                    : 'text-stone-500 hover:text-stone-800'
                )}>
                  {pathname === item.href && (
                    <span className="mr-2 h-1 w-1 rounded-full bg-[color:var(--brand)] shrink-0" />
                  )}
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
