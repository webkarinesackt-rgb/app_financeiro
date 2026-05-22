'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { Logo } from '@/components/brand/logo'
import { toast } from 'sonner'

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const notAllowed = searchParams.get('error') === 'not_allowed'

  useEffect(() => {
    if (notAllowed) {
      toast.error('Acesso negado', { description: 'Este e-mail não está autorizado.' })
    }
  }, [notAllowed])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      console.error('[login] supabase error:', error)
      toast.error('Erro ao entrar', { description: error.message })
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

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
          <CardHeader className="space-y-1 pb-3">
            <CardTitle className="font-display text-2xl text-center text-stone-900">Entrar</CardTitle>
            <CardDescription className="text-center text-stone-500 text-sm">
              Acesse sua conta autorizada
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs uppercase tracking-wider text-stone-600 font-semibold">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="h-11"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs uppercase tracking-wider text-stone-600 font-semibold">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="h-11"
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3 pt-2">
              <Button type="submit"
                className="w-full h-11 bg-stone-900 hover:bg-stone-800 text-white font-medium tracking-wide"
                disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {loading ? 'Entrando' : 'Entrar'}
              </Button>
            </CardFooter>
          </form>
        </Card>

        <p className="text-[11px] text-stone-400 text-center tracking-wide">
          ACESSO RESTRITO · APENAS USUÁRIOS AUTORIZADOS
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}
