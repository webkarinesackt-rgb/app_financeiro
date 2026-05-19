'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { createClosing, updateClosing } from '@/lib/closings'
import { parseBRLAmount } from '@/lib/format'
import {
  CLOSING_STATUS_LABELS, PROJECT_KINDS, CLOSING_CHANNELS, CLOSING_MARKETS,
  CLOSING_BUSINESS_MODELS, CLOSING_SEGMENTS,
  type Closing, type ClosingFormData, type ClosingStatus,
} from '@/types'

interface ClosingFormProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  closing?: Closing
}

const today = new Date().toISOString().split('T')[0]

export function ClosingForm({ open, onClose, onSuccess, closing }: ClosingFormProps) {
  const isEditing = !!closing
  const [loading, setLoading] = useState(false)

  const [clientName, setClientName] = useState(closing?.client_name ?? '')
  const [projectKind, setProjectKind] = useState<string>(closing?.project_kind ?? '')
  const [totalValue, setTotalValue] = useState(closing ? String(closing.total_value) : '')
  const [channel, setChannel] = useState<string>(closing?.channel ?? '')
  const [market, setMarket] = useState<string>(closing?.market ?? '')
  const [businessModel, setBusinessModel] = useState<string>(closing?.business_model ?? '')
  const [segment, setSegment] = useState<string>(closing?.segment ?? '')
  const [whatsapp, setWhatsapp] = useState(closing?.whatsapp ?? '')
  const [date, setDate] = useState(closing?.start_date ?? today)
  const [status, setStatus] = useState<ClosingStatus>(closing?.status ?? 'closed')
  const [notes, setNotes] = useState(closing?.notes ?? '')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!clientName.trim()) { toast.error('Informe o nome do cliente'); return }
    const value = parseBRLAmount(totalValue)
    if (isNaN(value) || value <= 0) { toast.error('Valor inválido'); return }

    const data: ClosingFormData = {
      client_name: clientName.trim(),
      project_kind: projectKind || null,
      total_value: value,
      channel: channel || null,
      market: market || null,
      business_model: businessModel || null,
      segment: segment || null,
      whatsapp: whatsapp.trim() || null,
      start_date: date,
      status,
      notes: notes.trim() || null,
    }

    setLoading(true)
    try {
      if (isEditing) {
        await updateClosing(closing.id, data)
        toast.success('Fechamento atualizado!')
      } else {
        await createClosing(data)
        toast.success('Fechamento registrado!')
      }
      onSuccess()
      onClose()
    } catch {
      toast.error('Erro ao salvar fechamento')
    } finally {
      setLoading(false)
    }
  }

  const statusOptions: ClosingStatus[] = ['closed', 'in_production', 'delivered', 'paid', 'cancelled']

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Fechamento' : 'Novo Fechamento'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="client">Nome do cliente</Label>
            <Input id="client" placeholder="Ex: Mauricio Nicaretta"
              value={clientName} onChange={(e) => setClientName(e.target.value)} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="value">Valor</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium select-none">R$</span>
                <Input id="value" type="text" inputMode="decimal" placeholder="0,00" className="pl-9"
                  value={totalValue} onChange={(e) => setTotalValue(e.target.value)} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Data</Label>
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Projeto</Label>
              <Select value={projectKind} onValueChange={(v) => { if (v !== null) setProjectKind(v) }}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {PROJECT_KINDS.map((k) => (
                    <SelectItem key={k} value={k}>{k}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => { if (v) setStatus(v as ClosingStatus) }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {statusOptions.map((s) => (
                    <SelectItem key={s} value={s}>{CLOSING_STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Canal</Label>
              <Select value={channel} onValueChange={(v) => { if (v !== null) setChannel(v) }}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {CLOSING_CHANNELS.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Mercado</Label>
              <Select value={market} onValueChange={(v) => { if (v !== null) setMarket(v) }}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {CLOSING_MARKETS.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Modelo de negócio</Label>
              <Select value={businessModel} onValueChange={(v) => { if (v !== null) setBusinessModel(v) }}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {CLOSING_BUSINESS_MODELS.map((b) => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Segmento</Label>
              <Select value={segment} onValueChange={(v) => { if (v !== null) setSegment(v) }}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {CLOSING_SEGMENTS.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="whatsapp">WhatsApp</Label>
            <Input id="whatsapp" type="tel" placeholder="(11) 99999-9999"
              value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Input id="notes" placeholder="Notas internas..."
              value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : isEditing ? 'Salvar' : 'Registrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
