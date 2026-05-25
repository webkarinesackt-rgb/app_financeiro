'use client'

import { useContext } from 'react'
import { WorkspaceContext } from '@/components/workspace/workspace-provider'

export function useWorkspace() {
  return useContext(WorkspaceContext)
}
