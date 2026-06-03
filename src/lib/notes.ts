import { createClient } from '@/lib/supabase/client'
import { getClientWorkspace, filterByWorkspace } from '@/lib/workspace'

export interface Note {
  id: string
  user_id: string
  workspace: 'business' | 'personal'
  title: string
  body: string | null
  pinned: boolean
  created_at: string
  updated_at: string
}

export async function listNotes(): Promise<Note[]> {
  const supabase = createClient()
  const workspace = getClientWorkspace()
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return filterByWorkspace(data, workspace) as Note[]
}

export async function createNote(data: { title: string; body?: string | null }): Promise<Note> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')
  const workspace = getClientWorkspace()

  const payload = {
    user_id: user.id,
    workspace,
    title: data.title,
    body: data.body ?? null,
    pinned: false,
  }

  const { data: row, error } = await supabase.from('notes').insert(payload).select().single()
  if (!error) return row as Note

  // Fallback: PGRST204 (workspace fora do cache) — insere sem workspace
  if (error.code === 'PGRST204' && /workspace/i.test(error.message)) {
    const { workspace: _ws, ...noWs } = payload
    void _ws
    const retry = await supabase.from('notes').insert(noWs).select().single()
    if (retry.error) throw retry.error
    if (workspace !== 'business') {
      await supabase.from('notes').update({ workspace }).eq('id', retry.data.id)
    }
    return retry.data as Note
  }
  throw error
}

export async function updateNote(id: string, patch: { title?: string; body?: string | null; pinned?: boolean }): Promise<Note> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('notes')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as Note
}

export async function deleteNote(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('notes').delete().eq('id', id)
  if (error) throw error
}
