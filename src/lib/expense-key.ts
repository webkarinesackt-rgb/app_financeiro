// Extrai o "lojista/destinatário" de uma descrição de despesa e ajuda a
// reaproveitar categorias já aplicadas a despesas do mesmo lojista.

// Extrai o "lojista/destinatário" de uma descrição de despesa.
// Padrões reconhecidos:
//   - "Pix enviado: Cp :NNNNN-Nome do Destinatário"  -> Nome
//   - "Pagamento efetuado: ..."                       -> tudo após ":"
//   - "FACEBK 347GXKDYT2 SAO PAULO BRA"               -> FACEBK
export function extractExpenseKey(description: string): string | null {
  const d = description.trim()

  // 0) Formato "Histórico · Nome" (extrato de conta importado, ex.:
  //    "Pix enviado · Andrei Da Silva"): o nome vem depois do " · ".
  const dotIdx = d.lastIndexOf(' · ')
  if (dotIdx !== -1) {
    const namePart = d.slice(dotIdx + 3).trim()
    if (namePart) return extractExpenseKey(namePart)
  }

  // 1) Pix com Cp :NNNN-Nome
  const pixMatch = d.match(/Cp\s*:[\d]+-(.+?)(\s+\d{6,}|$)/)
  if (pixMatch && pixMatch[1].trim().length >= 3) return pixMatch[1].trim()

  // 2) Pagamento efetuado: <descrição>
  const pagMatch = d.match(/^Pagamento\s+efetuado:\s*(.+)$/i)
  if (pagMatch && pagMatch[1].trim().length >= 3) {
    return extractExpenseKey(pagMatch[1].trim()) ?? pagMatch[1].trim().slice(0, 30)
  }

  // 3) Cartão: primeiros tokens significativos, parando em IDs longos
  //    (>= 6 dígitos/alfanumérico) ou códigos curtos de estado/país.
  const tokens = d.split(/\s+/).filter((w) => w.length >= 2)
  const meaningful: string[] = []
  for (const tok of tokens) {
    if (/^[a-zA-Z0-9]{6,}$/.test(tok) && /\d/.test(tok)) break
    if (meaningful.length >= 1 && /^[A-Z]{2,3}$/.test(tok)) break
    meaningful.push(tok)
    if (meaningful.length >= 3) break
  }
  const key = meaningful.join(' ').trim()
  return key.length >= 3 ? key : null
}

export interface CategorizedSample {
  description: string
  custom_category: string
  subcategory: string | null
}

export interface CategoryMatch {
  custom_category: string
  subcategory: string | null
}

// Monta um mapa "chave de lojista" -> categoria a partir de despesas já
// categorizadas. A primeira ocorrência de cada lojista vence.
export function buildMerchantCategoryMap(samples: CategorizedSample[]): Map<string, CategoryMatch> {
  const map = new Map<string, CategoryMatch>()
  for (const s of samples) {
    const key = extractExpenseKey(s.description)
    if (!key || map.has(key)) continue
    map.set(key, { custom_category: s.custom_category, subcategory: s.subcategory })
  }
  return map
}

// Devolve a categoria do lojista da descrição, se houver no mapa.
export function matchMerchantCategory(
  description: string,
  map: Map<string, CategoryMatch>,
): CategoryMatch | null {
  const key = extractExpenseKey(description)
  if (!key) return null
  return map.get(key) ?? null
}
