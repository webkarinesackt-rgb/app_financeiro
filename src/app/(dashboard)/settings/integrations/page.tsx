import { redirect } from 'next/navigation'
import { getServerWorkspace } from '@/lib/workspace'
import { IntegrationsClient } from './client'

export default async function IntegrationsPage() {
  const workspace = await getServerWorkspace()
  if (workspace !== 'business') redirect('/dashboard')
  return <IntegrationsClient />
}
