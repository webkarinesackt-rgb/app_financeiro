'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Loader2, CreditCard as CardIcon } from 'lucide-react'
import { toast } from 'sonner'
import { createCreditCard, updateCreditCard } from '@/lib/credit-cards'
import { parseBRLAmount } from '@/lib/format'
import { BANKS, type CreditCard } from '@/types'

interface CreditCardFormProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  card?: CreditCard
}

const CARD_COLORS = [
  '#8B5CF6', '#3b82f6', '#111827', '#EC0000', '#F97316',
  '#10b981', '#F59E0B', '#06b6d4', '#ec4899', '#334155',
]

export function CreditCardForm({ open, onClose, onSuccess, card }: CreditCardFormProps) {
  const isEditing = !!card
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState(card?.name ?? '')
  const [bank, setBank] = useState(card?.bank ?? '')
  const [color, setColor] = useState(card?.color ?? '#8B5CF6')
  const [creditLimit, setCreditLimit] = useState(card ? String(card.credit_limit) : '')
  const [closingDay, setClosingDay] = useState(card?.closing_day ? String(card.closing_day) : '')
  const [dueDay, setDueDay] = useState(card?.due_day ? String(card.due_day) : '')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const data = {
        name,
        bank: bank || null,
        color,
        credit_limit: parseBRLAmount(creditLimit) || 0,
        closing_day: closingDay ? parseInt(closingDay) : null,
        due_day: dueDay ? parseInt(dueDay) : null,
      }
      if (isEditing) {
        await updateCreditCard(card.id, data)
        toast.success('Cartão atualizado!')
      } else {
        await createCreditCard(data)
        toast.success('Cartão criado!')
      }
      onSuccess()
      onClose()
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'message' in err
        ? String((err as { message: unknown }).message)
        : String(err)
      toast.error(msg || 'Erro ao salvar cartão')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Cartão' : 'Novo Cartão de Crédito'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Card preview */}
          <div className="rounded-xl p-4 text-white flex items-center gap-3" style={{ backgroundColor: color }}>
            <CardIcon className="h-6 w-6" />
            <div>
              <p className="font-semibold text-sm">{name || 'Nome do cartão'}</p>
              <p className="text-xs opacity-80">{bank ? BANKS.find(b => b.id === bank)?.name : 'Banco'}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cardName">Nome do cartão</Label>
            <Input id="cardName" placeholder="Ex: Nubank, Itaú Platinum..." value={name}
              onChange={(e) => setName(e.target.value)} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Banco</Label>
              <Select value={bank} onValueChange={(v) => setBank(v ?? '')}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {BANKS.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="creditLimit">Limite</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium select-none">R$</span>
                <Input id="creditLimit" type="text" inputMode="decimal" placeholder="0,00"
                  className="pl-9"
                  value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="closingDay">Dia de fechamento</Label>
              <Input id="closingDay" type="number" min="1" max="31" placeholder="Ex: 15"
                value={closingDay} onChange={(e) => setClosingDay(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dueDay">Dia de vencimento</Label>
              <Input id="dueDay" type="number" min="1" max="31" placeholder="Ex: 25"
                value={dueDay} onChange={(e) => setDueDay(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Cor do cartão</Label>
            <div className="flex gap-2 flex-wrap">
              {CARD_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className="h-7 w-7 rounded-full transition-all hover:scale-110"
                  style={{ backgroundColor: c, outline: color === c ? `3px solid ${c}` : 'none', outlineOffset: '2px' }}
                />
              ))}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading} style={{ backgroundColor: color }}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {isEditing ? 'Salvar' : 'Criar cartão'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
