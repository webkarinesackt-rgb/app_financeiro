'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { LayoutDashboard, ArrowLeftRight, BarChart3, Settings, TrendingUp, LogOut, FileUp } from 'lucide-react'
import { toast } from 'sonner'

const navItems = [
  { href: '/dashboard', label: 'Visão Geral', icon: LayoutDashboard },
  { href: '/transactions', label: 'Lançamentos', icon: ArrowLeftRight },
  { href: '/reports', label: 'Relatórios', icon: BarChart3 },
  { href: '/import', label: 'Importar', icon: FileUp },
  { href: '/settings/accounts', label: 'Config.', icon: Settings },
]

export function MobileNav() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    toast.success('Sessão encerrada')
    router.push('/login')
    router.refresh()
  }

  return (
    <>
      <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-100 md:hidden">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-emerald-600 p-1.5">
            <TrendingUp className="h-4 w-4 text-white" />
          </div>
          <span className="text-base font-bold text-slate-800">FinançasPRO</span>
        </div>
        <button onClick={handleLogout} className="text-slate-500 hover:text-red-600 transition-colors" title="Sair">
          <LogOut className="h-5 w-5" />
        </button>
      </header>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 flex md:hidden z-50">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href.split('/')[1] ? `/${item.href.split('/')[1]}` : item.href))
          return (
            <Link key={item.href} href={item.href} className="flex-1">
              <span className={cn(
                'flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors',
                active ? 'text-emerald-600' : 'text-slate-500'
              )}>
                <Icon className="h-5 w-5" />
                {item.label}
              </span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
