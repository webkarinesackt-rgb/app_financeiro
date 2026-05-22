'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Lock } from 'lucide-react'
import { Logo } from '@/components/brand/logo'

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo size="lg" showText={false} />
          <div className="mt-1">
            <h1 className="font-display text-4xl text-stone-900 tracking-tight leading-none">
              Fysi<span className="text-[color:var(--brand)]">.</span>
            </h1>
            <p className="eyebrow text-stone-500 mt-2">finanças privado</p>
          </div>
        </div>

        <Card className="border-stone-200/60 shadow-xl shadow-stone-900/5 bg-white/95 backdrop-blur-sm">
          <CardHeader className="pb-4 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-stone-100">
              <Lock className="h-6 w-6 text-stone-700" />
            </div>
            <CardTitle className="font-display text-xl text-stone-900">Cadastro fechado</CardTitle>
            <CardDescription className="text-stone-500">
              Este é um app privado. Apenas usuários autorizados podem acessar.
            </CardDescription>
          </CardHeader>

          <CardContent className="pb-6">
            <Link href="/login">
              <Button className="w-full h-11 bg-stone-900 hover:bg-stone-800 text-white">
                Ir para login
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
