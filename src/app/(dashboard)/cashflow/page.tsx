import { redirect } from 'next/navigation'
import { getServerWorkspace } from '@/lib/workspace'
import { CashFlowClient } from './client'

export default async function CashFlowPage() {
  const workspace = await getServerWorkspace()
  if (workspace !== 'business') redirect('/dashboard')
  return <CashFlowClient />
}
