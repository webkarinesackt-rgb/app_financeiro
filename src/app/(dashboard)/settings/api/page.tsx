'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Key, Plus, Trash2, Copy, AlertCircle, Loader2, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import {
  listApiKeys, createApiKey, revokeApiKey, deleteApiKey,
  type ApiKey, type ApiScope,
} from '@/lib/api-keys'

const SCOPE_LABELS: Record<ApiScope, string> = {
  'read:all': 'Ler tudo (full read)',
  'read:transactions': 'Ler lançamentos',
  'read:accounts': 'Ler contas',
  'read:balances': 'Ler saldos',
  'read:closings': 'Ler fechamentos',
  'write:transactions': 'Criar lançamentos',
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [scopes, setScopes] = useState<ApiScope[]>(['read:all'])
  const [workspace, setWorkspace] = useState<'all' | 'business' | 'personal'>('all')
  const [busy, setBusy] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [showFullKey, setShowFullKey] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try { setKeys(await listApiKeys()) }
    catch (e) { toast.error('Erro ao carregar chaves', { description: (e as Error).message }) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  function toggleScope(s: ApiScope) {
    setScopes((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s])
  }

  async function handleCreate() {
    if (!name.trim()) { toast.error('Nome obrigatório'); return }
    if (scopes.length === 0) { toast.error('Selecione pelo menos um scope'); return }
    setCreating(true)
    try {
      const { fullKey } = await createApiKey({
        name: name.trim(),
        scopes,
        workspace: workspace === 'all' ? null : workspace,
      })
      setShowFullKey(fullKey)
      setName('')
      setScopes(['read:all'])
      setWorkspace('all')
      setCreateOpen(false)
      fetchData()
    } catch (e) {
      toast.error('Erro ao criar chave', { description: (e as Error).message })
    } finally { setCreating(false) }
  }

  async function handleRevoke(id: string) {
    if (!confirm('Revogar esta chave? Sistemas externos vão parar de conseguir conectar.')) return
    setBusy(id)
    try { await revokeApiKey(id); fetchData() }
    catch (e) { toast.error('Erro', { description: (e as Error).message }) }
    finally { setBusy(null) }
  }

  async function handleDelete(id: string) {
    if (!confirm('Apagar permanentemente esta chave?')) return
    setBusy(id)
    try { await deleteApiKey(id); fetchData() }
    catch (e) { toast.error('Erro', { description: (e as Error).message }) }
    finally { setBusy(null) }
  }

  function copy(text: string, label = 'Copiado') {
    navigator.clipboard.writeText(text)
    toast.success(label)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">API Keys</h2>
          <p className="text-sm text-slate-500">Chaves pra integrar sistemas externos com este app.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} size="sm" className="bg-emerald-600 hover:bg-emerald-700 gap-1.5">
          <Plus className="h-4 w-4" /> Nova chave
        </Button>
      </div>

      <Card className="border border-slate-100 shadow-sm">
        <CardContent className="p-4 text-sm space-y-2">
          <div className="flex items-center gap-2 text-slate-700 font-medium">
            <Key className="h-4 w-4" /> Como usar
          </div>
          <p className="text-slate-600">
            Após criar uma chave, use no header das requisições:
          </p>
          <pre className="bg-slate-50 border border-slate-200 rounded-md p-2 text-xs overflow-x-auto">
{`Authorization: Bearer ak_XXXXXXXX_<secret>`}
          </pre>
          <a href="/api/v1" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:underline">
            Ver documentação completa <ExternalLink className="h-3 w-3" />
          </a>
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      ) : keys.length === 0 ? (
        <Card className="border border-slate-100 shadow-sm">
          <CardContent className="py-12 text-center">
            <Key className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">Nenhuma chave criada</p>
            <p className="text-slate-400 text-sm mt-1">Crie uma chave pra começar a integrar</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {keys.map((k) => {
            const revoked = !!k.revoked_at
            return (
              <Card key={k.id} className={`border shadow-sm ${revoked ? 'border-slate-200 bg-slate-50/50 opacity-70' : 'border-slate-100'}`}>
                <CardContent className="p-3 flex items-center gap-3">
                  <Key className="h-4 w-4 text-slate-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-slate-800 truncate">{k.name}</p>
                      <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-mono">{k.prefix}…</code>
                      {revoked && <span className="text-[10px] uppercase font-bold text-slate-500 bg-slate-200 px-1.5 py-0.5 rounded">Revogada</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 flex-wrap">
                      <span>{k.scopes.map((s) => SCOPE_LABELS[s] ?? s).join(', ')}</span>
                      {k.workspace && <span>· workspace: {k.workspace}</span>}
                      {k.last_used_at && <span>· último uso: {new Date(k.last_used_at).toLocaleString('pt-BR')}</span>}
                      {!k.last_used_at && <span>· nunca usada</span>}
                    </div>
                  </div>
                  {!revoked && (
                    <button onClick={() => handleRevoke(k.id)} disabled={busy === k.id}
                      title="Revogar"
                      className="p-1.5 rounded-lg text-amber-500 hover:text-amber-700 hover:bg-amber-50 transition-colors disabled:opacity-50">
                      <AlertCircle className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button onClick={() => handleDelete(k.id)} disabled={busy === k.id}
                    title="Apagar"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Dialog: criar */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova chave de API</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Nome (identificação)</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Integração WhatsApp Bot" />
            </div>
            <div>
              <Label className="text-xs">Permissões</Label>
              <div className="space-y-1.5 mt-1">
                {(Object.keys(SCOPE_LABELS) as ApiScope[]).map((s) => (
                  <label key={s} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={scopes.includes(s)} onChange={() => toggleScope(s)}
                      className="h-4 w-4 rounded border-slate-300" />
                    {SCOPE_LABELS[s]}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs">Workspace</Label>
              <select value={workspace} onChange={(e) => setWorkspace(e.target.value as 'all' | 'business' | 'personal')}
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
                <option value="all">Todos (Fysi + PF)</option>
                <option value="business">Apenas Fysi</option>
                <option value="personal">Apenas PF</option>
              </select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={creating || !name.trim()}
              className="bg-emerald-600 hover:bg-emerald-700">
              {creating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Criar chave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: chave criada (mostra secret 1x) */}
      <Dialog open={!!showFullKey} onOpenChange={() => setShowFullKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chave criada — copie agora</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-md p-3 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                <strong>Este é o único momento em que essa chave completa será exibida.</strong> Copie e salve em local seguro agora. Se perder, será necessário criar uma nova.
              </span>
            </p>
            <div>
              <Label className="text-xs">Chave (use no header Authorization)</Label>
              <div className="flex gap-2 mt-1">
                <code className="flex-1 bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-xs font-mono break-all">
                  {showFullKey}
                </code>
                <Button size="sm" variant="outline" onClick={() => copy(showFullKey!, 'Chave copiada')}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div>
              <Label className="text-xs">Exemplo curl</Label>
              <pre className="bg-slate-50 border border-slate-200 rounded-md p-2 text-xs overflow-x-auto">
{`curl https://app-financeiro-lovat.vercel.app/api/v1/transactions \\
  -H "Authorization: Bearer ${showFullKey}"`}
              </pre>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowFullKey(null)} className="bg-emerald-600 hover:bg-emerald-700">
              Fechei e copiei
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
