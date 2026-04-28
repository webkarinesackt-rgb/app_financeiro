'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { createAccount, updateAccount } from '@/lib/accounts'
import { parseBRLAmount } from '@/lib/format'
import { ACCOUNT_TYPE_LABELS, BANKS, type Account, type AccountType } from '@/types'

interface AccountFormProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  account?: Account
}

const ACCOUNT_COLORS = [
  '#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899',
  '#06b6d4', '#f97316', '#6366f1', '#14b8a6', '#84cc16',
]

export function AccountForm({ open, onClose, onSuccess, account }: AccountFormProps) {
  const isEditing = !!account
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState(account?.name ?? '')
  const [type, setType] = useState<AccountType>(account?.type ?? 'checking')
  const [bank, setBank] = useState(account?.bank ?? '')
  const [color, setColor] = useState(account?.color ?? '#10b981')
  const [initialBalance, setInitialBalance] = useState(account ? String(account.initial_balance) : '0')
  const [includeInTotal, setIncludeInTotal] = useState(account?.include_in_total ?? true)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const data = {
        name,
        type,
        bank: bank || null,
        color,
        initial_balance: parseBRLAmount(initialBalance) || 0,
        include_in_total: includeInTotal,
      }
      if (isEditing) {
        await updateAccount(account.id, data)
        toast.success('Conta atualizada!')
      } else {
        await createAccount(data)
        toast.success('Conta criada!')
      }
      onSuccess()
      onClose()
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'message' in err
        ? String((err as { message: unknown }).message)
        : String(err)
      toast.error(msg || 'Erro ao salvar conta')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Conta' : 'Nova Conta'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome da conta</Label>
            <Input id="name" placeholder="Ex: Nubank, Conta corrente..." value={name}
              onChange={(e) => setName(e.target.value)} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={(v) => { if (v) setType(v as AccountType) }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(ACCOUNT_TYPE_LABELS) as [AccountType, string][]).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="initialBalance">Saldo inicial</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium select-none">R$</span>
              <Input id="initialBalance" type="text" inputMode="decimal" placeholder="0,00"
                className="pl-9"
                value={initialBalance} onChange={(e) => setInitialBalance(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Cor</Label>
            <div className="flex gap-2 flex-wrap">
              {ACCOUNT_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className="h-7 w-7 rounded-full transition-all hover:scale-110"
                  style={{ backgroundColor: c, outline: color === c ? `3px solid ${c}` : 'none', outlineOffset: '2px' }}
                />
              ))}
            </div>
          </div>

          <button type="button" onClick={() => setIncludeInTotal(!includeInTotal)}
            className="flex items-center gap-3 w-full">
            <div className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${includeInTotal ? 'bg-emerald-500' : 'bg-slate-200'}`}>
              <span className={`inline-block h-4 w-4 translate-y-0.5 rounded-full bg-white shadow transition-transform ${includeInTotal ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
            <span className="text-sm text-slate-700">Incluir no Saldo Geral</span>
          </button>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading} className="bg-emerald-600 hover:bg-emerald-700">
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {isEditing ? 'Salvar' : 'Criar conta'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
