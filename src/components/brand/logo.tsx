// Logo wordmark da Fysi Finanças.
//
// Não usa lucide-react de propósito: o ícone é uma marca custom — um "F"
// editorial dentro de um anel sutil com remate em filete dourado. Resolve
// pequena em 24px e elegante em 80px+.

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
  className?: string
}

const SIZE_MAP = {
  sm: { box: 'h-8 w-8', mark: 26, text: 'text-base', sub: 'text-[10px]' },
  md: { box: 'h-9 w-9', mark: 28, text: 'text-lg', sub: 'text-[11px]' },
  lg: { box: 'h-12 w-12', mark: 36, text: 'text-2xl', sub: 'text-xs' },
} as const

export function Logo({ size = 'md', showText = true, className = '' }: LogoProps) {
  const s = SIZE_MAP[size]

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* Mark editorial: anel duplo + F serif */}
      <div className={`relative ${s.box} shrink-0`}>
        <svg
          viewBox="0 0 40 40"
          className="absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          {/* anel externo escuro */}
          <circle cx="20" cy="20" r="19" fill="oklch(0.18 0.02 165)" />
          {/* filete dourado interno */}
          <circle
            cx="20"
            cy="20"
            r="17.5"
            fill="none"
            stroke="oklch(0.78 0.10 75)"
            strokeWidth="0.5"
          />
          {/* "F" serif construído com paths sutis */}
          <text
            x="20"
            y="27.5"
            textAnchor="middle"
            fontFamily="var(--font-display), serif"
            fontSize="22"
            fontWeight="600"
            fontStyle="italic"
            fill="oklch(0.985 0.005 80)"
          >
            F
          </text>
        </svg>
      </div>

      {showText && (
        <div className="flex flex-col leading-none">
          <span className={`wordmark-fysi text-stone-800 ${s.text}`}>
            Fysi<span className="text-[color:var(--brand)]">.</span>
          </span>
          <span className={`eyebrow text-stone-500 mt-1 ${s.sub}`}>
            finanças
          </span>
        </div>
      )}
    </div>
  )
}
