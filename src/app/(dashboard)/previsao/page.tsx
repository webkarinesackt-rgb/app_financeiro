import { redirect } from 'next/navigation'
import { getServerWorkspace } from '@/lib/workspace'
import { PrevisaoClient } from './client'

export default async function PrevisaoPage() {
  const workspace = await getServerWorkspace()
  if (workspace !== 'business') redirect('/dashboard')
  return <PrevisaoClient />
}
