'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, ArrowLeftRight, BarChart3,
  Settings, TrendingUp, LogOut, Plus, CalendarCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import { useState } from 'react'
import { TransactionForm } from '@/components/transactions/transaction-form'

const navItems = [
  { href: '/dashboard',  label: 'Início',       icon: LayoutDashboard },
  { href: '/transactions', label: 'Lançamentos', icon: ArrowLeftRight },
  { href: '/reports',    label: 'Relatórios',    icon: BarChart3 },
  { href: '/cashflow',   label: 'Fechamento',    icon: CalendarCheck },
]

export function MobileNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    toast.success('Sessão encerrada')
    router.push('/login')
    router.refresh()
  }

  const userInitial = ''

  return (
    <>
      {/* Header */}
      <header className="md:hidden sticky top-0 z-40 flex items-center justify-between px-4 h-14 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="rounded-xl bg-emerald-600 p-1.5 shadow-sm shadow-emerald-200">
            <TrendingUp className="h-4 w-4 text-white" />
          </div>
          <span className="text-[15px] font-bold tracking-tight text-slate-800">FinançasPRO</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleLogout}
            className="flex items-center justify-center h-8 w-8 rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
            title="Sair"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Bottom Nav */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="mx-3 mb-2 rounded-2xl bg-slate-900/95 backdrop-blur-xl shadow-2xl shadow-slate-900/30 border border-white/5">
          <div className="flex items-center h-16 px-1">
            {/* First 2 items */}
            {navItems.slice(0, 2).map((item) => (
              <NavItem key={item.href} item={item} pathname={pathname} />
            ))}

            {/* Center FAB */}
            <div className="flex-shrink-0 px-2">
              <button
                onClick={() => setShowForm(true)}
                className="flex flex-col items-center justify-center h-12 w-12 rounded-2xl bg-emerald-500 shadow-lg shadow-emerald-500/40 active:scale-95 transition-transform"
              >
                <Plus className="h-6 w-6 text-white" strokeWidth={2.5} />
              </button>
            </div>

            {/* Last 2 items */}
            {navItems.slice(2).map((item) => (
              <NavItem key={item.href} item={item} pathname={pathname} />
            ))}
          </div>
        </div>
      </nav>

      {/* Config link — separate small pill above nav */}
      <Link
        href="/settings/accounts"
        className={cn(
          'md:hidden fixed bottom-[5.5rem] right-4 z-40 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium shadow-md transition-all',
          pathname.startsWith('/settings')
            ? 'bg-slate-900 text-white'
            : 'bg-white text-slate-500 border border-slate-200'
        )}
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 5.5rem)' }}
      >
        <Settings className="h-3.5 w-3.5" />
        Config
      </Link>

      <TransactionForm
        open={showForm}
        onClose={() => setShowForm(false)}
        onSuccess={() => { setShowForm(false); router.refresh() }}
      />
    </>
  )
}

function NavItem({ item, pathname }: { item: { href: string; label: string; icon: React.ElementType }; pathname: string }) {
  const Icon = item.icon
  const active =
    pathname === item.href ||
    (item.href !== '/dashboard' &&
      pathname.startsWith(`/${item.href.split('/')[1]}`))

  return (
    <Link href={item.href} className="flex-1">
      <span className="flex flex-col items-center gap-1 py-1.5">
        <span className={cn(
          'flex items-center justify-center h-8 w-8 rounded-xl transition-all duration-200',
          active ? 'bg-white/15' : ''
        )}>
          <Icon className={cn(
            'h-5 w-5 transition-colors duration-200',
            active ? 'text-white' : 'text-slate-500'
          )} />
        </span>
        <span className={cn(
          'text-[10px] font-medium leading-none transition-colors duration-200',
          active ? 'text-white' : 'text-slate-500'
        )}>
          {item.label}
        </span>
      </span>
    </Link>
  )
}
