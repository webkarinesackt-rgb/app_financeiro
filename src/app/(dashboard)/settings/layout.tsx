import Link from 'next/link'

const settingsNav = [
  { href: '/settings/accounts', label: 'Contas' },
  { href: '/settings/cards', label: 'Cartões de Crédito' },
  { href: '/settings/categories', label: 'Categorias' },
]

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-6 max-w-4xl">
      {/* Sidebar */}
      <aside className="hidden sm:flex flex-col w-44 shrink-0 gap-0.5">
        {settingsNav.map((item) => (
          <Link key={item.href} href={item.href}
            className="px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors">
            {item.label}
          </Link>
        ))}
      </aside>

      {/* Mobile nav */}
      <div className="flex sm:hidden gap-1 flex-wrap mb-4 w-full">
        {settingsNav.map((item) => (
          <Link key={item.href} href={item.href}
            className="px-3 py-1.5 rounded-full text-xs bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 transition-colors">
            {item.label}
          </Link>
        ))}
      </div>

      <main className="flex-1 min-w-0">{children}</main>
    </div>
  )
}
