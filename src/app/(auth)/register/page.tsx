'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, Loader2, MailCheck, AlertTriangle, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()

    if (password !== confirmPassword) {
      toast.error('As senhas não coincidem')
      return
    }

    if (password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({ email, password })

    if (error) {
      toast.error('Erro ao criar conta', { description: error.message })
      setLoading(false)
      return
    }

    setConfirmed(true)
  }

  if (confirmed) {
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
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
                <MailCheck className="h-7 w-7 text-emerald-600" />
              </div>
              <CardTitle className="text-xl">Confirme seu e-mail</CardTitle>
              <CardDescription>
                Quase lá! Só falta um passo.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4 pb-2">
              <p className="text-sm text-slate-600 text-center">
                Enviamos um link de confirmação para:
              </p>
              <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-2 text-center">
                <span className="text-sm font-semibold text-slate-800">{email}</span>
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-sm font-semibold text-amber-800">Verifique também o SPAM</p>
                </div>
                <p className="text-xs text-amber-700 pl-6">
                  Às vezes o e-mail de confirmação pode cair na pasta de Lixo Eletrônico
                  ou Spam. Se não encontrar na caixa de entrada, confira lá antes de tentar novamente.
                </p>
              </div>

              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">1</span>
                  Abra o e-mail com assunto <strong>"Confirm your signup"</strong>
                </li>
                <li className="flex items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">2</span>
                  Clique no botão de confirmação do link
                </li>
                <li className="flex items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">3</span>
                  Volte aqui e faça seu login
                </li>
              </ul>
            </CardContent>

            <CardFooter className="flex flex-col gap-3 pt-4">
              <Link href="/login" className="w-full">
                <Button className="w-full bg-emerald-600 hover:bg-emerald-700 gap-2">
                  Ir para o login
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <button
                onClick={() => setConfirmed(false)}
                className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
              >
                Cadastrei o e-mail errado? Tentar novamente
              </button>
            </CardFooter>
          </Card>
        </div>
      </div>
    )
  }

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
          <p className="text-slate-500 text-sm">Controle suas finanças com simplicidade</p>
        </div>

        <Card className="shadow-lg border-0">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl text-center">Criar conta</CardTitle>
            <CardDescription className="text-center">
              Preencha os dados para começar
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleRegister}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar senha</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Repita a senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3 pt-2">
              <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {loading ? 'Criando conta...' : 'Criar conta'}
              </Button>
              <p className="text-sm text-slate-500 text-center">
                Já tem uma conta?{' '}
                <Link href="/login" className="text-emerald-600 hover:underline font-medium">
                  Fazer login
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}
