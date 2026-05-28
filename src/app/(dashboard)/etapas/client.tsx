'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  STAGES,
  STAGE_BY_ID,
  STAGE_TONE_CLASSES,
  parseStage,
  withStage,
} from '@/lib/project-stages'
import { Loader2, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'

interface ProjectRow {
  id: string
  name: string
  client_name: string | null
  total_value: number
  whatsapp: string | null
  project_kind: string | null
  status: string
  notes: string | null
  start_date: string
  channel: string | null
}

type ViewMode = 'kanban' | 'list'

export function EtapasClient() {
  const [rows, setRows] = useState<ProjectRow[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<ViewMode>('kanban')
  const [search, setSearch] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('projects')
      .select(
        'id, name, client_name, total_value, whatsapp, project_kind, status, notes, start_date, channel',
      )
      .order('start_date', { ascending: false })
    setRows((data ?? []) as ProjectRow[])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  async function updateStage(projectId: string, stageId: string) {
    const project = rows.find((r) => r.id === projectId)
    if (!project) return
    const newNotes = withStage(project.notes, stageId)

    // Otimista
    setRows((prev) =>
      prev.map((r) => (r.id === projectId ? { ...r, notes: newNotes } : r)),
    )
    setSavingId(projectId)

    const supabase = createClient()
    const { error } = await supabase
      .from('projects')
      .update({ notes: newNotes, updated_at: new Date().toISOString() })
      .eq('id', projectId)

    if (error) {
      // Rollback
      setRows((prev) =>
        prev.map((r) => (r.id === projectId ? { ...r, notes: project.notes } : r)),
      )
      alert(`Erro ao atualizar etapa: ${error.message}`)
    }
    setSavingId(null)
  }

  const filtered = rows.filter((r) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      r.name?.toLowerCase().includes(q) ||
      r.client_name?.toLowerCase().includes(q) ||
      r.project_kind?.toLowerCase().includes(q)
    )
  })

  // Agrupa por stage
  const byStage = new Map<string, ProjectRow[]>()
  STAGES.forEach((s) => byStage.set(s.id, []))
  filtered.forEach((r) => {
    const stage = parseStage(r.notes)
    byStage.get(stage)?.push(r)
  })

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando projetos…
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Etapas de produção</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {filtered.length} projeto(s) — arraste pela etapa ou clique no card pra trocar
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar…"
              className="pl-8 h-8 w-48 text-xs"
            />
          </div>
          <div className="inline-flex rounded-md border border-slate-200 bg-white p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setView('kanban')}
              className={
                'rounded px-2.5 py-1 transition ' +
                (view === 'kanban'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100')
              }
            >
              Kanban
            </button>
            <button
              type="button"
              onClick={() => setView('list')}
              className={
                'rounded px-2.5 py-1 transition ' +
                (view === 'list'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100')
              }
            >
              Lista
            </button>
          </div>
        </div>
      </div>

      {/* Pizza-style stats no topo (compact) */}
      <div className="flex flex-wrap gap-2">
        {STAGES.map((s) => {
          const count = byStage.get(s.id)?.length ?? 0
          if (count === 0) return null
          const tone = STAGE_TONE_CLASSES[s.tone]
          return (
            <div
              key={s.id}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${tone.bg} ${tone.border} ${tone.text} text-[0.7rem] font-medium`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
              {s.label} · {count}
            </div>
          )
        })}
      </div>

      {view === 'kanban' ? (
        <KanbanView
          rows={filtered}
          byStage={byStage}
          savingId={savingId}
          onMove={updateStage}
        />
      ) : (
        <ListView rows={filtered} savingId={savingId} onMove={updateStage} />
      )}
    </div>
  )
}

function KanbanView({
  byStage,
  savingId,
  onMove,
}: {
  rows: ProjectRow[]
  byStage: Map<string, ProjectRow[]>
  savingId: string | null
  onMove: (projectId: string, stageId: string) => void
}) {
  const [dragId, setDragId] = useState<string | null>(null)

  return (
    <div className="overflow-x-auto pb-3">
      <div className="flex gap-3 min-w-fit">
        {STAGES.map((s) => {
          const stageRows = byStage.get(s.id) ?? []
          const tone = STAGE_TONE_CLASSES[s.tone]
          return (
            <div
              key={s.id}
              onDragOver={(e) => {
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
              }}
              onDrop={(e) => {
                e.preventDefault()
                const id = e.dataTransfer.getData('text/plain') || dragId
                if (id) onMove(id, s.id)
                setDragId(null)
              }}
              className={`flex flex-col w-64 shrink-0 rounded-xl border ${tone.border} ${tone.bg}`}
            >
              <div className={`flex items-center justify-between px-3 py-2 border-b ${tone.border}`}>
                <div className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
                  <span className={`text-[0.7rem] uppercase tracking-[0.08em] font-semibold ${tone.text}`}>
                    {s.label}
                  </span>
                </div>
                <span className={`text-[0.7rem] font-medium ${tone.text}`}>
                  {stageRows.length}
                </span>
              </div>
              <div className="flex flex-col gap-2 p-2 min-h-[80px]">
                {stageRows.map((r) => (
                  <ProjectCard
                    key={r.id}
                    project={r}
                    saving={savingId === r.id}
                    onDragStart={() => setDragId(r.id)}
                    onMove={onMove}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ProjectCard({
  project,
  saving,
  onDragStart,
  onMove,
}: {
  project: ProjectRow
  saving: boolean
  onDragStart: () => void
  onMove: (projectId: string, stageId: string) => void
}) {
  const [showMenu, setShowMenu] = useState(false)
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', project.id)
        e.dataTransfer.effectAllowed = 'move'
        onDragStart()
      }}
      className="bg-white rounded-lg border border-slate-200 p-2.5 cursor-grab active:cursor-grabbing hover:border-slate-400 transition relative"
    >
      <div className="text-sm font-medium text-slate-800 truncate">{project.name}</div>
      {project.client_name && project.client_name !== project.name ? (
        <div className="text-[0.7rem] text-slate-500 truncate">{project.client_name}</div>
      ) : null}
      <div className="flex items-center justify-between mt-1.5">
        <div className="text-[0.7rem] text-slate-600">
          {formatBRL(project.total_value)}
        </div>
        {project.project_kind ? (
          <div className="text-[0.65rem] text-slate-400 truncate max-w-[100px]">
            {project.project_kind}
          </div>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => setShowMenu((v) => !v)}
        className="absolute top-1.5 right-1.5 text-slate-400 hover:text-slate-700 text-xs px-1"
        title="Mudar etapa"
      >
        ⋯
      </button>
      {showMenu ? (
        <div
          onMouseLeave={() => setShowMenu(false)}
          className="absolute top-7 right-1 z-10 bg-white rounded-md shadow-lg border border-slate-200 py-1 w-52 max-h-64 overflow-y-auto"
        >
          {STAGES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setShowMenu(false)
                onMove(project.id, s.id)
              }}
              className="block w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50"
            >
              <span className={`inline-block h-1.5 w-1.5 rounded-full mr-2 ${STAGE_TONE_CLASSES[s.tone].dot}`} />
              {s.label}
            </button>
          ))}
        </div>
      ) : null}
      {saving ? (
        <div className="absolute inset-0 bg-white/60 rounded-lg flex items-center justify-center">
          <Loader2 className="h-3 w-3 animate-spin text-slate-500" />
        </div>
      ) : null}
    </div>
  )
}

function ListView({
  rows,
  savingId,
  onMove,
}: {
  rows: ProjectRow[]
  savingId: string | null
  onMove: (projectId: string, stageId: string) => void
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-[0.7rem] uppercase tracking-[0.08em] text-slate-500">
          <tr>
            <th className="px-4 py-2.5 font-medium">Projeto</th>
            <th className="px-4 py-2.5 font-medium">Cliente</th>
            <th className="px-4 py-2.5 font-medium">Tipo</th>
            <th className="px-4 py-2.5 font-medium">Valor</th>
            <th className="px-4 py-2.5 font-medium">Etapa</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const stageId = parseStage(r.notes)
            const stage = STAGE_BY_ID[stageId] ?? STAGES[0]
            const tone = STAGE_TONE_CLASSES[stage.tone]
            return (
              <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-2.5 font-medium text-slate-800">{r.name}</td>
                <td className="px-4 py-2.5 text-slate-600">{r.client_name ?? '—'}</td>
                <td className="px-4 py-2.5 text-slate-500 text-xs">{r.project_kind ?? '—'}</td>
                <td className="px-4 py-2.5 text-slate-700 tabular-nums">
                  {formatBRL(r.total_value)}
                </td>
                <td className="px-4 py-2.5">
                  <Select
                    value={stageId}
                    onValueChange={(v) => v && onMove(r.id, v)}
                    disabled={savingId === r.id}
                  >
                    <SelectTrigger
                      className={`h-8 w-auto min-w-[180px] text-xs ${tone.bg} ${tone.border} ${tone.text}`}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STAGES.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          <span className={`inline-block h-1.5 w-1.5 rounded-full mr-2 ${STAGE_TONE_CLASSES[s.tone].dot}`} />
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
              </tr>
            )
          })}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-slate-400 text-sm">
                Nenhum projeto encontrado.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  )
}

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}
