import { createClient } from '@/lib/supabase/client'
import { getClientWorkspace, filterByWorkspace } from '@/lib/workspace'

export type ReminderType = 'payment_due' | 'invoice_pending'

export interface Reminder {
  id: string
  user_id: string
  type: ReminderType
  title: string
  amount: number | null
  due_date: string | null
  notes: string | null
  completed: boolean
  completed_at: string | null
  created_at: string
  updated_at: string
}

export type ReminderInput = Pick<Reminder, 'type' | 'title'> &
  Partial<Pick<Reminder, 'amount' | 'due_date' | 'notes'>>

export async function listReminders(type: ReminderType, opts: { completed?: boolean } = {}): Promise<Reminder[]> {
  const supabase = createClient()
  const workspace = getClientWorkspace()
  let q = supabase.from('reminders').select('*').eq('type', type)
  if (typeof opts.completed === 'boolean') q = q.eq('completed', opts.completed)
  const { data, error } = await q.order('due_date', { ascending: true, nullsFirst: false })
  if (error) throw error
  return filterByWorkspace(data, workspace) as Reminder[]
}

export async function createReminder(input: ReminderInput): Promise<Reminder> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')
  const workspace = getClientWorkspace()
  const { data, error } = await supabase
    .from('reminders')
    .insert({ ...input, user_id: user.id, workspace })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateReminder(id: string, patch: Partial<ReminderInput>): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('reminders').update(patch).eq('id', id)
  if (error) throw error
}

export async function completeReminder(id: string, completed: boolean): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('reminders')
    .update({ completed, completed_at: completed ? new Date().toISOString() : null })
    .eq('id', id)
  if (error) throw error
}

export async function deleteReminder(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('reminders').delete().eq('id', id)
  if (error) throw error
}
