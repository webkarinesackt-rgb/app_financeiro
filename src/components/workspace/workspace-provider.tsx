'use client'

import { createContext, type ReactNode } from 'react'
import type { WorkspaceType } from '@/types'
import { setClientWorkspace } from '@/lib/workspace'

export const WorkspaceContext = createContext<WorkspaceType>('business')

export function WorkspaceProvider({ value, children }: { value: WorkspaceType; children: ReactNode }) {
  // Sync the module-level client cache so client lib calls (getTransactions,
  // getAccounts, etc.) see the same workspace as the server-rendered context.
  setClientWorkspace(value)
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}
