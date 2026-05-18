// Cliente HTTP minimalista para a API v3 do Asaas.
// Apenas o que precisamos para importar cobranças.
// Docs: https://docs.asaas.com/reference/comecando

export type AsaasEnv = 'production' | 'sandbox'

export type AsaasBillingType = 'BOLETO' | 'CREDIT_CARD' | 'PIX' | 'UNDEFINED'

export type AsaasPaymentStatus =
  | 'PENDING' | 'RECEIVED' | 'CONFIRMED' | 'OVERDUE'
  | 'REFUNDED' | 'RECEIVED_IN_CASH' | 'REFUND_REQUESTED'
  | 'CHARGEBACK_REQUESTED' | 'CHARGEBACK_DISPUTE' | 'AWAITING_CHARGEBACK_REVERSAL'
  | 'DUNNING_REQUESTED' | 'DUNNING_RECEIVED' | 'AWAITING_RISK_ANALYSIS'

export interface AsaasPayment {
  id: string
  customer: string
  value: number
  netValue: number
  billingType: AsaasBillingType
  status: AsaasPaymentStatus
  description: string | null
  externalReference: string | null
  dateCreated: string  // YYYY-MM-DD
  dueDate: string      // YYYY-MM-DD
  paymentDate: string | null   // data em que foi pago
  clientPaymentDate: string | null
  invoiceUrl: string | null
}

export interface AsaasListResponse<T> {
  object: 'list'
  hasMore: boolean
  totalCount: number
  limit: number
  offset: number
  data: T[]
}

export interface AsaasCustomer {
  id: string
  name: string
  email: string | null
  cpfCnpj: string | null
}

function baseUrl(env: AsaasEnv): string {
  return env === 'production'
    ? 'https://api.asaas.com/v3'
    : 'https://api-sandbox.asaas.com/v3'
}

async function asaasFetch<T>(
  env: AsaasEnv,
  apiKey: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${baseUrl(env)}${path}`, {
    ...init,
    headers: {
      access_token: apiKey,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Asaas API ${res.status}: ${body}`)
  }
  return res.json() as Promise<T>
}

export async function listPayments(
  env: AsaasEnv,
  apiKey: string,
  params: {
    status?: AsaasPaymentStatus
    paymentDateGe?: string  // YYYY-MM-DD
    paymentDateLe?: string
    limit?: number
    offset?: number
  } = {},
): Promise<AsaasListResponse<AsaasPayment>> {
  const q = new URLSearchParams()
  if (params.status) q.set('status', params.status)
  if (params.paymentDateGe) q.set('paymentDate[ge]', params.paymentDateGe)
  if (params.paymentDateLe) q.set('paymentDate[le]', params.paymentDateLe)
  q.set('limit', String(params.limit ?? 100))
  q.set('offset', String(params.offset ?? 0))
  return asaasFetch(env, apiKey, `/payments?${q.toString()}`)
}

export async function getPayment(
  env: AsaasEnv,
  apiKey: string,
  id: string,
): Promise<AsaasPayment> {
  return asaasFetch(env, apiKey, `/payments/${id}`)
}

export async function getCustomer(
  env: AsaasEnv,
  apiKey: string,
  id: string,
): Promise<AsaasCustomer> {
  return asaasFetch(env, apiKey, `/customers/${id}`)
}

// Iterador que paginação automaticamente, retornando todas as páginas.
export async function* paginate<T>(
  fetcher: (offset: number) => Promise<AsaasListResponse<T>>,
): AsyncGenerator<T> {
  let offset = 0
  while (true) {
    const page = await fetcher(offset)
    for (const item of page.data) yield item
    if (!page.hasMore) break
    offset += page.limit
  }
}
