import { redirect } from 'next/navigation'
import { getServerWorkspace } from '@/lib/workspace'
import { PanoramaClient } from './client'

export default async function PanoramaPage() {
  const workspace = await getServerWorkspace()
  if (workspace !== 'business') redirect('/dashboard')
  return <PanoramaClient />
}
