'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CreditCardForm } from '@/components/cards/credit-card-form'
import { getCreditCards, deleteCreditCard } from '@/lib/credit-cards'
import { formatCurrency } from '@/lib/format'
import { getBankName, type CreditCard } from '@/types'
import { Plus, Pencil, Trash2, CreditCard as CardIcon } from 'lucide-react'
import { toast } from 'sonner'

export default function CardsPage() {
  const [cards, setCards] = useState<CreditCard[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editCard, setEditCard] = useState<CreditCard | undefined>()
  const [deleting, setDeleting] = useState<string | null>(null)

  const fetchCards = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getCreditCards()
      setCards(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchCards() }, [fetchCards])

  function openNew() {
    setEditCard(undefined)
    setFormOpen(true)
  }

  function openEdit(card: CreditCard) {
    setEditCard(card)
    setFormOpen(true)
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este cartão? As transações vinculadas não serão apagadas.')) return
    setDeleting(id)
    try {
      await deleteCreditCard(id)
      toast.success('Cartão excluído')
      fetchCards()
    } catch {
      toast.error('Erro ao excluir cartão')
    } finally {
      setDeleting(null)
    }
  }

  const totalLimit = cards.reduce((s, c) => s + c.credit_limit, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Cartões de crédito</h2>
          <p className="text-sm text-slate-500">Gerencie seus cartões e limites</p>
        </div>
        <Button onClick={openNew} size="sm" className="bg-blue-600 hover:bg-blue-700 gap-1.5">
          <Plus className="h-4 w-4" /> Novo cartão
        </Button>
      </div>

      {/* Total limit summary */}
      {cards.length > 0 && totalLimit > 0 && (
        <Card className="border border-blue-100 bg-blue-50/50 shadow-none">
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Limite total disponível</span>
              <span className="text-base font-bold text-blue-700">{formatCurrency(totalLimit)}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : cards.length === 0 ? (
        <Card className="border border-slate-100 shadow-sm">
          <CardContent className="py-16 text-center">
            <CardIcon className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">Nenhum cartão cadastrado</p>
            <p className="text-slate-400 text-sm mt-1">Adicione um cartão para rastrear suas faturas</p>
            <Button onClick={openNew} size="sm" className="mt-4 bg-blue-600 hover:bg-blue-700 gap-1.5">
              <Plus className="h-4 w-4" /> Criar primeiro cartão
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {cards.map((card) => (
            <Card key={card.id} className="border border-slate-100 shadow-sm">
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-3">
                  {/* Card icon */}
                  <div
                    className="h-10 w-10 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0"
                    style={{ backgroundColor: card.color }}
                  >
                    {card.name.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{card.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {card.bank && (
                        <span className="text-xs text-slate-400">{getBankName(card.bank)}</span>
                      )}
                      {card.closing_day && (
                        <span className="text-xs text-slate-400">· fecha dia {card.closing_day}</span>
                      )}
                      {card.due_day && (
                        <span className="text-xs text-slate-400">· vence dia {card.due_day}</span>
                      )}
                    </div>
                  </div>

                  {/* Limit */}
                  {card.credit_limit > 0 && (
                    <div className="text-right shrink-0 mr-2">
                      <p className="text-xs text-slate-400">Limite</p>
                      <p className="text-sm font-bold text-slate-700">{formatCurrency(card.credit_limit)}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => openEdit(card)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(card.id)}
                      disabled={deleting === card.id}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreditCardForm
        open={formOpen}
        card={editCard}
        onClose={() => setFormOpen(false)}
        onSuccess={fetchCards}
      />
    </div>
  )
}
