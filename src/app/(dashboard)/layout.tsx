import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/dashboard/sidebar'
import { MobileNav } from '@/components/dashboard/mobile-nav'
import { WorkspaceProvider } from '@/components/workspace/workspace-provider'
import { getServerWorkspace } from '@/lib/workspace'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const workspace = await getServerWorkspace()

  return (
    <WorkspaceProvider value={workspace}>
      <div className="flex min-h-screen bg-canvas">
        <div className="hidden md:flex print:hidden">
          <Sidebar />
        </div>
        <div className="print:hidden">
          <MobileNav />
        </div>
        <main className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 p-4 md:p-8 pb-32 md:pb-8">
            {children}
          </div>
        </main>
      </div>
    </WorkspaceProvider>
  )
}
