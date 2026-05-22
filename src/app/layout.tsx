import type { Metadata } from 'next'
import { Geist, Fraunces } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'

const geist = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const fraunces = Fraunces({
  variable: '--font-display',
  subsets: ['latin'],
  axes: ['SOFT', 'WONK', 'opsz'],
  style: ['normal', 'italic'],
})

export const metadata: Metadata = {
  title: 'Fysi Finanças',
  description: 'Controle financeiro da Fysi Lab.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${geist.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans bg-canvas">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
