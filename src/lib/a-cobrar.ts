// Detecção de cobranças pendentes: cruza recurring_clients e projects (closings)
// com transactions reais pra identificar quem fechou mas não pagou.

import { createClient } from '@/lib/supabase/client'
import type { RecurringClient, Closing, Transaction } from '@/types'
import { getClientWorkspace, filterByWorkspace } from '@/lib/workspace'

export interface PendingRecurring {
  client: RecurringClient
  lastPaymentDate: string | null
  daysSinceLastPayment: number | null
  status: 'never' | 'overdue' | 'recent'
}

export interface PendingClosing {
  project: Closing
  daysSinceClose: number
  matchedPayment: boolean
  matchedDescription: string | null
}

export interface ACobrarData {
  recurring: PendingRecurring[]      // recorrentes sem pagamento esperado
  closings: PendingClosing[]         // fechamentos sem pagamento detectado
  totalPending: number               // soma do que está pendente
}

// ─── Normalização de nome pra match fuzzy ───────────────────────────────────
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Retorna a transação mais recente que parece ser pagamento do cliente, OU null.
function findMatchingPayment(
  clientName: string,
  transactions: Transaction[],
): Transaction | null {
  const norm = normalize(clientName)
  const parts = norm.split(' ').filter((w) => w.length >= 3)
  if (parts.length === 0) return null

  // Pra matching ser confiável: pelo menos 2 palavras significativas batendo,
  // OU 1 palavra única e específica (sobrenome com 5+ letras).
  for (const tx of transactions) {
    const desc = normalize(tx.description)
    let matches = 0
    for (const part of parts) {
      if (desc.includes(part)) matches++
    }
    if (matches >= 2) return tx
    // Fallback: nome único com sobrenome distinto
    if (parts.length === 1 && parts[0].length >= 5 && desc.includes(parts[0])) {
      return tx
    }
  }
  return null
}

function daysBetween(iso: string): number {
  const past = new Date(iso + 'T00:00:00')
  const now = new Date()
  return Math.floor((now.getTime() - past.getTime()) / (1000 * 60 * 60 * 24))
}

export async function getACobrarData(): Promise<ACobrarData> {
  const supabase = createClient()
  const workspace = getClientWorkspace()

  // Janela: pagamentos dos últimos 60 dias (cobre recorrentes mensais + alguns recentes)
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 60)
  const cutoffStr = cutoff.toISOString().slice(0, 10)

  const [
    { data: clients },
    { data: projects },
    { data: transactions },
  ] = await Promise.all([
    supabase.from('recurring_clients').select('*').eq('active', true),
    supabase.from('projects').select('*').not('status', 'in', '(cancelled,paid)'),
    supabase.from('transactions').select('id, description, amount, date, type, workspace')
      .eq('type', 'income')
      .gte('date', cutoffStr),
  ])

  const txs = filterByWorkspace(transactions, workspace) as unknown as Transaction[]
  const clientList = (clients ?? []) as RecurringClient[]
  const projectList = (projects ?? []) as Closing[]

  // ─── Recorrentes pendentes ─────────────────────────────────────────────
  const recurring: PendingRecurring[] = []
  for (const c of clientList) {
    const match = findMatchingPayment(c.name, txs)
    if (match) {
      const days = daysBetween(match.date)
      // Se último pagamento foi há mais de 35 dias, considera atrasado (recorrente mensal)
      if (days > 35) {
        recurring.push({
          client: c,
          lastPaymentDate: match.date,
          daysSinceLastPayment: days,
          status: 'overdue',
        })
      }
      // Caso contrário, OK — não entra na lista de pendentes
    } else {
      recurring.push({
        client: c,
        lastPaymentDate: null,
        daysSinceLastPayment: null,
        status: 'never',
      })
    }
  }

  // ─── Fechamentos sem pagamento detectado ──────────────────────────────
  const closings: PendingClosing[] = []
  for (const p of projectList) {
    if (!p.client_name) continue
    const match = findMatchingPayment(p.client_name, txs)
    closings.push({
      project: p,
      daysSinceClose: daysBetween(p.start_date),
      matchedPayment: !!match,
      matchedDescription: match?.description ?? null,
    })
  }

  // Ordena: nunca pagou primeiro, depois mais atrasados
  recurring.sort((a, b) => {
    if (a.status === 'never' && b.status !== 'never') return -1
    if (b.status === 'never' && a.status !== 'never') return 1
    return (b.daysSinceLastPayment ?? 0) - (a.daysSinceLastPayment ?? 0)
  })

  closings.sort((a, b) => {
    if (!a.matchedPayment && b.matchedPayment) return -1
    if (!b.matchedPayment && a.matchedPayment) return 1
    return b.daysSinceClose - a.daysSinceClose
  })

  const totalPending =
    recurring.reduce((s, r) => s + Number(r.client.amount), 0) +
    closings.filter((c) => !c.matchedPayment).reduce((s, c) => s + Number(c.project.total_value), 0)

  return { recurring, closings, totalPending }
}

// Formata link de WhatsApp pra abrir conversa
export function whatsappLink(phone: string | null | undefined): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 10) return null
  const withCountry = digits.length === 11 || digits.length === 10 ? `55${digits}` : digits
  return `https://wa.me/${withCountry}`
}
