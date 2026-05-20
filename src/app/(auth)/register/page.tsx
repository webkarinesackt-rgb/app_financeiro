'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, Lock } from 'lucide-react'

// Cadastro fechado — apenas usuários autorizados acessam o app.
// Esta página exibe um aviso e redireciona pra /login.
// Pra reabrir cadastro, restaurar do git log.
export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-emerald-600 p-2">
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-slate-800">FinançasPRO</span>
          </div>
        </div>

        <Card className="shadow-lg border-0">
          <CardHeader className="pb-4 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
              <Lock className="h-7 w-7 text-slate-600" />
            </div>
            <CardTitle className="text-xl">Cadastro fechado</CardTitle>
            <CardDescription>
              Este é um app privado. Apenas usuários autorizados podem acessar.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3 pb-6">
            <Link href="/login">
              <Button className="w-full bg-emerald-600 hover:bg-emerald-700">
                Ir para login
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
