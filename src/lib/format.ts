// Parses Brazilian number format: "1.000,50" → 1000.50, "1000,50" → 1000.50, "1000.50" → 1000.50
export function parseBRLAmount(raw: string): number {
  const s = raw.trim()
  if (!s) return NaN

  // Detect separator style by checking what comes last: period or comma
  const lastDot = s.lastIndexOf('.')
  const lastComma = s.lastIndexOf(',')

  let normalized: string
  if (lastComma > lastDot) {
    // Comma is decimal separator (pt-BR style): "1.000,50" or "1000,50"
    normalized = s.replace(/\./g, '').replace(',', '.')
  } else if (lastDot > lastComma) {
    // Dot is decimal separator (en-US style): "1000.50"
    normalized = s.replace(/,/g, '')
  } else {
    // No separator at all: "1000"
    normalized = s.replace(/[.,]/g, '')
  }

  return parseFloat(normalized)
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR').format(new Date(year, month - 1, day))
}

export function getMonthName(month: number): string {
  return new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(
    new Date(2024, month - 1, 1)
  )
}
