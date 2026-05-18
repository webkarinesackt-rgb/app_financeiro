'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Check, Trash2, Loader2, AlertCircle, ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import {
  listReminders, createReminder, completeReminder, deleteReminder,
  type Reminder, type ReminderType,
} from '@/lib/reminders'
import { toast } from 'sonner'

interface Props {
  type: ReminderType
}

const CONFIG: Record<ReminderType, { title: string; icon: React.ReactNode; accent: string; placeholder: string; empty: string }> = {
  payment_due: {
    title: 'Contas a pagar',
    icon: <ArrowUpRight className="h-4 w-4 text-red-500" />,
    accent: 'text-red-600',
    placeholder: 'Ex: Aluguel sala',
    empty: 'Nenhuma conta pendente',
  },
  invoice_pending: {
    title: 'Clientes a cobrar',
    icon: <ArrowDownLeft className="h-4 w-4 text-emerald-600" />,
    accent: 'text-emerald-700',
    placeholder: 'Ex: Cobrar cliente X',
    empty: 'Tudo cobrado 🎉',
  },
}

export function RemindersCard({ type }: Props) {
  const cfg = CONFIG[type]
  const [items, setItems] = useState<Reminder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [newDate, setNewDate] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null)
    try { setItems(await listReminders(type, { completed: false })) }
    catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }, [type])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim()) return
    setAdding(true)
    try {
      await createReminder({
        type,
        title: newTitle.trim(),
        amount: newAmount ? Number(newAmount.replace(',', '.')) : null,
        due_date: newDate || null,
      })
      setNewTitle(''); setNewAmount(''); setNewDate('')
      fetchData()
    } catch (e) {
      toast.error('Erro ao adicionar', { description: (e as Error).message })
    } finally { setAdding(false) }
  }

  async function handleComplete(id: string) {
    setBusy(id)
    try {
      await completeReminder(id, true)
      setItems((prev) => prev.filter((r) => r.id !== id))
      toast.success('Marcada como concluída')
    } catch (e) { toast.error('Erro', { description: (e as Error).message }) }
    finally { setBusy(null) }
  }

  async function handleDelete(id: string) {
    setBusy(id)
    try {
      await deleteReminder(id)
      setItems((prev) => prev.filter((r) => r.id !== id))
    } catch (e) { toast.error('Erro', { description: (e as Error).message }) }
    finally { setBusy(null) }
  }

  const total = items.reduce((s, r) => s + (r.amount ?? 0), 0)

  return (
    <Card className="border border-slate-100 shadow-sm">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold text-slate-700 flex items-center gap-2">
          {cfg.icon} {cfg.title}
        </CardTitle>
        {total > 0 && (
          <span className={`text-sm font-semibold ${cfg.accent}`}>{formatCurrency(total)}</span>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Form de adicionar */}
        <form onSubmit={handleAdd} className="space-y-2">
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder={cfg.placeholder}
            className="h-9 text-sm"
            disabled={adding}
          />
          <div className="flex gap-2">
            <Input
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              placeholder="Valor"
              type="number" step="0.01" inputMode="decimal"
              className="h-9 text-sm flex-1"
              disabled={adding}
            />
            <Input
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              type="date"
              className="h-9 text-sm flex-1"
              disabled={adding}
            />
            <Button type="submit" size="sm" className="h-9 bg-emerald-600 hover:bg-emerald-700" disabled={adding || !newTitle.trim()}>
              {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </form>

        {/* Lista */}
        {loading ? (
          <div className="flex items-center justify-center py-6 text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-red-500 text-sm py-2">
            <AlertCircle className="h-4 w-4" /> {error}
          </div>
        ) : items.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-6">{cfg.empty}</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((r) => (
              <ReminderRow key={r.id} reminder={r} busy={busy === r.id}
                onComplete={() => handleComplete(r.id)}
                onDelete={() => handleDelete(r.id)}
                accent={cfg.accent} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ReminderRow({ reminder, busy, onComplete, onDelete, accent }: {
  reminder: Reminder
  busy: boolean
  onComplete: () => void
  onDelete: () => void
  accent: string
}) {
  const isLate = reminder.due_date && new Date(reminder.due_date) < new Date(new Date().toDateString())
  return (
    <div className="flex items-center gap-2 py-2">
      <button
        onClick={onComplete}
        disabled={busy}
        title="Marcar como feito"
        className="h-5 w-5 rounded border border-slate-300 hover:border-emerald-500 hover:bg-emerald-50 flex items-center justify-center shrink-0 transition-colors disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3 text-emerald-600 opacity-0 hover:opacity-100" />}
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-700 truncate">{reminder.title}</p>
        {reminder.due_date && (
          <p className={`text-xs ${isLate ? 'text-red-500 font-medium' : 'text-slate-400'}`}>
            {isLate ? 'Vencido em ' : 'Até '}
            {new Date(reminder.due_date + 'T00:00:00').toLocaleDateString('pt-BR')}
          </p>
        )}
      </div>
      {reminder.amount && (
        <span className={`text-sm font-semibold shrink-0 ${accent}`}>{formatCurrency(reminder.amount)}</span>
      )}
      <button
        onClick={onDelete}
        disabled={busy}
        className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
