'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, CheckCircle2, ChevronRight, Undo2, X, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import {
  getUncategorizedLPClients, categorizeClientByName,
  getUncategorizedExpenses, categorizeExpenseByPattern,
  type UncategorizedClient,
} from '@/lib/bulk-categorize'
import { formatCurrency } from '@/lib/format'

type Mode = 'income' | 'expense'

interface HistoryEntry {
  client: UncategorizedClient
  customCategory: string
  subcategory: string | null
  updatedCount: number
}

interface ActionDef {
  label: string
  shortcut: string
  // Pra income: customCategory='Receita LP/Site' + subcategory
  // Pra expense: category (built-in) OU customCategory='Nome'
  customCategory: string
  subcategory: string | null
  color: string
  emoji: string
}

const INCOME_ACTIONS: ActionDef[] = [
  { label: 'Landing page com copy', shortcut: '1', customCategory: 'Receita Landing Page / Site', subcategory: 'Landing page com copy', color: 'bg-emerald-600 hover:bg-emerald-700', emoji: '🎯' },
  { label: 'Landing page sem copy', shortcut: '2', customCategory: 'Receita Landing Page / Site', subcategory: 'Landing page sem copy', color: 'bg-blue-600 hover:bg-blue-700', emoji: '📄' },
  { label: 'Site institucional', shortcut: '3', customCategory: 'Receita Landing Page / Site', subcategory: 'Site institucional', color: 'bg-purple-600 hover:bg-purple-700', emoji: '🏢' },
  { label: 'Programação', shortcut: '4', customCategory: 'Receita Landing Page / Site', subcategory: 'Programação', color: 'bg-indigo-600 hover:bg-indigo-700', emoji: '💻' },
  { label: 'Alterações', shortcut: '5', customCategory: 'Receita Landing Page / Site', subcategory: 'Alterações', color: 'bg-amber-600 hover:bg-amber-700', emoji: '✏️' },
  { label: 'Anúncios / Tráfego pago', shortcut: '6', customCategory: 'Receita Landing Page / Site', subcategory: 'Anúncios', color: 'bg-rose-600 hover:bg-rose-700', emoji: '📢' },
  { label: 'Receita curso (sai do LP)', shortcut: '7', customCategory: 'Receita curso', subcategory: null, color: 'bg-pink-600 hover:bg-pink-700', emoji: '🎓' },
  { label: 'Cliente recorrente / mensal', shortcut: '8', customCategory: 'Receita recorrente', subcategory: null, color: 'bg-teal-600 hover:bg-teal-700', emoji: '🔁' },
]

const EXPENSE_ACTIONS: ActionDef[] = [
  { label: 'Marketing / Anúncios', shortcut: '1', customCategory: 'Marketing', subcategory: null, color: 'bg-rose-600 hover:bg-rose-700', emoji: '📢' },
  { label: 'Ferramentas / Software', shortcut: '2', customCategory: 'Ferramentas', subcategory: null, color: 'bg-blue-600 hover:bg-blue-700', emoji: '🛠️' },
  { label: 'Infraestrutura', shortcut: '3', customCategory: 'Infraestrutura', subcategory: null, color: 'bg-purple-600 hover:bg-purple-700', emoji: '🖥️' },
  { label: 'Equipe', shortcut: '4', customCategory: 'Equipe', subcategory: null, color: 'bg-emerald-600 hover:bg-emerald-700', emoji: '👥' },
  { label: 'Impostos', shortcut: '5', customCategory: 'Impostos', subcategory: null, color: 'bg-amber-600 hover:bg-amber-700', emoji: '🧾' },
  { label: 'Encargos / Juros', shortcut: '6', customCategory: 'Encargos financeiros', subcategory: null, color: 'bg-orange-600 hover:bg-orange-700', emoji: '💸' },
  { label: 'Alimentação', shortcut: '7', customCategory: 'Alimentação', subcategory: null, color: 'bg-yellow-600 hover:bg-yellow-700', emoji: '🍽️' },
  { label: 'Outros', shortcut: '8', customCategory: 'Outros', subcategory: null, color: 'bg-slate-600 hover:bg-slate-700', emoji: '📦' },
]

const CURRENT_YEAR_START = `${new Date().getFullYear()}-01-01`

export default function CategorizarPage() {
  const [clients, setClients] = useState<UncategorizedClient[]>([])
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [processing, setProcessing] = useState(false)
  const [fromDate, setFromDate] = useState<string>(CURRENT_YEAR_START)
  const [mode, setMode] = useState<Mode>('income')

  const ACTIONS = mode === 'income' ? INCOME_ACTIONS : EXPENSE_ACTIONS

  const fetchClients = useCallback(async () => {
    setLoading(true)
    try {
      const list = mode === 'income'
        ? await getUncategorizedLPClients(fromDate || undefined)
        : await getUncategorizedExpenses(fromDate || undefined)
      setClients(list)
      setIndex(0)
      setHistory([])
    } finally {
      setLoading(false)
    }
  }, [fromDate, mode])

  useEffect(() => { fetchClients() }, [fetchClients])

  const current = clients[index]

  const applyAction = useCallback(async (action: ActionDef) => {
    if (!current || processing) return
    setProcessing(true)
    try {
      const updated = mode === 'income'
        ? await categorizeClientByName(current.name, action.customCategory, action.subcategory)
        : await categorizeExpenseByPattern(current.name, 'other', action.customCategory)
      if (updated > 0) {
        toast.success(`${current.name}: ${updated} transação(ões) → ${action.label}`)
        setHistory((h) => [...h, { client: current, customCategory: action.customCategory, subcategory: action.subcategory, updatedCount: updated }])
      } else {
        toast.warning('Nenhuma transação foi atualizada (talvez o nome não case)')
      }
      setIndex((i) => i + 1)
    } catch {
      toast.error('Erro ao categorizar')
    } finally {
      setProcessing(false)
    }
  }, [current, processing, mode])

  const skip = useCallback(() => {
    if (!current || processing) return
    setIndex((i) => i + 1)
  }, [current, processing])

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const key = e.key
      const action = ACTIONS.find((a) => a.shortcut === key)
      if (action) {
        e.preventDefault()
        applyAction(action)
      } else if (key === ' ' || key === 'Enter' || key === 'ArrowRight') {
        e.preventDefault()
        skip()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [applyAction, skip])

  const finished = !loading && index >= clients.length
  const progress = clients.length > 0 ? Math.round((index / clients.length) * 100) : 0
  const totalUpdated = history.reduce((s, h) => s + h.updatedCount, 0)

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Categorizar em massa</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              {mode === 'income'
                ? '1 cliente por vez. Categoriza todas as transações desse cliente de uma vez.'
                : '1 lojista/serviço por vez. Aplica a categoria em todas as despesas com aquele nome.'}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <label className="text-xs text-slate-500">Desde:</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="border border-slate-200 rounded-md px-2 py-1 text-xs"
            />
            <Button onClick={fetchClients} variant="outline" size="sm" className="h-8 text-xs gap-1">
              Recarregar
            </Button>
          </div>
        </div>

        {/* Mode toggle */}
        <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-sm self-start">
          <button onClick={() => setMode('income')}
            className={`px-4 py-1.5 rounded-md font-medium transition-colors ${mode === 'income' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            💰 Receitas
          </button>
          <button onClick={() => setMode('expense')}
            className={`px-4 py-1.5 rounded-md font-medium transition-colors ${mode === 'expense' ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            💸 Despesas
          </button>
        </div>
      </div>

      {/* Progress */}
      {!loading && clients.length > 0 && (
        <Card className="border border-slate-100 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
              <span>{index} de {clients.length} clientes</span>
              <span>{progress}% · {totalUpdated} transações categorizadas</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <Card className="border border-slate-100"><CardContent className="p-10 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mx-auto" />
        </CardContent></Card>
      ) : finished ? (
        <Card className="border border-emerald-200 bg-emerald-50/40 shadow-sm">
          <CardContent className="p-10 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-600 mx-auto mb-3" />
            <p className="text-lg font-semibold text-slate-800">Tudo categorizado!</p>
            <p className="text-sm text-slate-500 mt-1">
              {history.length} clientes processados · {totalUpdated} transações atualizadas
            </p>
            <Button onClick={fetchClients} className="mt-4 bg-emerald-600 hover:bg-emerald-700">
              Recarregar lista
            </Button>
          </CardContent>
        </Card>
      ) : current && (
        <Card className="border border-slate-100 shadow-md">
          <CardContent className="p-6">
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-emerald-500" />
                <span className="text-xs text-emerald-600 font-medium uppercase tracking-wide">Cliente atual</span>
              </div>
              <h2 className="text-2xl font-bold text-slate-800 break-words">{current.name}</h2>
              <div className="flex flex-wrap items-center justify-center gap-3 mt-3 text-sm text-slate-500">
                <span><strong className="text-emerald-700 text-base">{formatCurrency(current.total)}</strong> total</span>
                <span>·</span>
                <span>{current.count} lançamento(s)</span>
                <span>·</span>
                <span>{current.firstDate} → {current.lastDate}</span>
              </div>
              <p className="text-xs text-slate-400 mt-2 italic truncate">
                Ex: {current.sample}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {ACTIONS.map((a) => (
                <Button
                  key={a.shortcut}
                  onClick={() => applyAction(a)}
                  disabled={processing}
                  className={`${a.color} text-white h-12 gap-2 justify-start text-sm`}
                >
                  <span className="bg-white/20 rounded px-1.5 py-0.5 text-[10px] font-bold">{a.shortcut}</span>
                  <span>{a.emoji}</span>
                  <span className="flex-1 text-left">{a.label}</span>
                </Button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2.5 mt-2.5">
              <Button
                onClick={skip}
                variant="outline"
                disabled={processing}
                className="h-10 gap-2"
              >
                <span className="bg-slate-100 rounded px-1.5 py-0.5 text-[10px] font-bold">SPACE</span>
                Pular
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
              <Button
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
                variant="outline"
                disabled={index === 0 || processing}
                className="h-10 gap-2"
              >
                <Undo2 className="h-3.5 w-3.5" />
                Voltar 1
              </Button>
            </div>

            {processing && (
              <div className="flex items-center justify-center gap-2 mt-4 text-xs text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Aplicando categorização...
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Atalhos — gerados a partir de ACTIONS */}
      {!loading && !finished && (
        <Card className="border border-slate-100 shadow-sm bg-slate-50/50">
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-slate-600 mb-2">⌨️ Atalhos de teclado</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 text-xs text-slate-500">
              {ACTIONS.map((a) => (
                <div key={a.shortcut}>
                  <kbd className="font-mono">{a.shortcut}</kbd> {a.emoji} {a.label.split('/')[0].trim()}
                </div>
              ))}
              <div className="col-span-full"><kbd className="font-mono">Space</kbd> ou <kbd className="font-mono">→</kbd> Pular</div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
