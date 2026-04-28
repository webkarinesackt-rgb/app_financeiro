import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'

const geist = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'FinançasPRO — Controle Financeiro Pessoal',
  description: 'Gerencie suas finanças pessoais de forma simples e visual.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans bg-slate-50">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
