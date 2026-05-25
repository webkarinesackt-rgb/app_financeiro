import { redirect } from 'next/navigation'
import { getServerWorkspace } from '@/lib/workspace'
import { ACobrarClient } from './client'

export default async function ACobrarPage() {
  const workspace = await getServerWorkspace()
  if (workspace !== 'business') redirect('/dashboard')
  return <ACobrarClient />
}
