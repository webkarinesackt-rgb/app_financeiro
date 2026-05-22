'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { getCustomCategories, mergeCustomCategory } from '@/lib/transactions'

interface MergeCategoriesDialogProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

// Junta uma categoria dentro de outra — move todos os lançamentos de uma
// custom_category para outra, em todos os meses de uma vez.
export function MergeCategoriesDialog({ open, onClose, onSuccess }: MergeCategoriesDialogProps) {
  const [cats, setCats] = useState<string[]>([])
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) getCustomCategories().then(setCats).catch(() => setCats([]))
  }, [open])

  async function handleMerge() {
    if (!from || !to || from === to) {
      toast.error('Escolha duas categorias diferentes')
      return
    }
    setLoading(true)
    try {
      const n = await mergeCustomCategory(from, to)
      toast.success(`${n} lançamento(s) movido(s) de "${from}" para "${to}"`)
      setFrom('')
      setTo('')
      onSuccess()
      onClose()
    } catch {
      toast.error('Erro ao juntar categorias')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Juntar categorias</DialogTitle>
          <DialogDescription>
            Move todos os lançamentos de uma categoria para outra — em todos os meses de uma vez.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">Juntar esta categoria:</label>
            <Select value={from} onValueChange={(v) => setFrom(v ?? '')}>
              <SelectTrigger><SelectValue placeholder="Categoria de origem" /></SelectTrigger>
              <SelectContent>
                {cats.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">Dentro desta:</label>
            <Select value={to} onValueChange={(v) => setTo(v ?? '')}>
              <SelectTrigger><SelectValue placeholder="Categoria de destino" /></SelectTrigger>
              <SelectContent>
                {cats.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={handleMerge} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700">
            {loading ? 'Juntando...' : 'Juntar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
