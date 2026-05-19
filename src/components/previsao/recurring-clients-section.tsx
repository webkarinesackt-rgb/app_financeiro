'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Plus, Repeat, Upload, MoreVertical, Pencil, Trash2, Power, Loader2, FileSpreadsheet } from 'lucide-react'
import { toast } from 'sonner'
import {
  getRecurringClients, createRecurringClient, createRecurringClientsBulk,
  updateRecurringClient, deleteRecurringClient,
  sumMonthlyRecurringRevenue, parseRecurringClientsCsv,
} from '@/lib/recurring-clients'
import { formatCurrency, parseBRLAmount } from '@/lib/format'
import { getSubcategoryOptions, type RecurringClient, type RecurringClientFormData } from '@/types'

interface Props {
  onChange?: (monthlyTotal: number) => void
}

const SERVICE_TYPE_OPTIONS = getSubcategoryOptions('Receita Landing Page / Site')

export function RecurringClientsSection({ onChange }: Props) {
  const [clients, setClients] = useState<RecurringClient[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<RecurringClient | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const list = await getRecurringClients()
      setClients(list)
      onChange?.(sumMonthlyRecurringRevenue(list))
    } finally {
      setLoading(false)
    }
  }, [onChange])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleToggleActive(c: RecurringClient) {
    try {
      await updateRecurringClient(c.id, { active: !c.active })
      fetchData()
    } catch {
      toast.error('Erro ao atualizar')
    }
  }

  async function handleDelete(c: RecurringClient) {
    if (!confirm(`Excluir cliente "${c.name}"?`)) return
    try {
      await deleteRecurringClient(c.id)
      toast.success('Removido')
      fetchData()
    } catch {
      toast.error('Erro ao excluir')
    }
  }

  async function handleCsvUpload(file: File) {
    try {
      const text = await file.text()
      const result = parseRecurringClientsCsv(text)
      if (result.warnings.length > 0 && result.rows.length === 0) {
        toast.error(result.warnings[0])
        return
      }
      if (result.rows.length === 0) {
        toast.error('Nenhuma linha válida no CSV')
        return
      }
      const payload: RecurringClientFormData[] = result.rows.map((r) => ({
        name: r.name,
        amount: r.amount,
        billing_day: r.billing_day,
        service_type: r.service_type,
        active: true,
        notes: null,
        started_at: null,
      }))
      await createRecurringClientsBulk(payload)
      toast.success(`${payload.length} cliente(s) importado(s)${result.skipped > 0 ? ` (${result.skipped} ignorados)` : ''}`)
      fetchData()
    } catch {
      toast.error('Erro ao processar CSV')
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const monthlyTotal = sumMonthlyRecurringRevenue(clients)
  const activeCount = clients.filter((c) => c.active).length

  return (
    <Card className="border border-slate-100 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-emerald-50 p-2">
              <Repeat className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-700">Clientes recorrentes (MRR)</h2>
              <p className="text-xs text-slate-400">Receita recorrente mensal · base pra previsão de entradas</p>
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
            <p className="text-xs text-emerald-600 font-medium">MRR (receita mensal recorrente)</p>
            <p className="text-lg font-bold text-emerald-700">{formatCurrency(monthlyTotal)}</p>
          </div>
          <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
            <p className="text-xs text-slate-500 font-medium">Clientes ativos</p>
            <p className="text-lg font-bold text-slate-700">{activeCount} de {clients.length}</p>
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 col-span-2 sm:col-span-1">
            <p className="text-xs text-blue-600 font-medium">Projeção anual (ARR)</p>
            <p className="text-lg font-bold text-blue-700">{formatCurrency(monthlyTotal * 12)}</p>
          </div>
        </div>

        {/* Lista */}
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />)}
          </div>
        ) : clients.length === 0 ? (
          <div className="border border-dashed border-slate-200 rounded-lg p-6 text-center">
            <FileSpreadsheet className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">Nenhum cliente recorrente cadastrado</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Cadastre manualmente ou faça upload de CSV
              <br />
              <span className="text-slate-300">(colunas: nome, valor, dia, servico)</span>
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {clients.map((c) => (
              <div key={c.id} className={`flex items-center justify-between py-2.5 gap-3 ${!c.active ? 'opacity-50' : ''}`}>
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="h-2 w-2 rounded-full shrink-0 bg-emerald-500" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{c.name}</p>
                    <p className="text-xs text-slate-400">
                      {c.service_type ?? 'Mensal'}
                      {c.billing_day && ` · dia ${c.billing_day}`}
                      {!c.active && ' · INATIVO'}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-emerald-700">{formatCurrency(Number(c.amount))}</p>
                  <p className="text-[10px] text-slate-400">por mês</p>
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
                      {c.active ? 'Pausar' : 'Reativar'}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDelete(c)} className="text-red-600 focus:text-red-600">
                      <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        )}

        <RecurringClientForm open={showForm} onClose={() => setShowForm(false)} onSuccess={fetchData} />
        {editing && (
          <RecurringClientForm
            open={!!editing}
            onClose={() => setEditing(null)}
            onSuccess={fetchData}
            client={editing}
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
  client?: RecurringClient
}

function RecurringClientForm({ open, onClose, onSuccess, client }: FormProps) {
  const isEditing = !!client
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState(client?.name ?? '')
  const [amount, setAmount] = useState(client ? String(client.amount) : '')
  const [billingDay, setBillingDay] = useState(client?.billing_day ? String(client.billing_day) : '')
  const [serviceType, setServiceType] = useState(client?.service_type ?? '')
  const [notes, setNotes] = useState(client?.notes ?? '')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { toast.error('Nome obrigatório'); return }
    const value = parseBRLAmount(amount)
    if (isNaN(value) || value <= 0) { toast.error('Valor inválido'); return }

    setLoading(true)
    try {
      const day = parseInt(billingDay)
      const data: RecurringClientFormData = {
        name: name.trim(),
        amount: value,
        billing_day: !isNaN(day) && day >= 1 && day <= 31 ? day : null,
        service_type: serviceType || null,
        active: client?.active ?? true,
        notes: notes.trim() || null,
        started_at: null,
      }
      if (isEditing) {
        await updateRecurringClient(client.id, data)
        toast.success('Atualizado')
      } else {
        await createRecurringClient(data)
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
          <DialogTitle>{isEditing ? 'Editar cliente recorrente' : 'Novo cliente recorrente'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rc-name">Nome / Empresa</Label>
            <Input id="rc-name" placeholder="Ex: EMAD, CRESCERE, Dr Marcos Paulo..."
              value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="rc-amount">Valor mensal</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium select-none">R$</span>
                <Input id="rc-amount" type="text" inputMode="decimal" placeholder="0,00" className="pl-9"
                  value={amount} onChange={(e) => setAmount(e.target.value)} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rc-day">Dia de cobrança</Label>
              <Input id="rc-day" type="number" min="1" max="31" placeholder="Ex: 5"
                value={billingDay} onChange={(e) => setBillingDay(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Tipo de serviço (opcional)</Label>
            <Select value={serviceType} onValueChange={(v) => setServiceType(v ?? '')}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {SERVICE_TYPE_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rc-notes">Observações</Label>
            <Input id="rc-notes" placeholder="Opcional"
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
