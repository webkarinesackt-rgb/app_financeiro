'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Plus, Users, Upload, MoreVertical, Pencil, Trash2, Power, Loader2, FileSpreadsheet } from 'lucide-react'
import { toast } from 'sonner'
import {
  getFixedCosts, createFixedCost, createFixedCostsBulk, updateFixedCost, deleteFixedCost,
  sumMonthlyFixedCosts, parseFixedCostsCsv,
} from '@/lib/fixed-costs'
import { formatCurrency, parseBRLAmount } from '@/lib/format'
import {
  FIXED_COST_FREQUENCY_LABELS, FIXED_COST_CATEGORY_LABELS, FIXED_COST_CATEGORY_COLORS,
  FREQUENCY_TO_MONTHLY,
  type FixedCost, type FixedCostFrequency, type FixedCostCategory, type FixedCostFormData,
} from '@/types'

interface Props {
  onChange?: (monthlyTotal: number) => void
}

const FREQUENCY_OPTIONS: FixedCostFrequency[] = ['weekly', 'biweekly', 'monthly', 'quarterly', 'yearly']
const CATEGORY_OPTIONS: FixedCostCategory[] = ['team', 'tools', 'infra', 'marketing', 'taxes', 'other']

export function FixedCostsSection({ onChange }: Props) {
  const [costs, setCosts] = useState<FixedCost[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<FixedCost | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const list = await getFixedCosts()
      setCosts(list)
      onChange?.(sumMonthlyFixedCosts(list))
    } finally {
      setLoading(false)
    }
  }, [onChange])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleToggleActive(c: FixedCost) {
    try {
      await updateFixedCost(c.id, { active: !c.active })
      fetchData()
    } catch {
      toast.error('Erro ao atualizar')
    }
  }

  async function handleDelete(c: FixedCost) {
    if (!confirm(`Excluir "${c.name}"?`)) return
    try {
      await deleteFixedCost(c.id)
      toast.success('Removido')
      fetchData()
    } catch {
      toast.error('Erro ao excluir')
    }
  }

  async function handleCsvUpload(file: File) {
    try {
      const text = await file.text()
      const result = parseFixedCostsCsv(text)
      if (result.warnings.length > 0 && result.rows.length === 0) {
        toast.error(result.warnings[0])
        return
      }
      if (result.rows.length === 0) {
        toast.error('Nenhuma linha válida no CSV')
        return
      }
      const payload: FixedCostFormData[] = result.rows.map((r) => ({
        name: r.name,
        amount: r.amount,
        frequency: r.frequency,
        category: r.category,
        notes: null,
        active: true,
      }))
      await createFixedCostsBulk(payload)
      toast.success(`${payload.length} custo(s) importado(s)${result.skipped > 0 ? ` (${result.skipped} ignorados)` : ''}`)
      fetchData()
    } catch {
      toast.error('Erro ao processar CSV')
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const monthlyTotal = sumMonthlyFixedCosts(costs)
  const activeCount = costs.filter((c) => c.active).length

  // Agrupa por categoria pro breakdown
  const byCategory = costs
    .filter((c) => c.active)
    .reduce<Record<string, number>>((acc, c) => {
      const monthly = Number(c.amount) * FREQUENCY_TO_MONTHLY[c.frequency]
      acc[c.category] = (acc[c.category] ?? 0) + monthly
      return acc
    }, {})

  return (
    <Card className="border border-slate-100 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-emerald-50 p-2">
              <Users className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-700">Custos fixos (equipe, ferramentas, infra)</h2>
              <p className="text-xs text-slate-400">Somam na projeção dos próximos meses · não viram transação</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleCsvUpload(file)
              }}
            />
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs h-8"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-3.5 w-3.5" />
              CSV
            </Button>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 gap-1.5 text-xs h-8"
              onClick={() => setShowForm(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              Adicionar
            </Button>
          </div>
        </div>

        {/* Resumo */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3">
            <p className="text-xs text-emerald-600 font-medium">Total mensal equivalente</p>
            <p className="text-lg font-bold text-emerald-700">{formatCurrency(monthlyTotal)}</p>
          </div>
          <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
            <p className="text-xs text-slate-500 font-medium">Custos ativos</p>
            <p className="text-lg font-bold text-slate-700">{activeCount} de {costs.length}</p>
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 col-span-2 sm:col-span-1">
            <p className="text-xs text-blue-600 font-medium">Projeção anual</p>
            <p className="text-lg font-bold text-blue-700">{formatCurrency(monthlyTotal * 12)}</p>
          </div>
        </div>

        {/* Breakdown por categoria */}
        {Object.keys(byCategory).length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {(Object.entries(byCategory) as [FixedCostCategory, number][])
              .sort((a, b) => b[1] - a[1])
              .map(([cat, total]) => (
                <span
                  key={cat}
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium"
                  style={{
                    backgroundColor: `${FIXED_COST_CATEGORY_COLORS[cat]}1A`,
                    color: FIXED_COST_CATEGORY_COLORS[cat],
                  }}
                >
                  {FIXED_COST_CATEGORY_LABELS[cat]} · {formatCurrency(total)}
                </span>
              ))}
          </div>
        )}

        {/* Lista */}
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />)}
          </div>
        ) : costs.length === 0 ? (
          <div className="border border-dashed border-slate-200 rounded-lg p-6 text-center">
            <FileSpreadsheet className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">Nenhum custo fixo ainda</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Adicione manualmente ou faça upload de uma planilha CSV
              <br />
              <span className="text-slate-300">(colunas: nome, valor, frequencia, categoria)</span>
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {costs.map((c) => {
              const monthly = Number(c.amount) * FREQUENCY_TO_MONTHLY[c.frequency]
              const color = FIXED_COST_CATEGORY_COLORS[c.category]
              return (
                <div key={c.id} className={`flex items-center justify-between py-2.5 gap-3 ${!c.active ? 'opacity-50' : ''}`}>
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{c.name}</p>
                      <p className="text-xs text-slate-400">
                        {FIXED_COST_CATEGORY_LABELS[c.category]} · {FIXED_COST_FREQUENCY_LABELS[c.frequency]}
                        {!c.active && ' · INATIVO'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-slate-800">{formatCurrency(Number(c.amount))}</p>
                    {c.frequency !== 'monthly' && (
                      <p className="text-[10px] text-slate-400">{formatCurrency(monthly)}/mês equivalente</p>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="inline-flex items-center justify-center h-7 w-7 rounded-md text-slate-400 hover:bg-slate-100">
                      <MoreVertical className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEditing(c)}>
                        <Pencil className="h-3.5 w-3.5 mr-2" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleToggleActive(c)}>
                        <Power className="h-3.5 w-3.5 mr-2" />
                        {c.active ? 'Desativar' : 'Ativar'}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDelete(c)} className="text-red-600 focus:text-red-600">
                        <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )
            })}
          </div>
        )}

        <FixedCostForm open={showForm} onClose={() => setShowForm(false)} onSuccess={fetchData} />
        {editing && (
          <FixedCostForm
            open={!!editing}
            onClose={() => setEditing(null)}
            onSuccess={fetchData}
            cost={editing}
          />
        )}
      </CardContent>
    </Card>
  )
}

// ─── Form modal ───────────────────────────────────────────────────────────

interface FormProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  cost?: FixedCost
}

function FixedCostForm({ open, onClose, onSuccess, cost }: FormProps) {
  const isEditing = !!cost
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState(cost?.name ?? '')
  const [amount, setAmount] = useState(cost ? String(cost.amount) : '')
  const [frequency, setFrequency] = useState<FixedCostFrequency>(cost?.frequency ?? 'monthly')
  const [category, setCategory] = useState<FixedCostCategory>(cost?.category ?? 'team')
  const [notes, setNotes] = useState(cost?.notes ?? '')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { toast.error('Nome obrigatório'); return }
    const value = parseBRLAmount(amount)
    if (isNaN(value) || value <= 0) { toast.error('Valor inválido'); return }

    setLoading(true)
    try {
      const data: FixedCostFormData = {
        name: name.trim(),
        amount: value,
        frequency,
        category,
        notes: notes.trim() || null,
        active: cost?.active ?? true,
      }
      if (isEditing) {
        await updateFixedCost(cost.id, data)
        toast.success('Atualizado')
      } else {
        await createFixedCost(data)
        toast.success('Adicionado')
      }
      onSuccess()
      onClose()
    } catch {
      toast.error('Erro ao salvar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar custo fixo' : 'Novo custo fixo'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fc-name">Nome</Label>
            <Input id="fc-name" placeholder="Ex: Designer Junior, ClickUp, Aluguel sala..."
              value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="fc-amount">Valor</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium select-none">R$</span>
                <Input id="fc-amount" type="text" inputMode="decimal" placeholder="0,00" className="pl-9"
                  value={amount} onChange={(e) => setAmount(e.target.value)} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Frequência</Label>
              <Select value={frequency} onValueChange={(v) => { if (v) setFrequency(v as FixedCostFrequency) }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FREQUENCY_OPTIONS.map((f) => (
                    <SelectItem key={f} value={f}>{FIXED_COST_FREQUENCY_LABELS[f]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={category} onValueChange={(v) => { if (v) setCategory(v as FixedCostCategory) }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((c) => (
                  <SelectItem key={c} value={c}>{FIXED_COST_CATEGORY_LABELS[c]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fc-notes">Observações</Label>
            <Input id="fc-notes" placeholder="Opcional"
              value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : isEditing ? 'Salvar' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
