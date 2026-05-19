'use client'

import { useState } from 'react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreVertical, Pencil, Trash2, MessageCircle } from 'lucide-react'
import { toast } from 'sonner'
import { ClosingForm } from './closing-form'
import { deleteClosing } from '@/lib/closings'
import { formatCurrency } from '@/lib/format'
import { CLOSING_STATUS_LABELS, CLOSING_STATUS_COLORS, type Closing } from '@/types'

interface ClosingsTableProps {
  closings: Closing[]
  onRefresh: () => void
}

const formatDate = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

const whatsappLink = (raw: string | null) => {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (!digits) return null
  const withCountry = digits.startsWith('55') ? digits : `55${digits}`
  return `https://wa.me/${withCountry}`
}

export function ClosingsTable({ closings, onRefresh }: ClosingsTableProps) {
  const [editing, setEditing] = useState<Closing | null>(null)

  async function handleDelete(c: Closing) {
    if (!confirm(`Excluir fechamento de "${c.client_name ?? c.name}"?`)) return
    try {
      await deleteClosing(c.id)
      toast.success('Fechamento excluído')
      onRefresh()
    } catch {
      toast.error('Erro ao excluir')
    }
  }

  if (closings.length === 0) {
    return (
      <div className="bg-white border border-dashed border-slate-200 rounded-xl p-10 text-center">
        <p className="text-slate-500 text-sm">Nenhum fechamento neste período.</p>
        <p className="text-slate-400 text-xs mt-1">Clique em &ldquo;Novo Fechamento&rdquo; para registrar o primeiro.</p>
      </div>
    )
  }

  return (
    <>
      {/* Desktop: tabela */}
      <div className="hidden md:block bg-white border border-slate-100 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Data</th>
                <th className="text-left px-4 py-2.5 font-medium">Cliente</th>
                <th className="text-left px-4 py-2.5 font-medium">Projeto</th>
                <th className="text-right px-4 py-2.5 font-medium">Valor</th>
                <th className="text-left px-4 py-2.5 font-medium">Canal</th>
                <th className="text-left px-4 py-2.5 font-medium">Mercado</th>
                <th className="text-left px-4 py-2.5 font-medium">Segmento</th>
                <th className="text-left px-4 py-2.5 font-medium">Status</th>
                <th className="text-left px-4 py-2.5 font-medium">WhatsApp</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {closings.map((c) => {
                const wa = whatsappLink(c.whatsapp)
                return (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">{formatDate(c.start_date)}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-800">{c.client_name ?? c.name}</td>
                    <td className="px-4 py-2.5 text-slate-600">{c.project_kind ?? '—'}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-emerald-700 whitespace-nowrap">
                      {formatCurrency(c.total_value)}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{c.channel ?? '—'}</td>
                    <td className="px-4 py-2.5 text-slate-600">{c.market ?? '—'}</td>
                    <td className="px-4 py-2.5 text-slate-600">{c.segment ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{
                          backgroundColor: `${CLOSING_STATUS_COLORS[c.status]}1A`,
                          color: CLOSING_STATUS_COLORS[c.status],
                        }}
                      >
                        {CLOSING_STATUS_LABELS[c.status]}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {wa ? (
                        <a href={wa} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 text-xs">
                          <MessageCircle className="h-3.5 w-3.5" />
                          {c.whatsapp}
                        </a>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-2 py-2.5">
                      <DropdownMenu>
                        <DropdownMenuTrigger className="inline-flex items-center justify-center h-7 w-7 rounded-md text-slate-400 hover:bg-slate-100 transition-colors">
                          <MoreVertical className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditing(c)}>
                            <Pencil className="h-3.5 w-3.5 mr-2" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(c)}
                            className="text-red-600 focus:text-red-600">
                            <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile: cards */}
      <div className="md:hidden space-y-2">
        {closings.map((c) => {
          const wa = whatsappLink(c.whatsapp)
          return (
            <div key={c.id} className="bg-white border border-slate-100 rounded-xl p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-800 truncate">{c.client_name ?? c.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {formatDate(c.start_date)}
                    {c.project_kind && <> · {c.project_kind}</>}
                  </p>
                </div>
                <div className="flex items-start gap-1">
                  <p className="font-bold text-emerald-700 whitespace-nowrap">{formatCurrency(c.total_value)}</p>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="inline-flex items-center justify-center h-6 w-6 rounded-md text-slate-400 hover:bg-slate-100">
                      <MoreVertical className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEditing(c)}>
                        <Pencil className="h-3.5 w-3.5 mr-2" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDelete(c)} className="text-red-600 focus:text-red-600">
                        <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 mt-2">
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium"
                  style={{
                    backgroundColor: `${CLOSING_STATUS_COLORS[c.status]}1A`,
                    color: CLOSING_STATUS_COLORS[c.status],
                  }}
                >
                  {CLOSING_STATUS_LABELS[c.status]}
                </span>
                {c.channel && <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] bg-slate-100 text-slate-600">{c.channel}</span>}
                {c.market && <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] bg-slate-100 text-slate-600">{c.market}</span>}
                {c.segment && <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] bg-slate-100 text-slate-600">{c.segment}</span>}
              </div>

              {wa && (
                <a href={wa} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-2 text-emerald-600 text-xs">
                  <MessageCircle className="h-3.5 w-3.5" />
                  {c.whatsapp}
                </a>
              )}
            </div>
          )
        })}
      </div>

      {editing && (
        <ClosingForm
          open={!!editing}
          onClose={() => setEditing(null)}
          onSuccess={onRefresh}
          closing={editing}
        />
      )}
    </>
  )
}
