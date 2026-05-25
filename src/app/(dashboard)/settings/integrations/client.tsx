'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  listIntegrations, createIntegration, deleteIntegration, toggleIntegration,
  runBackfill, runExpenseBackfill, webhookUrl, type AsaasIntegration,
} from '@/lib/asaas/integrations'
import { Plus, Trash2, RefreshCw, Copy, Plug, Loader2, Power, PowerOff, TrendingDown } from 'lucide-react'
import { toast } from 'sonner'

export function IntegrationsClient() {
  const [items, setItems] = useState<AsaasIntegration[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [origin, setOrigin] = useState('')

  useEffect(() => { setOrigin(window.location.origin) }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try { setItems(await listIntegrations()) }
    catch (e) { toast.error('Erro ao carregar', { description: (e as Error).message }) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleDelete(id: string) {
    if (!confirm('Excluir esta integração? As transações importadas continuam, mas perdem o vínculo.')) return
    setBusy(id)
    try {
      await deleteIntegration(id)
      toast.success('Integração removida')
      fetchData()
    } catch (e) { toast.error('Erro ao excluir', { description: (e as Error).message }) }
    finally { setBusy(null) }
  }

  async function handleToggle(id: string, active: boolean) {
    setBusy(id)
    try {
      await toggleIntegration(id, !active)
      fetchData()
    } catch (e) { toast.error('Erro ao alterar status', { description: (e as Error).message }) }
    finally { setBusy(null) }
  }

  async function handleBackfill(id: string) {
    setBusy(id)
    try {
      const r = await runBackfill(id)
      if (r.failed > 0 && r.imported === 0) {
        toast.error(`Backfill falhou — ${r.failed} cobranças não importadas`, {
          description: r.firstError ?? 'Erro desconhecido — ver logs Vercel',
        })
      } else if (r.failed > 0) {
        toast.warning(`Importadas ${r.imported} cobranças`, {
          description: `${r.failed} falharam: ${r.firstError ?? 'ver logs'}`,
        })
      } else {
        toast.success(`Importadas ${r.imported} cobranças`)
      }
      fetchData()
    } catch (e) { toast.error('Erro no backfill', { description: (e as Error).message }) }
    finally { setBusy(null) }
  }

  async function handleExpenseBackfill(id: string) {
    setBusy(id)
    try {
      const r = await runExpenseBackfill(id)
      if (r.failed > 0 && r.imported === 0) {
        toast.error(`Importação falhou — ${r.failed} despesas não importadas`, {
          description: r.firstError ?? 'Erro desconhecido — ver logs Vercel',
        })
      } else {
        toast.success(`${r.imported} despesa(s) importada(s)`, {
          description: `${r.ignoredFysi} transferência(s) para a Fysi ignorada(s)`,
        })
      }
      fetchData()
    } catch (e) { toast.error('Erro na importação de despesas', { description: (e as Error).message }) }
    finally { setBusy(null) }
  }

  function copy(value: string, what: string) {
    navigator.clipboard.writeText(value)
    toast.success(`${what} copiado`)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Integrações</h2>
          <p className="text-sm text-slate-500">Conecte contas externas pra importar transações automaticamente</p>
        </div>
        <Button onClick={() => setFormOpen(true)} size="sm" className="bg-emerald-600 hover:bg-emerald-700 gap-1.5">
          <Plus className="h-4 w-4" /> Nova conta Asaas
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="h-32 bg-slate-100 rounded-xl animate-pulse" />)}</div>
      ) : items.length === 0 ? (
        <Card className="border border-slate-100 shadow-sm">
          <CardContent className="py-16 text-center">
            <Plug className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">Nenhuma integração ainda</p>
            <p className="text-slate-400 text-sm mt-1">Conecte sua conta do Asaas pra importar cobranças</p>
            <Button onClick={() => setFormOpen(true)} size="sm" className="mt-4 bg-emerald-600 hover:bg-emerald-700 gap-1.5">
              <Plus className="h-4 w-4" /> Conectar Asaas
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((it) => {
            const url = webhookUrl(it.id, origin)
            return (
              <Card key={it.id} className="border border-slate-100 shadow-sm">
                <CardContent className="py-4 px-4 space-y-3">
                  {/* Header */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-8 w-8 rounded-lg bg-cyan-100 text-cyan-700 flex items-center justify-center text-xs font-bold shrink-0">A</div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-slate-800 truncate">{it.name}</p>
                          {!it.active && <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">desativada</span>}
                          <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{it.environment}</span>
                        </div>
                        <p className="text-xs text-slate-400 font-mono">key {it.api_key_last4}</p>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => handleBackfill(it.id)} disabled={busy === it.id}
                        title="Importar cobranças passadas"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50">
                        {busy === it.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                      </button>
                      <button onClick={() => handleExpenseBackfill(it.id)} disabled={busy === it.id}
                        title="Importar despesas (transferências de saída)"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50">
                        {busy === it.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <TrendingDown className="h-3.5 w-3.5" />}
                      </button>
                      <button onClick={() => handleToggle(it.id, it.active)} disabled={busy === it.id}
                        title={it.active ? 'Desativar' : 'Ativar'}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50">
                        {it.active ? <Power className="h-3.5 w-3.5" /> : <PowerOff className="h-3.5 w-3.5" />}
                      </button>
                      <button onClick={() => handleDelete(it.id)} disabled={busy === it.id}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Webhook config */}
                  <div className="bg-slate-50 rounded-lg p-3 space-y-2 border border-slate-100">
                    <p className="text-xs text-slate-500 font-medium">Cole isto no painel do Asaas (Integrações → Webhooks):</p>
                    <CopyField label="URL" value={url} onCopy={() => copy(url, 'URL')} />
                    <CopyField label="Token" value={it.webhook_token} onCopy={() => copy(it.webhook_token, 'Token')} mono />
                  </div>

                  {it.last_sync_at && (
                    <p className="text-xs text-slate-400">Última sincronização: {new Date(it.last_sync_at).toLocaleString('pt-BR')}</p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <NewIntegrationDialog open={formOpen} onClose={() => setFormOpen(false)} onSuccess={fetchData} />
    </div>
  )
}

function CopyField({ label, value, onCopy, mono }: { label: string; value: string; onCopy: () => void; mono?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-500 w-12 shrink-0">{label}</span>
      <code className={`flex-1 text-xs bg-white px-2 py-1 rounded border border-slate-200 truncate ${mono ? 'font-mono' : ''}`}>{value}</code>
      <button onClick={onCopy} className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100">
        <Copy className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

function NewIntegrationDialog({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [name, setName] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [env, setEnv] = useState<'production' | 'sandbox'>('production')
  const [saving, setSaving] = useState(false)

  function reset() { setName(''); setApiKey(''); setEnv('production') }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await createIntegration({ name, api_key: apiKey, environment: env })
      toast.success('Integração criada', { description: 'Configure o webhook no Asaas com a URL e o token mostrados.' })
      reset(); onClose(); onSuccess()
    } catch (err) {
      toast.error('Erro ao criar', { description: (err as Error).message })
    } finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Conectar conta Asaas</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome da conta</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Asaas Karine" required />
            <p className="text-xs text-slate-500">Vai criar uma conta no app com esse nome pra agrupar as cobranças.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="env">Ambiente</Label>
            <Select value={env} onValueChange={(v) => setEnv(v as 'production' | 'sandbox')}>
              <SelectTrigger id="env"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="production">Produção</SelectItem>
                <SelectItem value="sandbox">Sandbox</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="api_key">API Key do Asaas</Label>
            <Input id="api_key" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
              placeholder="$aact_..." required autoComplete="off" />
            <p className="text-xs text-slate-500">Pega em Asaas → Integrações → API. Salva criptografada e nunca aparece de novo.</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {saving ? 'Salvando...' : 'Conectar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
