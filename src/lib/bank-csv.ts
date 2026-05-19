// Parser de CSV de extratos bancários brasileiros.
// Suporta o formato exportado pelo Banco Inter (e similares: Nubank, C6, BTG).
//
// Formatos típicos:
//   "Data Lançamento";"Histórico";"Descrição";"Valor";"Saldo"
//   "01/04/2025";"Pix recebido";"João";"1.500,00";"6.500,00"
//   "02/04/2025";"Pagamento";"Energia";"-280,00";"6.220,00"
//
// Heurísticas:
//   - Pula linhas até encontrar a linha de cabeçalho (que contém "data" + "valor")
//   - Aceita delimitador ; ou ,
//   - Valor negativo = expense, positivo = income
//   - Categoria/método de pagamento default — usuário pode revisar

import type { Category, PaymentMethod } from '@/types'

export interface ParsedCsvTransaction {
  type: 'income' | 'expense'
  amount: number
  description: string
  date: string  // YYYY-MM-DD
  category: Category
  payment_method: PaymentMethod
  installment_total?: number | null
  installment_current?: number | null
  isCardPayment?: boolean // linha de pagamento da fatura (não é despesa real)
}

export interface CsvParseResult {
  transactions: ParsedCsvTransaction[]
  totalRows: number
  skippedRows: number
  warnings: string[]
  format: 'checking' | 'card_invoice' | 'unknown'
}

// ─── Detecção de delimitador ─────────────────────────────────────────────────
function detectDelimiter(sample: string): string {
  const counts = {
    ';': (sample.match(/;/g) ?? []).length,
    ',': (sample.match(/,/g) ?? []).length,
    '\t': (sample.match(/\t/g) ?? []).length,
  }
  return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]) || ';'
}

// ─── Parser tolerante de linha CSV (lida com aspas e escapes) ────────────────
function parseCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuote = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++ }
      else { inQuote = !inQuote }
    } else if (c === delimiter && !inQuote) {
      out.push(cur); cur = ''
    } else {
      cur += c
    }
  }
  out.push(cur)
  return out.map((s) => s.trim())
}

// ─── Normaliza cabeçalho (remove acentos, lowercase) ─────────────────────────
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// ─── Parse de valor monetário brasileiro: "1.500,00" → 1500.00 ───────────────
function parseAmount(raw: string): number {
  if (!raw) return NaN
  // Remove R$, espaços, e mantém só dígitos, ponto, vírgula, sinal
  const cleaned = raw.replace(/[^\d.,\-+]/g, '').trim()
  if (!cleaned) return NaN

  // Se tem vírgula como decimal: remove pontos de milhar
  if (cleaned.includes(',')) {
    return Number(cleaned.replace(/\./g, '').replace(',', '.'))
  }
  return Number(cleaned)
}

// ─── Parse de data brasileira: "01/04/2025" → "2025-04-01" ───────────────────
function parseDate(raw: string): string | null {
  if (!raw) return null
  const cleaned = raw.trim().replace(/\s.*$/, '')  // remove hora se houver
  // dd/mm/yyyy
  const br = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (br) {
    const [, d, m, y] = br
    const year = y.length === 2 ? `20${y}` : y
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  // yyyy-mm-dd (já no padrão)
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned
  return null
}

// ─── Categorização básica por palavras-chave na descrição ────────────────────
function inferCategory(desc: string, type: 'income' | 'expense'): Category {
  const d = norm(desc)
  if (type === 'income') {
    if (/\b(pix recebido|recebimento|deposito|salario|asaas|stripe)\b/.test(d)) return 'other'
    if (/(juros|rendimento)/.test(d)) return 'investment'
    return 'other'
  }
  // expense
  if (/\b(ifood|uber eats|rappi)\b/.test(d)) return 'food'
  if (/\b(uber|99|taxi|combustivel|posto)\b/.test(d)) return 'transport'
  if (/\b(aluguel|condominio|iptu)\b/.test(d)) return 'housing'
  if (/\b(farmacia|drogaria|hospital|consulta)\b/.test(d)) return 'health'
  if (/\b(escola|curso|udemy)\b/.test(d)) return 'education'
  if (/\b(netflix|spotify|amazon prime|disney)\b/.test(d)) return 'subscriptions'
  if (/\b(luz|energia|enel|cemig|copel|aes|sabesp|gas|claro|vivo|tim|oi|internet)\b/.test(d)) return 'utilities'
  if (/\b(imposto|darf|das mei|inss)\b/.test(d)) return 'taxes'
  return 'other'
}

function inferPaymentMethod(desc: string): PaymentMethod {
  const d = norm(desc)
  if (/pix/.test(d)) return 'pix'
  if (/\bboleto\b/.test(d)) return 'boleto'
  if (/\bted\b|\btransferencia\b/.test(d)) return 'transfer'
  if (/\bcredito\b|cartao de credito/.test(d)) return 'credit'
  if (/\bdebito\b/.test(d)) return 'debit'
  return 'other'
}

// Categorização extra pros itens típicos de fatura de cartão
function inferCardCategory(desc: string): Category {
  const d = norm(desc)
  if (/\b(facebk|facebook|google ads|ads )/.test(d)) return 'subscriptions'  // ad spend → assinaturas
  if (/\b(clickup|notion|figma|adobe|nuvemhost|reportei|kiwify|sendflow|paypal|manychat|ui8)/.test(d)) return 'subscriptions'
  if (/\b(claude|openai|chatgpt|anthropic)/.test(d)) return 'subscriptions'
  if (/\bapple\s?com\s?bill|applecombill/.test(d)) return 'subscriptions'
  if (/\biof/.test(d)) return 'taxes'
  if (/(encargos|juros|multa|rotativo)/.test(d)) return 'other'  // financeiros
  return 'other'
}

// Detecta "Parcela 3/6" → { current: 3, total: 6 }
function parseInstallment(raw: string): { current: number; total: number } | null {
  const m = raw.match(/parcela\s*(\d+)\s*\/\s*(\d+)/i)
  if (!m) return null
  return { current: Number(m[1]), total: Number(m[2]) }
}

// É linha de pagamento da fatura do cartão? (não é uma despesa real)
function isCardPaymentLine(desc: string): boolean {
  const d = norm(desc)
  return /pagamento on line|pagto debito autom|pgto fatura|estorno/.test(d)
}

// ─── Parser principal ────────────────────────────────────────────────────────
export function parseBankCsv(text: string): CsvParseResult {
  const warnings: string[] = []
  const transactions: ParsedCsvTransaction[] = []

  // Normaliza quebras de linha + remove BOM
  const normalized = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n')
  const lines = normalized.split('\n').filter((l) => l.trim().length > 0)

  if (lines.length === 0) {
    return { transactions: [], totalRows: 0, skippedRows: 0, warnings: ['Arquivo vazio'], format: 'unknown' }
  }

  // Tenta detectar o delimitador olhando as primeiras linhas
  const sample = lines.slice(0, 5).join('\n')
  const delimiter = detectDelimiter(sample)

  // Procura linha de cabeçalho: a primeira que contém "data" + "valor"
  let headerIdx = -1
  for (let i = 0; i < Math.min(lines.length, 20); i++) {
    const cells = parseCsvLine(lines[i], delimiter).map(norm)
    const joined = cells.join(' ')
    if (joined.includes('data') && joined.includes('valor')) {
      headerIdx = i
      break
    }
  }

  if (headerIdx === -1) {
    return { transactions: [], totalRows: lines.length, skippedRows: lines.length,
             warnings: ['Não encontrei o cabeçalho do extrato (linha com "Data" e "Valor"). Verifique o arquivo.'], format: 'unknown' }
  }

  // Mapeia índices de colunas
  const headers = parseCsvLine(lines[headerIdx], delimiter).map(norm)
  const idx = {
    date: headers.findIndex((h) => /\bdata\b/.test(h)),
    description: headers.findIndex((h) =>
      /lancamento|descric|descricao|historico|memo|detalhes/.test(h)
    ),
    history: headers.findIndex((h) => /historic/.test(h)),
    amount: headers.findIndex((h) => /\bvalor\b/.test(h)),
    balance: headers.findIndex((h) => /saldo/.test(h)),
    type: headers.findIndex((h) => /^tipo$|tipo lan|tipo de lan|d\/c|debito\/credito/.test(h)),
    cartao: headers.findIndex((h) => /^cartao$/.test(h)),
    categoria: headers.findIndex((h) => /^categoria$/.test(h)),
  }

  // Detecta formato: fatura de cartão tem coluna Cartao + Lançamento + sem Saldo
  const format: 'checking' | 'card_invoice' =
    idx.cartao !== -1 && idx.balance === -1 ? 'card_invoice' : 'checking'

  if (idx.date === -1 || idx.amount === -1) {
    return { transactions: [], totalRows: lines.length, skippedRows: lines.length,
             warnings: [`Colunas obrigatórias não encontradas. Cabeçalho lido: ${headers.join(', ')}`], format: 'unknown' }
  }

  // Processa linhas de dados
  let skipped = 0
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const row = parseCsvLine(lines[i], delimiter)
    if (row.length < 2) { skipped++; continue }

    const dateRaw = row[idx.date] ?? ''
    const date = parseDate(dateRaw)
    if (!date) { skipped++; continue }

    const amountRaw = row[idx.amount] ?? ''
    const rawAmount = parseAmount(amountRaw)
    if (isNaN(rawAmount) || rawAmount === 0) { skipped++; continue }

    // Tipo do lançamento (em faturas de cartão é "Compra à vista" / "Parcela X/Y")
    const tipoRaw = idx.type !== -1 ? (row[idx.type] ?? '').trim() : ''
    const installment = parseInstallment(tipoRaw)

    // Em fatura de cartão: TODA linha de compra é despesa (independente do sinal,
    // pois positivos só aparecem em estornos/pagamentos). Em conta corrente: sinal manda.
    let type: 'income' | 'expense'
    if (format === 'card_invoice') {
      type = rawAmount > 0 ? 'income' : 'expense'  // será reavaliado abaixo
    } else {
      type = rawAmount < 0 ? 'expense' : 'income'
      if (idx.type !== -1 && tipoRaw) {
        const t = norm(tipoRaw)
        if (t === 'd' || t.startsWith('debit') || t === 'saida') type = 'expense'
        else if (t === 'c' || t.startsWith('credit') || t === 'entrada') type = 'income'
      }
    }

    const amount = Math.abs(rawAmount)

    // Descrição: combina histórico + descrição se ambos existem
    const histPart = idx.history !== -1 ? (row[idx.history] ?? '').trim() : ''
    const descPart = idx.description !== -1 ? (row[idx.description] ?? '').trim() : ''
    let description = [histPart, descPart].filter(Boolean).join(' · ').trim()
    if (!description) description = histPart || descPart || 'Sem descrição'

    const isPayment = format === 'card_invoice' && isCardPaymentLine(description)

    const category = format === 'card_invoice'
      ? inferCardCategory(description)
      : inferCategory(description, type)

    transactions.push({
      type,
      amount,
      description,
      date,
      category,
      payment_method: format === 'card_invoice' ? 'credit' : inferPaymentMethod(description),
      installment_total: installment?.total ?? null,
      installment_current: installment?.current ?? null,
      isCardPayment: isPayment,
    })
  }

  if (transactions.length === 0) {
    warnings.push('Cabeçalho encontrado mas nenhuma linha de dados foi reconhecida.')
  }

  if (format === 'card_invoice') {
    warnings.push('Detectado: fatura de cartão de crédito. Linhas de pagamento da fatura vêm desmarcadas (não são despesas reais).')
  }

  return {
    transactions,
    totalRows: lines.length - headerIdx - 1,
    skippedRows: skipped,
    warnings,
    format,
  }
}
