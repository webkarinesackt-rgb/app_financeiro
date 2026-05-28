import { redirect } from 'next/navigation'
import { getServerWorkspace } from '@/lib/workspace'
import { EtapasClient } from './client'

export default async function EtapasPage() {
  const workspace = await getServerWorkspace()
  if (workspace !== 'business') redirect('/dashboard')
  return <EtapasClient />
}
