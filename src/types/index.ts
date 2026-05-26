// ─── Transaction Types ───────────────────────────────────────────────────────

export type TransactionType = 'income' | 'expense'
export type RecurrenceInterval = 'daily' | 'weekly' | 'monthly' | 'yearly'
export type PaymentMethod = 'pix' | 'debit' | 'credit' | 'cash' | 'transfer' | 'boleto' | 'other'

// ─── Workspace Types ─────────────────────────────────────────────────────────

export type WorkspaceType = 'business' | 'personal'

export const WORKSPACE_LABELS: Record<WorkspaceType, string> = {
  business: 'Fysi',
  personal: 'Pessoal',
}

export type Category =
  | 'salary' | 'freelance' | 'project' | 'consulting' | 'commission'
  | 'bonus' | 'rental' | 'digital_products' | 'investment' | 'gift' | 'refund'
  | 'food' | 'transport' | 'housing' | 'health' | 'education'
  | 'entertainment' | 'clothing' | 'utilities' | 'subscriptions' | 'insurance' | 'taxes'
  | 'other' | 'custom'

export interface Transaction {
  id: string
  user_id: string
  workspace: WorkspaceType
  type: TransactionType
  amount: number
  description: string
  category: Category
  custom_category: string | null
  subcategory: string | null
  date: string
  account_id: string | null
  credit_card_id: string | null
  integration_id: string | null
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
  subcategory: string | null
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
export type AccountKind = 'operational' | 'reserve'

export interface Account {
  id: string
  user_id: string
  workspace: WorkspaceType
  name: string
  type: AccountType
  kind: AccountKind
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
  workspace: WorkspaceType
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

// ─── Closings (Projetos/Fechamentos do mês) ──────────────────────────────────

export type ClosingStatus = 'closed' | 'in_production' | 'delivered' | 'paid' | 'cancelled'

export interface Closing {
  id: string
  user_id: string
  name: string
  client_name: string | null
  project_kind: string | null
  total_value: number
  channel: string | null
  market: string | null
  business_model: string | null
  segment: string | null
  whatsapp: string | null
  start_date: string
  status: ClosingStatus
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ClosingFormData {
  client_name: string
  project_kind: string | null
  total_value: number
  channel: string | null
  market: string | null
  business_model: string | null
  segment: string | null
  whatsapp: string | null
  start_date: string
  status: ClosingStatus
  notes: string | null
}

export const CLOSING_STATUS_LABELS: Record<ClosingStatus, string> = {
  closed: 'Fechado · Criar pasta',
  in_production: 'Em produção',
  delivered: 'Entregue',
  paid: 'Pago',
  cancelled: 'Cancelado',
}

export const CLOSING_STATUS_COLORS: Record<ClosingStatus, string> = {
  closed: '#10b981',
  in_production: '#f59e0b',
  delivered: '#3b82f6',
  paid: '#22c55e',
  cancelled: '#ef4444',
}

export const PROJECT_KINDS = [
  'Site Institucional',
  'Landing Page',
  'Landing Page + Copy',
  'Identidade Visual',
  'Slide',
  'Tráfego Pago',
  'Consultoria',
  'Outro',
] as const

export const CLOSING_CHANNELS = [
  'Instagram',
  'Indicação',
  'Anúncios Landing Page',
  'Site',
  'WhatsApp',
  'Outro',
] as const

export const CLOSING_MARKETS = [
  'Imobiliário',
  'Saúde',
  'Jurídico',
  'Tecnologia',
  'Marketing',
  'Autoconhecimento',
  'Educação',
  'Infoprodutor',
  'Outro',
] as const

export const CLOSING_BUSINESS_MODELS = ['Serviço', 'Infoproduto', 'Produto', 'Outro'] as const

// ─── Clientes Recorrentes (MRR) ──────────────────────────────────────────────

export interface RecurringClient {
  id: string
  user_id: string
  name: string
  amount: number
  billing_day: number | null
  service_type: string | null
  active: boolean
  notes: string | null
  started_at: string | null
  created_at: string
  updated_at: string
}

export interface RecurringClientFormData {
  name: string
  amount: number
  billing_day: number | null
  service_type: string | null
  active: boolean
  notes: string | null
  started_at: string | null
}

// ─── Subcategorias por custom_category ───────────────────────────────────────
// Quando uma transação tem category='custom' e custom_category em alguma das
// chaves abaixo, oferece um dropdown adicional de subcategoria.

export const SUBCATEGORIES_BY_CUSTOM_CATEGORY: Record<string, string[]> = {
  'Receita Landing Page / Site': [
    'Landing page com copy',
    'Landing page sem copy',
    'Programação',
    'Site institucional',
    'Alterações',
    'Anúncios',
  ],
  'Pró-labore': ['Karine', 'Andrei'],
}

export function getSubcategoryOptions(customCategory: string | null | undefined): string[] {
  if (!customCategory) return []
  return SUBCATEGORIES_BY_CUSTOM_CATEGORY[customCategory] ?? []
}

// ─── Custos Fixos (equipe / infra) ───────────────────────────────────────────

export type FixedCostFrequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly'
export type FixedCostCategory = 'team' | 'tools' | 'infra' | 'marketing' | 'taxes' | 'other'

export interface FixedCost {
  id: string
  user_id: string
  name: string
  amount: number
  frequency: FixedCostFrequency
  category: FixedCostCategory
  notes: string | null
  active: boolean
  created_at: string
  updated_at: string
}

export interface FixedCostFormData {
  name: string
  amount: number
  frequency: FixedCostFrequency
  category: FixedCostCategory
  notes: string | null
  active: boolean
}

export const FIXED_COST_FREQUENCY_LABELS: Record<FixedCostFrequency, string> = {
  weekly: 'Semanal',
  biweekly: 'Quinzenal',
  monthly: 'Mensal',
  quarterly: 'Trimestral',
  yearly: 'Anual',
}

export const FIXED_COST_CATEGORY_LABELS: Record<FixedCostCategory, string> = {
  team: 'Equipe',
  tools: 'Ferramentas',
  infra: 'Infraestrutura',
  marketing: 'Marketing',
  taxes: 'Impostos',
  other: 'Outros',
}

export const FIXED_COST_CATEGORY_COLORS: Record<FixedCostCategory, string> = {
  team: '#10b981',
  tools: '#3b82f6',
  infra: '#8b5cf6',
  marketing: '#f59e0b',
  taxes: '#ef4444',
  other: '#64748b',
}

// Quanto cada frequência custa por mês (pra cálculos de projeção)
export const FREQUENCY_TO_MONTHLY: Record<FixedCostFrequency, number> = {
  weekly: 4.33,        // ~52/12
  biweekly: 2.17,      // ~26/12
  monthly: 1,
  quarterly: 1 / 3,
  yearly: 1 / 12,
}

export const CLOSING_SEGMENTS = [
  'Engenharia',
  'Corretores',
  'Hipnoterapia',
  'Inteligência Artificial',
  'Academia',
  'Advogado',
  'Tecnologia',
  'Infoproduto',
  'Outro',
] as const

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

// Cores das categorias customizadas de despesa (usadas no Panorama e Relatórios).
export const CUSTOM_EXPENSE_COLORS: Record<string, string> = {
  'Marketing': '#f43f5e',
  'Ferramentas': '#3b82f6',
  'Infraestrutura': '#8b5cf6',
  'Equipe': '#10b981',
  'Pró-labore': '#14b8a6',
  'Cursos / Treinamentos': '#6366f1',
  'Contabilidade': '#06b6d4',
  'Impostos': '#f59e0b',
  'Encargos financeiros': '#f97316',
  'Alimentação': '#eab308',
  'Outros': '#64748b',
}

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

// ─── Personal Workspace Categories ─────────────────────────────────────────

export type PersonalCategory =
  // Receita
  | 'salary_personal' | 'freelance_personal' | 'reimbursement'
  | 'gift_received' | 'investment_income' | 'other_income'
  // Despesa
  | 'groceries' | 'dining' | 'shopping' | 'car' | 'fuel'
  | 'transport_personal' | 'housing_personal' | 'health_personal' | 'leisure' | 'clothing_personal'
  | 'subscriptions_personal' | 'travel' | 'gifts_given' | 'education_personal'
  | 'pet' | 'personal_care' | 'taxes_personal' | 'donations'
  | 'other_expense' | 'custom'

export const PERSONAL_CATEGORY_LABELS: Record<PersonalCategory, string> = {
  // Receita
  salary_personal: 'Salário / Pró-labore',
  freelance_personal: 'Freelance',
  reimbursement: 'Reembolso',
  gift_received: 'Presente recebido',
  investment_income: 'Rendimento',
  other_income: 'Outros (receita)',
  // Despesa
  groceries: 'Mercado',
  dining: 'Restaurante / iFood / Delivery',
  shopping: 'Compras',
  car: 'Carro',
  fuel: 'Gasolina / Combustível',
  transport_personal: 'Transporte (Uber, táxi, público)',
  housing_personal: 'Moradia (aluguel, contas)',
  health_personal: 'Saúde',
  leisure: 'Lazer / Entretenimento',
  clothing_personal: 'Vestuário',
  subscriptions_personal: 'Assinaturas',
  travel: 'Viagem',
  gifts_given: 'Presentes (pra outros)',
  education_personal: 'Educação',
  pet: 'Pet',
  personal_care: 'Cuidados pessoais',
  taxes_personal: 'Impostos / Taxas',
  donations: 'Doações',
  other_expense: 'Outros (despesa)',
  custom: 'Personalizada',
}

export const PERSONAL_CATEGORY_COLORS: Record<PersonalCategory, string> = {
  // Receita — paleta verde-azulada (distinta da Fysi que é verde-esmeralda)
  salary_personal: '#0ea5e9',
  freelance_personal: '#06b6d4',
  reimbursement: '#14b8a6',
  gift_received: '#84cc16',
  investment_income: '#22c55e',
  other_income: '#a3e635',
  // Despesa — paleta âmbar/violeta/rosa (distinta dos vermelhos da Fysi)
  groceries: '#f97316',
  dining: '#fb923c',
  shopping: '#ec4899',
  car: '#a855f7',
  fuel: '#d946ef',
  transport_personal: '#6366f1',
  housing_personal: '#8b5cf6',
  health_personal: '#ef4444',
  leisure: '#f59e0b',
  clothing_personal: '#e11d48',
  subscriptions_personal: '#0891b2',
  travel: '#0284c7',
  gifts_given: '#db2777',
  education_personal: '#2563eb',
  pet: '#f472b6',
  personal_care: '#c026d3',
  taxes_personal: '#dc2626',
  donations: '#16a34a',
  other_expense: '#94a3b8',
  custom: '#64748b',
}

export const PERSONAL_INCOME_CATEGORIES: PersonalCategory[] = [
  'salary_personal', 'freelance_personal', 'reimbursement',
  'gift_received', 'investment_income', 'other_income',
]

export const PERSONAL_EXPENSE_CATEGORIES: PersonalCategory[] = [
  'groceries', 'dining', 'shopping', 'car', 'fuel',
  'transport_personal', 'housing_personal', 'health_personal', 'leisure', 'clothing_personal',
  'subscriptions_personal', 'travel', 'gifts_given', 'education_personal',
  'pet', 'personal_care', 'taxes_personal', 'donations', 'other_expense',
]

export function getCategoryLabelByWorkspace(
  workspace: WorkspaceType,
  category: string,
  customCategory?: string | null,
): string {
  if (category === 'custom' && customCategory) return customCategory
  if (workspace === 'personal') {
    return PERSONAL_CATEGORY_LABELS[category as PersonalCategory] ?? category
  }
  return CATEGORY_LABELS[category as Category] ?? category
}

export function getCategoryColorByWorkspace(
  workspace: WorkspaceType,
  category: string,
  customCategory?: string | null,
): string {
  if (category === 'custom' && customCategory) {
    if (workspace === 'business') {
      return CUSTOM_EXPENSE_COLORS[customCategory] ?? CATEGORY_COLORS.custom
    }
    return PERSONAL_CATEGORY_COLORS.custom
  }
  if (workspace === 'personal') {
    return PERSONAL_CATEGORY_COLORS[category as PersonalCategory] ?? '#94a3b8'
  }
  return CATEGORY_COLORS[category as Category] ?? '#94a3b8'
}

export function getBankName(bankId: string | null | undefined): string {
  if (!bankId) return 'Banco'
  return BANKS.find(b => b.id === bankId)?.name ?? bankId
}

export function getBankColor(bankId: string | null | undefined): string {
  if (!bankId) return '#94A3B8'
  return BANKS.find(b => b.id === bankId)?.color ?? '#94A3B8'
}
