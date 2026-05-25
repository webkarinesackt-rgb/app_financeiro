import { redirect } from 'next/navigation'
import { getServerWorkspace } from '@/lib/workspace'
import { ReservasClient } from './client'

export default async function ReservasPage() {
  const workspace = await getServerWorkspace()
  if (workspace !== 'business') redirect('/dashboard')
  return <ReservasClient />
}
