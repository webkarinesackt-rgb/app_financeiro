'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Send, Bot, User, CheckSquare, Square, TrendingUp, TrendingDown, CheckCheck, Trash2, Wallet, Info, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { createTransaction } from '@/lib/transactions'
import { getAccounts } from '@/lib/accounts'
import { getCreditCards } from '@/lib/credit-cards'
import { formatCurrency } from '@/lib/format'
import { parseBankCsv } from '@/lib/bank-csv'
import type { CreditCard } from '@/types'
import { CATEGORY_LABELS, PAYMENT_METHOD_LABELS } from '@/types'
import type { Account, Category, PaymentMethod } from '@/types'

// Heurística: descrições que sugerem repasse Asaas → conta bancária.
// Quando detectado, a linha é desmarcada por default (já vem via integração Asaas).
function isAsaasTransfer(description: string): boolean {
  const d = description.toLowerCase()
  return d.includes('asaas') || /\bted\b.*asaas\b/i.test(description)
}

interface ParsedTransaction {
  type: 'income' | 'expense'
  amount: number
  description: string
  date: string
  category: Category
  payment_method: PaymentMethod
  selected?: boolean
  installment_total?: number | null
  installment_current?: number | null
  isCardPayment?: boolean
}

interface ChatMessage {
  role: 'user' | 'assistant'
  text: string
  transactions?: ParsedTransaction[]
}

export default function ImportPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      text: 'Olá! Cole o texto do seu extrato bancário (copiado do app, PDF ou digitado) e eu identificarei automaticamente todas as transações.',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [cards, setCards] = useState<CreditCard[]>([])
  const [destination, setDestination] = useState<string>('')  // 'acc:<id>' ou 'card:<id>'
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    Promise.all([getAccounts(), getCreditCards()]).then(([accs, crds]) => {
      setAccounts(accs)
      setCards(crds)
      if (!destination) {
        if (accs.length > 0) setDestination(`acc:${accs[0].id}`)
        else if (crds.length > 0) setDestination(`card:${crds[0].id}`)
      }
    }).catch(() => {})
  }, [destination])

  const accountId = destination.startsWith('acc:') ? destination.slice(4) : ''
  const creditCardId = destination.startsWith('card:') ? destination.slice(5) : ''

  async function handleSend() {
    if (!input.trim() || loading) return
    const statement = input.trim()
    setInput('')

    const userMsg: ChatMessage = { role: 'user', text: statement }
    setMessages((prev) => [...prev, userMsg])
    setLoading(true)

    try {
      const res = await fetch('/api/parse-statement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statement }),
      })
      const json = await res.json()

      if (!res.ok || json.error) {
        setMessages((prev) => [...prev, { role: 'assistant', text: `Erro: ${json.error || 'Falha ao processar extrato'}` }])
        return
      }

      const txs: ParsedTransaction[] = (json.transactions ?? []).map((t: ParsedTransaction) => ({
        ...t,
        // Desmarca automaticamente linhas que parecem repasse do Asaas
        // (já foram contabilizadas pela integração Asaas — evitar duplicar).
        selected: !isAsaasTransfer(t.description),
      }))

      if (txs.length === 0) {
        setMessages((prev) => [...prev, { role: 'assistant', text: 'Não encontrei transações nesse texto. Tente colar diretamente o extrato com datas e valores.' }])
        return
      }

      setMessages((prev) => [...prev, {
        role: 'assistant',
        text: `Encontrei **${txs.length} transação(ões)**. Revise abaixo e clique em "Importar selecionadas" para salvar.`,
        transactions: txs,
      }])
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', text: 'Erro de conexão. Verifique sua conexão e tente novamente.' }])
    } finally {
      setLoading(false)
    }
  }

  async function handleCsvFile(file: File) {
    if (loading) return
    setLoading(true)
    try {
      const text = await file.text()
      const result = parseBankCsv(text)

      const userMsg: ChatMessage = { role: 'user', text: `📎 ${file.name} (${(file.size / 1024).toFixed(1)} KB)` }
      setMessages((prev) => [...prev, userMsg])

      if (result.transactions.length === 0) {
        const reason = result.warnings.length > 0 ? result.warnings.join(' ') : 'Nenhuma transação reconhecida.'
        setMessages((prev) => [...prev, { role: 'assistant', text: `Não consegui ler o CSV: ${reason}` }])
        return
      }

      const txs: ParsedTransaction[] = result.transactions.map((t) => ({
        ...t,
        // Desmarca: repasses Asaas + pagamentos de fatura (em CSV de cartão)
        selected: !isAsaasTransfer(t.description) && !t.isCardPayment,
      }))

      // Se é fatura de cartão e tem cartão cadastrado, troca o destino automaticamente
      let extraNote = ''
      if (result.format === 'card_invoice') {
        if (cards.length > 0 && !destination.startsWith('card:')) {
          setDestination(`card:${cards[0].id}`)
          extraNote = ` Destino trocado pro cartão "${cards[0].name}".`
        } else if (cards.length === 0) {
          extraNote = ' ⚠️ Nenhum cartão cadastrado — cadastra em /settings/cards antes de importar.'
        }
      }

      const skipNote = result.skippedRows > 0 ? ` (${result.skippedRows} linha(s) ignorada(s))` : ''
      const fmtLabel = result.format === 'card_invoice' ? '**fatura de cartão**' : '**extrato de conta**'
      setMessages((prev) => [...prev, {
        role: 'assistant',
        text: `Li ${fmtLabel}: ${txs.length} lançamento(s)${skipNote}.${extraNote} Pagamentos de fatura e repasses do Asaas vêm desmarcados. Revise e clique em "Importar selecionadas".`,
        transactions: txs,
      }])
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', text: 'Erro ao ler o arquivo CSV. Verifique se é um CSV válido do extrato.' }])
    } finally {
      setLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function toggleTransaction(msgIdx: number, txIdx: number) {
    setMessages((prev) => prev.map((msg, mi) => {
      if (mi !== msgIdx || !msg.transactions) return msg
      return {
        ...msg,
        transactions: msg.transactions.map((tx, ti) =>
          ti === txIdx ? { ...tx, selected: !tx.selected } : tx
        ),
      }
    }))
  }

  function toggleAll(msgIdx: number, value: boolean) {
    setMessages((prev) => prev.map((msg, mi) => {
      if (mi !== msgIdx || !msg.transactions) return msg
      return { ...msg, transactions: msg.transactions.map((tx) => ({ ...tx, selected: value })) }
    }))
  }

  function removeTransaction(msgIdx: number, txIdx: number) {
    setMessages((prev) => prev.map((msg, mi) => {
      if (mi !== msgIdx || !msg.transactions) return msg
      return { ...msg, transactions: msg.transactions.filter((_, ti) => ti !== txIdx) }
    }))
  }

  async function handleImport(msgIdx: number) {
    const msg = messages[msgIdx]
    if (!msg.transactions) return
    const selected = msg.transactions.filter((t) => t.selected)
    if (selected.length === 0) { toast.error('Selecione pelo menos uma transação'); return }

    setImporting(true)
    let ok = 0
    let fail = 0
    for (const tx of selected) {
      try {
        await createTransaction({
          type: tx.type,
          amount: tx.amount,
          description: tx.description,
          date: tx.date,
          category: tx.category,
          custom_category: null,
          payment_method: creditCardId ? 'credit' : tx.payment_method,
          account_id: accountId || null,
          credit_card_id: creditCardId || null,
          installment_total: tx.installment_total ?? null,
          notes: null,
          is_recurring: false,
          recurrence_interval: null,
        })
        ok++
      } catch {
        fail++
      }
    }
    setImporting(false)

    if (ok > 0) toast.success(`${ok} transação(ões) importada(s)!`)
    if (fail > 0) toast.error(`${fail} falha(s) ao importar`)

    setMessages((prev) => prev.map((m, mi) =>
      mi === msgIdx
        ? { ...m, transactions: m.transactions?.map((tx) => tx.selected ? { ...tx, selected: false } : tx) }
        : m
    ))
  }

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] md:h-[calc(100vh-3rem)] max-w-2xl mx-auto">
      <div className="mb-4 shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Importar Extrato ou Fatura</h1>
            <p className="text-slate-500 text-sm mt-0.5">CSV do banco (gratuito) ou texto colado (usa IA)</p>
          </div>
          {messages.length > 1 && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-8 shrink-0"
              onClick={() => setMessages([messages[0]])}
            >
              Limpar e começar novo
            </Button>
          )}
        </div>

        <div className="mt-3 flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="flex items-center gap-2 flex-1">
            <Wallet className="h-4 w-4 text-slate-400 shrink-0" />
            <span className="text-xs text-slate-500 shrink-0">Importar para:</span>
            {accounts.length === 0 && cards.length === 0 ? (
              <span className="text-xs text-amber-600">Nenhuma conta/cartão cadastrado — crie em Configurações</span>
            ) : (
              <Select value={destination} onValueChange={(v) => { if (v) setDestination(v) }}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {accounts.length > 0 && (
                    <>
                      <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase">Contas</div>
                      {accounts.map((a) => (
                        <SelectItem key={a.id} value={`acc:${a.id}`}>
                          {a.name}{a.kind === 'reserve' ? ' (reserva)' : ''}
                        </SelectItem>
                      ))}
                    </>
                  )}
                  {cards.length > 0 && (
                    <>
                      <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase">Cartões</div>
                      {cards.map((c) => (
                        <SelectItem key={c.id} value={`card:${c.id}`}>{c.name}</SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <div className="mt-2 flex items-start gap-1.5 text-[11px] text-slate-400">
          <Info className="h-3 w-3 mt-0.5 shrink-0" />
          <div className="space-y-0.5">
            <div>
              <strong>Extrato de conta</strong> (movimentações da Inter, Asaas, etc) → escolha uma <strong>conta</strong>.{' '}
              <strong>Fatura de cartão</strong> (compras do cartão) → escolha um <strong>cartão</strong>.
            </div>
            <div>
              Linhas com &ldquo;asaas&rdquo; (repasse) ou &ldquo;pagamento on line&rdquo; (pagto de fatura) vêm <strong>desmarcadas</strong> automaticamente.
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4 pr-1">
        {messages.map((msg, msgIdx) => (
          <div key={msgIdx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`rounded-full p-1.5 shrink-0 h-8 w-8 flex items-center justify-center ${
              msg.role === 'assistant' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
            }`}>
              {msg.role === 'assistant' ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
            </div>

            <div className={`flex flex-col gap-2 max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`rounded-2xl px-4 py-2.5 text-sm ${
                msg.role === 'user'
                  ? 'bg-emerald-600 text-white rounded-tr-sm'
                  : 'bg-white border border-slate-100 text-slate-700 shadow-sm rounded-tl-sm'
              }`}>
                <p className="whitespace-pre-wrap">{msg.text.replace(/\*\*/g, '')}</p>
              </div>

              {/* Transaction review table */}
              {msg.transactions && msg.transactions.length > 0 && (
                <Card className="w-full border border-slate-100 shadow-sm">
                  <CardContent className="p-0">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-slate-50">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            const allSelected = msg.transactions!.every((t) => t.selected)
                            toggleAll(msgIdx, !allSelected)
                          }}
                          className="text-slate-400 hover:text-slate-700 transition-colors"
                        >
                          {msg.transactions.every((t) => t.selected)
                            ? <CheckSquare className="h-4 w-4 text-emerald-600" />
                            : <Square className="h-4 w-4" />}
                        </button>
                        <span className="text-xs font-medium text-slate-500">
                          {msg.transactions.filter((t) => t.selected).length}/{msg.transactions.length} selecionadas
                        </span>
                      </div>
                      <Button
                        size="sm"
                        className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 gap-1"
                        disabled={importing || msg.transactions.every((t) => !t.selected)}
                        onClick={() => handleImport(msgIdx)}
                      >
                        {importing ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCheck className="h-3 w-3" />}
                        Importar selecionadas
                      </Button>
                    </div>

                    <div className="divide-y divide-slate-50 max-h-72 overflow-y-auto">
                      {msg.transactions.map((tx, txIdx) => (
                        <div key={txIdx} className={`flex items-center gap-2.5 px-3 py-2.5 ${!tx.selected ? 'opacity-40' : ''}`}>
                          <button onClick={() => toggleTransaction(msgIdx, txIdx)} className="shrink-0">
                            {tx.selected
                              ? <CheckSquare className="h-4 w-4 text-emerald-600" />
                              : <Square className="h-4 w-4 text-slate-300" />}
                          </button>

                          <div className={`rounded-full p-1 shrink-0 ${tx.type === 'income' ? 'bg-emerald-50' : 'bg-red-50'}`}>
                            {tx.type === 'income'
                              ? <TrendingUp className="h-3 w-3 text-emerald-600" />
                              : <TrendingDown className="h-3 w-3 text-red-500" />}
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-slate-700 truncate">{tx.description}</p>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <span className="text-xs text-slate-400">{tx.date}</span>
                              <Badge variant="outline" className="text-xs py-0 px-1.5 h-4">
                                {CATEGORY_LABELS[tx.category] ?? tx.category}
                              </Badge>
                              <span className="text-xs text-slate-400">
                                {PAYMENT_METHOD_LABELS[tx.payment_method] ?? tx.payment_method}
                              </span>
                            </div>
                          </div>

                          <span className={`text-sm font-bold shrink-0 ${tx.type === 'income' ? 'text-emerald-600' : 'text-red-500'}`}>
                            {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                          </span>

                          <button
                            onClick={() => removeTransaction(msgIdx, txIdx)}
                            className="shrink-0 text-slate-300 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="rounded-full p-1.5 h-8 w-8 flex items-center justify-center bg-emerald-100 text-emerald-700 shrink-0">
              <Bot className="h-4 w-4" />
            </div>
            <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-slate-300 animate-bounce [animation-delay:0ms]" />
                <span className="h-2 w-2 rounded-full bg-slate-300 animate-bounce [animation-delay:150ms]" />
                <span className="h-2 w-2 rounded-full bg-slate-300 animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-slate-100 pt-3">
        <div className="flex items-center gap-2 mb-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv,application/vnd.ms-excel"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleCsvFile(file)
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="gap-1.5 text-xs"
          >
            <Upload className="h-3.5 w-3.5" />
            Carregar CSV do banco
          </Button>
          <span className="text-xs text-slate-400">ou cole o texto abaixo (usa IA)</span>
        </div>

        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSend()
            }}
            placeholder="Cole aqui o texto do seu extrato bancário..."
            rows={3}
            className="flex-1 resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
          <Button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="bg-emerald-600 hover:bg-emerald-700 h-[78px] w-10 p-0 rounded-xl"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        <p className="text-xs text-slate-400 mt-1.5 text-center">CSV é nativo e gratuito · texto colado usa IA</p>
      </div>
    </div>
  )
}
