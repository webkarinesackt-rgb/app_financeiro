// GET /api/v1 — listagem dos endpoints disponíveis (documentação inline)

export function GET() {
  const docs = {
    name: 'Fysi Finanças — API v1',
    version: '1.0.0',
    auth: {
      type: 'bearer',
      header: 'Authorization: Bearer ak_XXXXXXXX_<secret>',
      info: 'Crie uma chave em Settings → API no app. O secret completo é mostrado apenas uma vez.',
    },
    scopes: [
      'read:all',
      'read:transactions',
      'read:accounts',
      'read:balances',
      'read:closings',
      'write:transactions',
    ],
    endpoints: {
      'GET /api/v1/transactions': {
        scope: 'read:transactions',
        query: 'from, to (YYYY-MM-DD) | month, year | type=income|expense | limit, offset',
      },
      'POST /api/v1/transactions': {
        scope: 'write:transactions',
        body: { type: 'income|expense', amount: 0, description: '', date: 'YYYY-MM-DD', category: '...', custom_category: 'optional' },
      },
      'GET /api/v1/accounts': { scope: 'read:accounts' },
      'GET /api/v1/balances': { scope: 'read:balances' },
      'GET /api/v1/closings': { scope: 'read:closings', query: 'status, limit, offset' },
    },
    examples: {
      list_this_month: 'GET /api/v1/transactions?month=6&year=2026',
      list_range: 'GET /api/v1/transactions?from=2026-01-01&to=2026-06-30&type=income',
      create_tx: {
        method: 'POST',
        url: '/api/v1/transactions',
        body: {
          type: 'expense',
          amount: 49.90,
          description: 'Almoço',
          date: '2026-05-30',
          category: 'food',
        },
      },
    },
  }
  return new Response(JSON.stringify(docs, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  })
}
