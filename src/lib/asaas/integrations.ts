// Helpers client-side pra falar com /api/asaas/integrations.
// A api_key NUNCA passa pelo browser — toda manipulação é server-side.

export interface AsaasIntegration {
  id: string
  account_id: string | null
  name: string
  environment: 'production' | 'sandbox'
  webhook_token: string
  active: boolean
  last_sync_at: string | null
  api_key_last4: string  // só os 4 últimos dígitos (mascarado)
  created_at: string
}

export interface CreateIntegrationInput {
  name: string
  environment: 'production' | 'sandbox'
  api_key: string
  account_id?: string | null  // se vazio, cria conta nova com o `name`
}

export async function listIntegrations(): Promise<AsaasIntegration[]> {
  const res = await fetch('/api/asaas/integrations', { cache: 'no-store' })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function createIntegration(input: CreateIntegrationInput): Promise<AsaasIntegration> {
  const res = await fetch('/api/asaas/integrations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function deleteIntegration(id: string): Promise<void> {
  const res = await fetch(`/api/asaas/integrations/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await res.text())
}

export async function toggleIntegration(id: string, active: boolean): Promise<void> {
  const res = await fetch(`/api/asaas/integrations/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ active }),
  })
  if (!res.ok) throw new Error(await res.text())
}

export async function runBackfill(id: string): Promise<{ imported: number; failed: number }> {
  const res = await fetch(`/api/asaas/${id}/backfill`, { method: 'POST' })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export function webhookUrl(integrationId: string, origin: string): string {
  return `${origin}/api/webhooks/asaas/${integrationId}`
}
