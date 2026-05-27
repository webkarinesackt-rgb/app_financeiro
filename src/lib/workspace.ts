import type { WorkspaceType } from '@/types'

export const WORKSPACE_COOKIE = 'workspace'
export const DEFAULT_WORKSPACE: WorkspaceType = 'business'

export function parseWorkspace(value: string | undefined | null): WorkspaceType {
  if (value === 'personal' || value === 'business') return value
  return DEFAULT_WORKSPACE
}

export async function getServerWorkspace(): Promise<WorkspaceType> {
  const { cookies } = await import('next/headers')
  const store = await cookies()
  return parseWorkspace(store.get(WORKSPACE_COOKIE)?.value)
}

// Module-level cache synced by the WorkspaceProvider so client-side lib calls
// agree with the server-rendered context even when document.cookie hasn't
// caught up yet (e.g., right after a setWorkspaceAction + router.refresh()).
let _clientWorkspace: WorkspaceType | null = null

export function setClientWorkspace(value: WorkspaceType): void {
  _clientWorkspace = parseWorkspace(value)
}

export function getClientWorkspace(): WorkspaceType {
  if (_clientWorkspace) return _clientWorkspace
  if (typeof document === 'undefined') return DEFAULT_WORKSPACE
  const match = document.cookie.match(/(?:^|;\s*)workspace=([^;]+)/)
  return parseWorkspace(match?.[1])
}

// Client-side workspace filter. Use INSTEAD of `.eq('workspace', workspace)` on
// SELECTs because PostgREST's schema cache can lag behind DDL changes (PGRST204
// "could not find workspace column"). Filtering server-side fails silently with
// empty results; filtering client-side is resilient to that lag. Rows without
// a workspace value are treated as 'business' (legacy data, default in DB).
export function filterByWorkspace<T extends Record<string, unknown>>(
  rows: T[] | null | undefined,
  workspace: WorkspaceType,
): T[] {
  if (!rows) return []
  return rows.filter((r) => ((r.workspace as string | undefined) ?? 'business') === workspace)
}
