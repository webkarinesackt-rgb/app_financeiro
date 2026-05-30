'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { LayoutDashboard, ArrowLeftRight, BarChart3, Settings, LogOut, ChevronDown, CalendarCheck, Handshake, PiggyBank, LineChart, AlertCircle, Sparkles, Activity, Upload, Eye, EyeOff } from 'lucide-react'
import { WorkspaceSwitcher } from '@/components/workspace/workspace-switcher'
import { useWorkspace } from '@/hooks/use-workspace'
import { usePrivacy } from '@/hooks/use-privacy'
import type { WorkspaceType } from '@/types'
import { toast } from 'sonner'
import { useState } from 'react'

const navItems: { href: string; label: string; icon: typeof LayoutDashboard; workspaces: WorkspaceType[] }[] = [
  { href: '/panorama',     label: 'Panorama',       icon: Activity,        workspaces: ['business'] },
  { href: '/dashboard',    label: 'Visão Geral',    icon: LayoutDashboard, workspaces: ['business', 'personal'] },
  { href: '/transactions', label: 'Lançamentos',    icon: ArrowLeftRight,  workspaces: ['business', 'personal'] },
  { href: '/a-cobrar',     label: 'A Cobrar',       icon: AlertCircle,     workspaces: ['business'] },
  { href: '/closings',     label: 'Fechamentos',    icon: Handshake,       workspaces: ['business'] },
  { href: '/reservas',     label: 'Reservas',       icon: PiggyBank,       workspaces: ['business'] },
  { href: '/previsao',     label: 'Previsão',       icon: LineChart,       workspaces: ['business'] },
  { href: '/reports',      label: 'Relatórios',     icon: BarChart3,       workspaces: ['business', 'personal'] },
  { href: '/cashflow',     label: 'Fluxo de Caixa', icon: CalendarCheck,   workspaces: ['business'] },
  { href: '/categorizar',  label: 'Categorizar',    icon: Sparkles,        workspaces: ['business', 'personal'] },
  { href: '/import',       label: 'Importar',       icon: Upload,          workspaces: ['business', 'personal'] },
]

const settingsItems: { href: string; label: string; workspaces: WorkspaceType[] }[] = [
  { href: '/settings/accounts',     label: 'Contas',              workspaces: ['business', 'personal'] },
  { href: '/settings/cards',        label: 'Cartões de Crédito',  workspaces: ['business', 'personal'] },
  { href: '/settings/categories',   label: 'Categorias',          workspaces: ['business', 'personal'] },
  { href: '/settings/integrations', label: 'Integrações (Asaas)', workspaces: ['business'] },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const workspace = useWorkspace()
  const { hidden, toggle } = usePrivacy()
  const [settingsOpen, setSettingsOpen] = useState(pathname.startsWith('/settings'))

  const visibleNav = navItems.filter((i) => i.workspaces.includes(workspace))
  const visibleSettings = settingsItems.filter((i) => i.workspaces.includes(workspace))

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    toast.success('Sessão encerrada')
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="sidebar-refined flex flex-col w-64 min-h-screen px-3 py-6 gap-1 shrink-0">
      <div className="px-2 mb-3 flex items-center gap-2">
        <div className="flex-1 min-w-0"><WorkspaceSwitcher /></div>
        <button
          onClick={toggle}
          title={hidden ? 'Mostrar valores' : 'Ocultar valores'}
          aria-label={hidden ? 'Mostrar valores' : 'Ocultar valores'}
          className="shrink-0 h-8 w-8 inline-flex items-center justify-center rounded-md text-stone-300 hover:text-stone-100 hover:bg-white/10 transition-colors"
        >
          {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      <div className="mb-4 mx-2 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

      <nav className="flex flex-col gap-0.5 flex-1">
        {visibleNav.map((item) => {
          const Icon = item.icon
          const active = pathname === item.href
          return (
            <Link key={item.href} href={item.href}>
              <span className={cn(
                'group relative flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all',
                active
                  ? 'nav-item-active'
                  : 'nav-item-idle'
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
              ? 'nav-item-active'
              : 'nav-item-idle'
          )}
        >
          <Settings className={cn('h-[15px] w-[15px]', pathname.startsWith('/settings') ? 'text-[color:var(--accent-gold)]' : '')} />
          <span className="flex-1 text-left">Configurações</span>
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', settingsOpen && 'rotate-180')} />
        </button>

        {settingsOpen && (
          <div className="ml-7 mt-1 flex flex-col gap-0.5 border-l border-white/15 pl-3">
            {visibleSettings.map((item) => (
              <Link key={item.href} href={item.href}>
                <span className={cn(
                  'flex items-center px-2 py-1.5 rounded-md text-xs transition-colors',
                  pathname === item.href
                    ? 'text-stone-100 font-semibold'
                    : 'text-stone-400 hover:text-stone-100'
                )}>
                  {pathname === item.href && (
                    <span className="mr-2 h-1 w-1 rounded-full bg-[color:var(--accent-gold)] shrink-0" />
                  )}
                  {item.label}
                </span>
              </Link>
            ))}
          </div>
        )}
      </nav>

      <div className="my-2 h-px bg-white/10" />
      <Button
        variant="ghost"
        className="justify-start gap-3 text-stone-400 hover:text-red-300 hover:bg-white/5 text-sm"
        onClick={handleLogout}
      >
        <LogOut className="h-4 w-4" />
        Sair
      </Button>
    </aside>
  )
}
