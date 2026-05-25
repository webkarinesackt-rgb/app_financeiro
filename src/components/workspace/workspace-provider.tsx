'use client'

import { createContext, type ReactNode } from 'react'
import type { WorkspaceType } from '@/types'

export const WorkspaceContext = createContext<WorkspaceType>('business')

export function WorkspaceProvider({
  value,
  children,
}: {
  value: WorkspaceType
  children: ReactNode
}) {
  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  )
}
