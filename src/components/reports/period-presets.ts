export type PeriodPreset =
  | 'this_month' | 'last_month'
  | 'last_3_months' | 'last_6_months' | 'last_12_months'
  | 'this_year' | 'last_year'
  | 'custom'

export const PERIOD_PRESET_LABELS: Record<PeriodPreset, string> = {
  this_month: 'Este mês',
  last_month: 'Mês passado',
  last_3_months: 'Últimos 3 meses',
  last_6_months: 'Últimos 6 meses',
  last_12_months: 'Últimos 12 meses',
  this_year: 'Este ano',
  last_year: 'Ano passado',
  custom: 'Personalizado',
}

export function presetToRange(preset: PeriodPreset, now: Date = new Date()): { from: string; to: string } {
  const y = now.getFullYear()
  const m = now.getMonth() + 1
  const fmt = (yy: number, mm: number) => `${yy}-${String(mm).padStart(2, '0')}`
  const shift = (months: number): { y: number; m: number } => {
    let nm = m - months
    let ny = y
    while (nm <= 0) { nm += 12; ny-- }
    return { y: ny, m: nm }
  }

  switch (preset) {
    case 'this_month':    return { from: fmt(y, m), to: fmt(y, m) }
    case 'last_month':    { const s = shift(1); return { from: fmt(s.y, s.m), to: fmt(s.y, s.m) } }
    case 'last_3_months': { const s = shift(2); return { from: fmt(s.y, s.m), to: fmt(y, m) } }
    case 'last_6_months': { const s = shift(5); return { from: fmt(s.y, s.m), to: fmt(y, m) } }
    case 'last_12_months':{ const s = shift(11); return { from: fmt(s.y, s.m), to: fmt(y, m) } }
    case 'this_year':     return { from: fmt(y, 1),    to: fmt(y, 12) }
    case 'last_year':     return { from: fmt(y - 1, 1), to: fmt(y - 1, 12) }
    case 'custom':        return { from: fmt(y, m), to: fmt(y, m) }
  }
}
