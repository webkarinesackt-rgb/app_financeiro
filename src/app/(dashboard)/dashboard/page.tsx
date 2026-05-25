'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getAccountsWithBalances } from '@/lib/accounts'
import { getCreditCardsWithUsage } from '@/lib/credit-cards'
import { getTransactions } from '@/lib/transactions'
import { formatCurrency } from '@/lib/format'
import { getCategoryLabel, getCategoryLabelByWorkspace, getBankColor, type AccountWithBalance, type CreditCardWithUsage, type Transaction, type Category } from '@/types'
import { useWorkspace } from '@/hooks/use-workspace'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { TransactionForm } from '@/components/transactions/transaction-form'
import { RecentTransactions } from '@/components/dashboard/recent-transactions'
import { ExpenseChart } from '@/components/dashboard/expense-chart'
import { AsaasForecast } from '@/components/dashboard/asaas-forecast'
import { OverdueList } from '@/components/dashboard/overdue-list'
import { RemindersCard } from '@/components/dashboard/reminders-card'
import { ReceivedSection } from '@/components/dashboard/received-section'
import { SectionHeader } from '@/components/dashboard/section-header'
import { AwaitingSettlement } from '@/components/dashboard/awaiting-settlement'
import { Calendar, AlertTriangle, ListChecks, Clock } from 'lucide-react'
import { TrendingDown, TrendingUp, Plus, Wallet, CreditCard, Eye, EyeOff } from 'lucide-react'

const MONTHS_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

export default function DashboardPage() {
  const workspace = useWorkspace()
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()

  const [userEmail, setUserEmail] = useState('')
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([])
  const [cards, setCards] = useState<CreditCardWithUsage[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [prevTransactions, setPrevTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [showBalances, setShowBalances] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formType, setFormType] = useState<'income' | 'expense'>('expense')

  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const [{ data: { user } }, accs, crds, txs, prevTxs] = await Promise.all([
      supabase.auth.getUser(),
      getAccountsWithBalances(),
      getCreditCardsWithUsage(month, year),
      getTransactions({ month, year }),
      getTransactions({ month: prevMonth, year: prevYear }),
    ])
    setUserEmail(user?.email?.split('@')[0] ?? 'Usuário')
    setAccounts(accs)
    setCards(crds)
    setTransactions(txs)
    setPrevTransactions(prevTxs)
    setLoading(false)
  }, [month, year, prevMonth, prevYear])

  useEffect(() => { fetchData() }, [fetchData])

  const totalIncome = transactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const totalExpenses = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const operationalAccounts = accounts.filter((a) => a.kind !== 'reserve')
  const reserveAccounts = accounts.filter((a) => a.kind === 'reserve')
  const saldoGeral = operationalAccounts.filter((a) => a.include_in_total).reduce((s, a) => s + a.currentBalance, 0)
  const totalReservas = reserveAccounts.reduce((s, a) => s + a.currentBalance, 0)
  const totalFaturas = cards.reduce((s, c) => s + c.currentInvoice, 0)

  // Category data for chart
  const expensesByCategory = transactions
    .filter((t) => t.type === 'expense')
    .reduce<Record<string, { amount: number; label: string }>>((acc, t) => {
      const key = t.category === 'custom' ? (t.custom_category ?? 'custom') : t.category
      const label = getCategoryLabelByWorkspace(workspace, t.category, t.custom_category)
      acc[key] = { amount: (acc[key]?.amount ?? 0) + t.amount, label }
      return acc
    }, {})

  const categoryData = Object.entries(expensesByCategory)
    .map(([category, { amount, label }]) => ({
      category: category as Category,
      customLabel: label,
      amount,
      percentage: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount)

  function openForm(type: 'income' | 'expense') {
    setFormType(type)
    setShowForm(true)
  }

  const fmt = (v: number) => showBalances ? formatCurrency(v) : '••••••'

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Greeting */}
      <Card className="border border-slate-100 shadow-sm">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-500 text-sm">{getGreeting()},</p>
              <h1 className="text-lg font-bold text-slate-800 capitalize leading-tight">{userEmail}!</h1>
            </div>
            <button onClick={() => setShowBalances(!showBalances)}
              className="flex items-center justify-center h-8 w-8 rounded-full text-slate-400 hover:bg-slate-100 transition-colors">
              {showBalances ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* ═══ RECEBIDO ═══ */}
      <ReceivedSection
        transactions={transactions}
        prevTransactions={prevTransactions}
        accounts={accounts}
        monthLabel={MONTHS_PT[month - 1]}
        prevMonthLabel={MONTHS_PT[prevMonth - 1]}
      />

      {/* ═══ AGUARDANDO REPASSE (CONFIRMED) ═══ */}
      <section>
        <SectionHeader icon={<Clock />} title="Aguardando repasse" accent="blue" />
        <AwaitingSettlement />
      </section>

      {/* ═══ A RECEBER ═══ */}
      <section>
        <SectionHeader icon={<Calendar />} title="A receber (Asaas)" accent="emerald" />
        <AsaasForecast />
      </section>

      {/* ═══ ATRASADO ═══ */}
      <section>
        <SectionHeader icon={<AlertTriangle />} title="Cobranças atrasadas" accent="amber" />
        <OverdueList />
      </section>

      {/* ═══ PENDÊNCIAS MANUAIS ═══ */}
      <section>
        <SectionHeader icon={<ListChecks />} title="Suas pendências" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <RemindersCard type="invoice_pending" />
          <RemindersCard type="payment_due" />
        </div>
      </section>

      {/* Chart + recent transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ExpenseChart data={categoryData} />
        <RecentTransactions transactions={transactions} />
      </div>

      {/* ═══ DESPESAS DO MÊS + QUICK ACTIONS (movido para o final) ═══ */}
      <Card className="border border-slate-100 shadow-sm">
        <CardContent className="pt-4 pb-4">
          <div className="bg-red-50 rounded-xl px-3 py-2.5 mb-4">
            <p className="text-[11px] text-red-500 font-medium mb-0.5">Despesas em {MONTHS_PT[month - 1]}</p>
            <p className="text-base font-bold text-red-600 leading-tight">{fmt(totalExpenses)}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => openForm('expense')}
              className="flex items-center justify-center gap-2 h-10 rounded-xl bg-red-500 text-white text-sm font-semibold active:scale-95 transition-transform shadow-sm shadow-red-200"
            >
              <TrendingDown className="h-4 w-4" />
              Despesa
            </button>
            <button
              onClick={() => openForm('income')}
              className="flex items-center justify-center gap-2 h-10 rounded-xl bg-emerald-600 text-white text-sm font-semibold active:scale-95 transition-transform shadow-sm shadow-emerald-200"
            >
              <TrendingUp className="h-4 w-4" />
              Receita
            </button>
          </div>
        </CardContent>
      </Card>

      {/* ═══ SALDO GERAL + FATURAS (movido para o final) ═══ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Contas operacionais */}
        <Card className="border border-slate-100 shadow-sm">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 rounded-full bg-emerald-500" />
                <span className="text-sm text-slate-500">Saldo geral</span>
              </div>
              <button onClick={() => setShowBalances(!showBalances)} className="text-slate-400 hover:text-slate-600">
                {showBalances ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-2xl font-bold text-slate-800 mb-4">{fmt(saldoGeral)}</p>

            <h3 className="text-sm font-semibold text-slate-700 mb-3">Minhas contas</h3>
            {loading ? (
              <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-10 bg-slate-100 rounded-lg animate-pulse" />)}</div>
            ) : operationalAccounts.length === 0 ? (
              <div className="flex flex-col items-center py-4 gap-2">
                <Wallet className="h-8 w-8 text-slate-300" />
                <p className="text-sm text-slate-400">Adicione sua primeira conta</p>
              </div>
            ) : (
              <div className="space-y-2">
                {operationalAccounts.map((acc) => (
                  <div key={acc.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{ backgroundColor: getBankColor(acc.bank) }}>
                        {acc.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-700">{acc.name}</p>
                        <p className="text-xs text-slate-400">{acc.type === 'checking' ? 'Corrente' : acc.type === 'savings' ? 'Poupança' : acc.type === 'cash' ? 'Dinheiro' : acc.type}</p>
                      </div>
                    </div>
                    <p className={`text-sm font-semibold ${acc.currentBalance >= 0 ? 'text-slate-700' : 'text-red-500'}`}>
                      {fmt(acc.currentBalance)}
                    </p>
                  </div>
                ))}
              </div>
            )}
            <Link href="/settings/accounts">
              <Button variant="outline" size="sm" className="w-full mt-3 text-xs h-8">
                Gerenciar contas
              </Button>
            </Link>

            {reserveAccounts.length > 0 && (
              <div className="mt-5 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-700">Reservas</h3>
                  <Link href="/reservas" className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">
                    Ver tudo →
                  </Link>
                </div>
                <p className="text-xl font-bold text-slate-800 mb-3">{fmt(totalReservas)}</p>
                <div className="space-y-1.5">
                  {reserveAccounts.slice(0, 3).map((acc) => (
                    <div key={acc.id} className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 truncate">{acc.name}</span>
                      <span className="font-semibold text-slate-700 whitespace-nowrap">{fmt(acc.currentBalance)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cartões */}
        <Card className="border border-slate-100 shadow-sm">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1 h-5 rounded-full bg-blue-500" />
              <span className="text-sm text-slate-500">Todas as faturas</span>
            </div>
            <p className="text-2xl font-bold text-slate-800 mb-4">{fmt(totalFaturas)}</p>

            <h3 className="text-sm font-semibold text-slate-700 mb-3">Meus cartões</h3>
            {loading ? (
              <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-10 bg-slate-100 rounded-lg animate-pulse" />)}</div>
            ) : cards.length === 0 ? (
              <div className="flex flex-col items-center py-4 gap-2">
                <CreditCard className="h-8 w-8 text-slate-300" />
                <p className="text-sm text-slate-400">Adicione seu primeiro cartão</p>
              </div>
            ) : (
              <div className="space-y-2">
                {cards.map((card) => {
                  const usedPct = card.credit_limit > 0 ? Math.min((card.currentInvoice / card.credit_limit) * 100, 100) : 0
                  return (
                    <div key={card.id} className="py-2 border-b border-slate-50 last:border-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-md flex items-center justify-center text-white text-xs font-bold shrink-0"
                            style={{ backgroundColor: card.color }}>
                            {card.name.charAt(0).toUpperCase()}
                          </div>
                          <p className="text-sm font-medium text-slate-700">{card.name}</p>
                        </div>
                        <p className="text-sm font-semibold text-red-500">{fmt(card.currentInvoice)}</p>
                      </div>
                      {card.credit_limit > 0 && (
                        <div className="ml-9">
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all"
                              style={{ width: `${usedPct}%`, backgroundColor: usedPct > 80 ? '#ef4444' : card.color }} />
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">{fmt(card.currentInvoice)} de {fmt(card.credit_limit)}</p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
            <Link href="/settings/cards">
              <Button variant="outline" size="sm" className="w-full mt-3 text-xs h-8">
                Gerenciar cartões
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Quick-add via Link */}
      <div className="hidden md:flex fixed bottom-6 right-6 flex-col gap-2 items-end">
        <Link href="/transactions">
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 shadow-lg gap-1.5 rounded-full px-4">
            <Plus className="h-4 w-4" /> Nova transação
          </Button>
        </Link>
      </div>

      <TransactionForm
        open={showForm}
        defaultType={formType}
        onClose={() => setShowForm(false)}
        onSuccess={fetchData}
      />
    </div>
  )
}
