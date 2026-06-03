'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Trash2, Pin, PinOff, Loader2, StickyNote, Pencil, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { listNotes, createNote, updateNote, deleteNote, type Note } from '@/lib/notes'

export function NotesPanel() {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newBody, setNewBody] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editBody, setEditBody] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listNotes()
      setNotes(data)
    } catch (e) {
      toast.error('Erro ao carregar anotações', { description: (e as Error).message })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim()) return
    setAdding(true)
    try {
      const note = await createNote({ title: newTitle.trim(), body: newBody.trim() || null })
      setNotes([note, ...notes])
      setNewTitle(''); setNewBody('')
    } catch (e) {
      toast.error('Erro ao adicionar', { description: (e as Error).message })
    } finally {
      setAdding(false)
    }
  }

  async function handlePin(n: Note) {
    setBusy(n.id)
    try {
      const updated = await updateNote(n.id, { pinned: !n.pinned })
      setNotes((prev) => sortNotes(prev.map((x) => x.id === n.id ? updated : x)))
    } catch (e) {
      toast.error('Erro', { description: (e as Error).message })
    } finally {
      setBusy(null)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir esta anotação?')) return
    setBusy(id)
    try {
      await deleteNote(id)
      setNotes((prev) => prev.filter((n) => n.id !== id))
    } catch (e) {
      toast.error('Erro', { description: (e as Error).message })
    } finally {
      setBusy(null)
    }
  }

  function startEdit(n: Note) {
    setEditingId(n.id)
    setEditTitle(n.title)
    setEditBody(n.body ?? '')
  }

  async function saveEdit(id: string) {
    if (!editTitle.trim()) return
    setBusy(id)
    try {
      const updated = await updateNote(id, { title: editTitle.trim(), body: editBody.trim() || null })
      setNotes((prev) => prev.map((n) => n.id === id ? updated : n))
      setEditingId(null)
    } catch (e) {
      toast.error('Erro', { description: (e as Error).message })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Form de adicionar */}
      <Card className="border border-slate-100 shadow-sm">
        <CardContent className="p-4">
          <form onSubmit={handleAdd} className="space-y-2">
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Título da anotação"
              className="h-9 text-sm"
              disabled={adding}
            />
            <textarea
              value={newBody}
              onChange={(e) => setNewBody(e.target.value)}
              placeholder="Detalhes (opcional)..."
              rows={2}
              className="w-full text-sm rounded-md border border-input bg-transparent px-3 py-2 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
              disabled={adding}
            />
            <div className="flex justify-end">
              <Button type="submit" size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-700 gap-1.5"
                disabled={adding || !newTitle.trim()}>
                {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Adicionar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Lista */}
      {loading ? (
        <Card className="border border-slate-100 shadow-sm">
          <CardContent className="py-6 flex items-center justify-center text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
          </CardContent>
        </Card>
      ) : notes.length === 0 ? (
        <Card className="border border-slate-100 shadow-sm">
          <CardContent className="py-12 text-center">
            <StickyNote className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">Nenhuma anotação ainda</p>
            <p className="text-slate-400 text-sm mt-1">Use o formulário acima para criar uma</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {notes.map((n) => (
            <Card key={n.id} className={`border shadow-sm ${n.pinned ? 'border-amber-200 bg-amber-50/30' : 'border-slate-100'}`}>
              <CardContent className="p-4">
                {editingId === n.id ? (
                  <div className="space-y-2">
                    <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="h-9 text-sm" />
                    <textarea value={editBody} onChange={(e) => setEditBody(e.target.value)}
                      rows={3}
                      className="w-full text-sm rounded-md border border-input bg-transparent px-3 py-2 resize-y" />
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" className="h-7 gap-1" onClick={() => setEditingId(null)}>
                        <X className="h-3.5 w-3.5" /> Cancelar
                      </Button>
                      <Button size="sm" className="h-7 bg-emerald-600 hover:bg-emerald-700 gap-1"
                        onClick={() => saveEdit(n.id)} disabled={busy === n.id || !editTitle.trim()}>
                        {busy === n.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        Salvar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {n.pinned && <Pin className="h-3 w-3 text-amber-600 shrink-0" />}
                        <h3 className="text-sm font-semibold text-slate-800 truncate">{n.title}</h3>
                      </div>
                      {n.body && <p className="text-sm text-slate-600 whitespace-pre-wrap">{n.body}</p>}
                      <p className="text-[10px] text-slate-400 mt-1.5">
                        {new Date(n.updated_at).toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <div className="flex gap-0.5 shrink-0">
                      <button onClick={() => handlePin(n)} disabled={busy === n.id}
                        title={n.pinned ? 'Desafixar' : 'Fixar no topo'}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors disabled:opacity-50">
                        {n.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                      </button>
                      <button onClick={() => startEdit(n)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => handleDelete(n.id)} disabled={busy === n.id}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function sortNotes(list: Note[]): Note[] {
  return [...list].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
}
