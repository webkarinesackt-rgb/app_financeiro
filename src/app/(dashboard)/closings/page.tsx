import { redirect } from 'next/navigation'
import { getServerWorkspace } from '@/lib/workspace'
import { ClosingsClient } from './client'

export default async function ClosingsPage() {
  const workspace = await getServerWorkspace()
  if (workspace !== 'business') redirect('/dashboard')
  return <ClosingsClient />
}
