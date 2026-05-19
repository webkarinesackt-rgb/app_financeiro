// Constrói uma descrição legível a partir do nome do cliente + descrição do
// pagamento. Roda no servidor (webhook + backfill).
export function buildDescription(customerName: string | null | undefined, paymentDescription: string | null | undefined): string {
  const name = customerName?.trim()
  const desc = paymentDescription?.trim()
  if (name && desc) return `${name} — ${desc}`
  if (name) return name
  if (desc) return desc
  return 'Cobrança Asaas'
}
