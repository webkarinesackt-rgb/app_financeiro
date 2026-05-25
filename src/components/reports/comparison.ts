export type Range = { from: string; to: string }
export type Delta = { abs: number; pct: number | null }

export function computeDelta(current: number, previous: number): Delta {
  const abs = current - previous
  if (previous === 0) return { abs, pct: null }
  return { abs, pct: (abs / previous) * 100 }
}

function parseYM(ym: string): { y: number; m: number } {
  const [y, m] = ym.split('-').map(Number)
  return { y, m }
}

function fmtYM(y: number, m: number): string {
  while (m <= 0) { m += 12; y-- }
  while (m > 12) { m -= 12; y++ }
  return `${y}-${String(m).padStart(2, '0')}`
}

export function shiftRange(range: Range, monthsBack: number): Range {
  const f = parseYM(range.from)
  const t = parseYM(range.to)
  return {
    from: fmtYM(f.y, f.m - monthsBack),
    to: fmtYM(t.y, t.m - monthsBack),
  }
}

export function sameSizePrevRange(range: Range): Range {
  const f = parseYM(range.from)
  const t = parseYM(range.to)
  const sizeMonths = (t.y - f.y) * 12 + (t.m - f.m) + 1
  // The previous period ends immediately before the current start
  const prevToY = f.y, prevToM = f.m - 1
  const prevFromY = f.y, prevFromM = f.m - sizeMonths
  return {
    from: fmtYM(prevFromY, prevFromM),
    to: fmtYM(prevToY, prevToM),
  }
}
