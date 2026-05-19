interface Props {
  icon: React.ReactNode
  title: string
  accent?: 'emerald' | 'amber' | 'slate' | 'blue'
}

const ACCENT: Record<NonNullable<Props['accent']>, string> = {
  emerald: 'text-emerald-700',
  amber: 'text-amber-700',
  slate: 'text-slate-600',
  blue: 'text-blue-700',
}

export function SectionHeader({ icon, title, accent = 'slate' }: Props) {
  return (
    <h2 className={`text-xs font-bold uppercase tracking-wider mb-2 px-1 flex items-center gap-1.5 ${ACCENT[accent]}`}>
      <span className="[&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>
      {title}
    </h2>
  )
}
