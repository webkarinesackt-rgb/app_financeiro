'use server'

import { cookies } from 'next/headers'
import type { WorkspaceType } from '@/types'
import { WORKSPACE_COOKIE, parseWorkspace } from './workspace'

export async function setWorkspaceAction(value: WorkspaceType): Promise<void> {
  const store = await cookies()
  store.set(WORKSPACE_COOKIE, parseWorkspace(value), {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })
}
