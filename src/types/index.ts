// ─── Transaction Types ───────────────────────────────────────────────────────

export type TransactionType = 'income' | 'expense'
export type RecurrenceInterval = 'daily' | 'weekly' | 'monthly' | 'yearly'
export type PaymentMethod = 'pix' | 'debit' | 'credit' | 'cash' | 'transfer' | 'boleto' | 'other'

export type Category =
  | 'salary' | 'freelance' | 'project' | 'consulting' | 'commission'
  | 'bonus' | 'rental' | 'digital_products' | 'investment' | 'gift' | 'refund'
  | 'food' | 'transport' | 'housing' | 'health' | 'education'
  | 'entertainment' | 'clothing' | 'utilities' | 'subscriptions' | 'insurance' | 'taxes'
  | 'other' | 'custom'

export interface Transaction {
  id: string
  user_id: string
  type: TransactionType
  amount: number
  description: string
  category: Category
  custom_category: string | null
  date: string
  account_id: string | null
  credit_card_id: string | null
  payment_method: PaymentMethod | null
  installment_total: number | null
  installment_current: number | null
  installment_group_id: string | null
  notes: string | null
  is_recurring: boolean
  recurrence_interval: RecurrenceInterval | null
  created_at: string
  updated_at: string
}

export interface TransactionFormData {
  type: TransactionType
  amount: number
  description: string
  category: Category
  custom_category: string | null
  date: string
  account_id: string | null
  credit_card_id: string | null
  payment_method: PaymentMethod | null
  installment_total: number | null
  notes: string | null
  is_recurring: boolean
  recurrence_interval: RecurrenceInterval | null
}

// ─── Account Types ────────────────────────────────────────────────────────────

export type AccountType = 'checking' | 'savings' | 'cash' | 'investment' | 'other'

export interface Account {
  id: string
  user_id: string
  name: string
  type: AccountType
  bank: string | null
  color: string
  initial_balance: number
  include_in_total: boolean
  created_at: string
  updated_at: string
}

// ─── Credit Card Types ────────────────────────────────────────────────────────

export interface CreditCard {
  id: string
  user_id: string
  name: string
  bank: string | null
  color: string
  credit_limit: number
  closing_day: number | null
  due_day: number | null
  created_at: string
  updated_at: string
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface DashboardSummary {
  totalIncome: number
  totalExpenses: number
  balance: number
}

export interface CategoryExpense {
  category: Category
  customLabel?: string
  amount: number
  percentage: number
}

export interface AccountWithBalance extends Account {
  currentBalance: number
}

export interface CreditCardWithUsage extends CreditCard {
  currentInvoice: number
}

// ─── Labels & Constants ───────────────────────────────────────────────────────

export const CATEGORY_LABELS: Record<Category, string> = {
  salary: 'Salário', freelance: 'Freelance', project: 'Projeto',
  consulting: 'Consultoria', commission: 'Comissão', bonus: 'Bônus',
  rental: 'Aluguel', digital_products: 'Produtos Digitais', investment: 'Investimentos',
  gift: 'Presente', refund: 'Reembolso', food: 'Alimentação', transport: 'Transporte',
  housing: 'Moradia', health: 'Saúde', education: 'Educação', entertainment: 'Lazer',
  clothing: 'Vestuário', utilities: 'Contas', subscriptions: 'Assinaturas',
  insurance: 'Seguro', taxes: 'Impostos', other: 'Outros', custom: 'Personalizada',
}

export const RECURRENCE_LABELS: Record<RecurrenceInterval, string> = {
  daily: 'Diária', weekly: 'Semanal', monthly: 'Mensal', yearly: 'Anual',
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  pix: 'Pix', debit: 'Débito', credit: 'Crédito', cash: 'Dinheiro',
  transfer: 'Transferência', boleto: 'Boleto', other: 'Outro',
}

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  checking: 'Conta Corrente', savings: 'Poupança', cash: 'Dinheiro',
  investment: 'Investimentos', other: 'Outros',
}

export const INCOME_CATEGORIES: Category[] = [
  'salary', 'freelance', 'project', 'consulting', 'commission', 'bonus',
  'rental', 'digital_products', 'investment', 'gift', 'refund', 'other', 'custom',
]

export const EXPENSE_CATEGORIES: Category[] = [
  'food', 'transport', 'housing', 'health', 'education', 'entertainment',
  'clothing', 'utilities', 'subscriptions', 'insurance', 'taxes', 'other', 'custom',
]

export const ACCOUNT_PAYMENT_METHODS: PaymentMethod[] = ['pix', 'debit', 'cash', 'transfer', 'boleto', 'other']
export const CARD_PAYMENT_METHODS: PaymentMethod[] = ['credit']

export const CATEGORY_COLORS: Record<Category, string> = {
  salary: '#10b981', freelance: '#3b82f6', project: '#0ea5e9', consulting: '#6366f1',
  commission: '#8b5cf6', bonus: '#a855f7', rental: '#ec4899', digital_products: '#06b6d4',
  investment: '#14b8a6', gift: '#f97316', refund: '#84cc16', food: '#f59e0b',
  transport: '#6366f1', housing: '#ec4899', health: '#14b8a6', education: '#f97316',
  entertainment: '#a855f7', clothing: '#06b6d4', utilities: '#84cc16', subscriptions: '#e879f9',
  insurance: '#fb923c', taxes: '#f43f5e', other: '#94a3b8', custom: '#64748b',
}

export const BANKS = [
  { id: 'nubank', name: 'Nubank', color: '#8B5CF6' },
  { id: 'inter', name: 'Banco Inter', color: '#F97316' },
  { id: 'itau', name: 'Itaú', color: '#FF6B00' },
  { id: 'bradesco', name: 'Bradesco', color: '#CC0000' },
  { id: 'santander', name: 'Santander', color: '#EC0000' },
  { id: 'caixa', name: 'Caixa Econômica', color: '#0070AF' },
  { id: 'bb', name: 'Banco do Brasil', color: '#F7C31B' },
  { id: 'c6', name: 'C6 Bank', color: '#343434' },
  { id: 'btg', name: 'BTG Pactual', color: '#1A1A2E' },
  { id: 'sicoob', name: 'Sicoob', color: '#00A859' },
  { id: 'picpay', name: 'PicPay', color: '#21C25E' },
  { id: 'mercadopago', name: 'Mercado Pago', color: '#009EE3' },
  { id: 'xp', name: 'XP Investimentos', color: '#111827' },
  { id: 'will', name: 'Will Bank', color: '#F59E0B' },
  { id: 'other', name: 'Outro banco', color: '#94A3B8' },
] as const

export function getCategoryLabel(category: Category, customCategory?: string | null): string {
  if (category === 'custom' && customCategory) return customCategory
  return CATEGORY_LABELS[category]
}

export function getBankName(bankId: string | null | undefined): string {
  if (!bankId) return 'Banco'
  return BANKS.find(b => b.id === bankId)?.name ?? bankId
}

export function getBankColor(bankId: string | null | undefined): string {
  if (!bankId) return '#94A3B8'
  return BANKS.find(b => b.id === bankId)?.color ?? '#94A3B8'
}
