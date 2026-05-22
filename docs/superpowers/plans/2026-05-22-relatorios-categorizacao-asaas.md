# Plano de Implementação — Exportar PDF, categorização de cartão, comparativo e despesas do Asaas

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar exportação do Panorama em PDF, melhorar a categorização de despesas de cartão, corrigir/ampliar o comparativo do Panorama e importar despesas pagas pelo Asaas.

**Architecture:** App Next.js 16 + Supabase. A lógica pura nova vive em arquivos de `src/lib/` testáveis com Vitest; os componentes de página e a rota de API são verificados por `npx tsc --noEmit`, `npm run lint` e verificação manual no navegador. Spec: `docs/superpowers/specs/2026-05-22-relatorios-categorizacao-asaas-design.md`.

**Tech Stack:** Next.js 16.2.4, React 19, Supabase JS, recharts, Tailwind v4, Vitest (novo, dev-only).

**Nota sobre testes:** o projeto não tinha runner de testes. A Tarefa 1 adiciona o Vitest (mínimo, só dev). Fazemos TDD nas funções puras (`src/lib/panorama.ts`, `src/lib/expense-key.ts`, `src/lib/asaas/transfers.ts`). Componentes React, rota de API e código que toca o Supabase são verificados por compilação + lint + checagem manual — não há setup de teste de componente neste projeto e adicioná-lo está fora de escopo.

**Verificação por tarefa:**
- Tarefas de função pura: `npx vitest run <arquivo>` (deve passar).
- Tarefas de componente/rota: `npx tsc --noEmit` (sem erros) + `npm run lint` (sem erros).
- Fim de cada fase: `npm run build` deve concluir, e a verificação manual descrita.

---

## Fase 0 — Setup

### Task 1: Adicionar Vitest

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Instalar o Vitest**

Run:
```bash
cd /Users/User/Desktop/App_financas/financas-app && npm install -D vitest
```
Expected: instala `vitest` em `devDependencies`, sem erros.

- [ ] **Step 2: Criar `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
})
```

- [ ] **Step 3: Adicionar o script `test` ao `package.json`**

No bloco `"scripts"`, adicionar a linha `"test"` logo após `"lint"`:

```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest run"
  },
```

- [ ] **Step 4: Verificar que o runner sobe**

Run: `npx vitest run`
Expected: termina sem erro, com mensagem do tipo "No test files found" (ainda não há testes).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: adiciona Vitest para testes de unidade"
```

---

## Fase 1 — Comparativo no Panorama

### Task 2: Helpers puros do Panorama

**Files:**
- Create: `src/lib/panorama.ts`
- Test: `src/lib/panorama.test.ts`

- [ ] **Step 1: Escrever os testes**

`src/lib/panorama.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import {
  getTrendMonths, getYearToDateMonths, yearToDateLabel, splitExpensesByOrigin,
} from '@/lib/panorama'

describe('getTrendMonths', () => {
  it('devolve os últimos N meses incluindo o atual, do mais antigo ao mais recente', () => {
    const r = getTrendMonths(new Date(2026, 4, 15), 6) // maio/2026
    expect(r).toHaveLength(6)
    expect(r[0]).toEqual({ month: 12, year: 2025 })
    expect(r[5]).toEqual({ month: 5, year: 2026 })
  })
  it('atravessa a virada de ano corretamente', () => {
    const r = getTrendMonths(new Date(2026, 0, 10), 3) // janeiro/2026
    expect(r).toEqual([
      { month: 11, year: 2025 }, { month: 12, year: 2025 }, { month: 1, year: 2026 },
    ])
  })
})

describe('getYearToDateMonths', () => {
  it('devolve de janeiro até o mês informado', () => {
    expect(getYearToDateMonths(5)).toEqual([1, 2, 3, 4, 5])
    expect(getYearToDateMonths(1)).toEqual([1])
  })
})

describe('yearToDateLabel', () => {
  it('formata o intervalo Jan–mês', () => {
    expect(yearToDateLabel(5, 2026)).toBe('Jan–Mai 2026')
  })
  it('usa só o mês quando o intervalo é janeiro', () => {
    expect(yearToDateLabel(1, 2025)).toBe('Jan 2025')
  })
})

describe('splitExpensesByOrigin', () => {
  it('classifica despesas por cartão, asaas e conta; ignora receitas', () => {
    const r = splitExpensesByOrigin([
      { type: 'expense', amount: 100, credit_card_id: 'c1', integration_id: null },
      { type: 'expense', amount: 50, credit_card_id: null, integration_id: 'i1' },
      { type: 'expense', amount: 30, credit_card_id: null, integration_id: null },
      { type: 'income', amount: 999, credit_card_id: null, integration_id: null },
    ])
    expect(r).toEqual({ card: 100, asaas: 50, account: 30 })
  })
})
```

- [ ] **Step 2: Rodar os testes para vê-los falhar**

Run: `npx vitest run src/lib/panorama.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/panorama"`.

- [ ] **Step 3: Implementar `src/lib/panorama.ts`**

```ts
import { getMonthName } from '@/lib/format'

export interface MonthRef {
  month: number
  year: number
}

// Últimos `count` meses incluindo o mês de `now`, do mais antigo ao mais recente.
export function getTrendMonths(now: Date, count: number): MonthRef[] {
  const result: MonthRef[] = []
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    result.push({ month: d.getMonth() + 1, year: d.getFullYear() })
  }
  return result
}

// Meses de janeiro (1) até `throughMonth` inclusive.
export function getYearToDateMonths(throughMonth: number): number[] {
  return Array.from({ length: throughMonth }, (_, i) => i + 1)
}

// Rótulo do intervalo do início do ano até o mês: "Jan–Mai 2026".
export function yearToDateLabel(throughMonth: number, year: number): string {
  const first = capitalize(getMonthName(1).slice(0, 3))
  const last = capitalize(getMonthName(throughMonth).slice(0, 3))
  return throughMonth === 1 ? `${last} ${year}` : `${first}–${last} ${year}`
}

interface OriginInput {
  type: string
  amount: number
  credit_card_id: string | null
  integration_id: string | null
}

export interface OriginSplit {
  card: number
  account: number
  asaas: number
}

// Soma as despesas separando por origem: cartão de crédito, Asaas (integração)
// ou conta bancária.
export function splitExpensesByOrigin(txs: OriginInput[]): OriginSplit {
  const split: OriginSplit = { card: 0, account: 0, asaas: 0 }
  for (const t of txs) {
    if (t.type !== 'expense') continue
    const amount = Number(t.amount)
    if (t.credit_card_id) split.card += amount
    else if (t.integration_id) split.asaas += amount
    else split.account += amount
  }
  return split
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
```

- [ ] **Step 4: Rodar os testes para vê-los passar**

Run: `npx vitest run src/lib/panorama.test.ts`
Expected: PASS — 4 suítes, todos os testes verdes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/panorama.ts src/lib/panorama.test.ts
git commit -m "feat: helpers puros do Panorama (tendência, year-to-date, origem)"
```

---

### Task 2.1: Adicionar `integration_id` ao tipo `Transaction`

**Files:**
- Modify: `src/types/index.ts:14-35`

- [ ] **Step 1: Adicionar o campo à interface `Transaction`**

Em `src/types/index.ts`, na interface `Transaction`, adicionar a linha `integration_id` logo após `credit_card_id`:

```ts
  account_id: string | null
  credit_card_id: string | null
  integration_id: string | null
  payment_method: PaymentMethod | null
```

(A coluna já existe na tabela `transactions` no banco — só faltava no tipo. `getTransactions` usa `select('*')`, então o dado já vem; isto só corrige o TypeScript.)

- [ ] **Step 2: Verificar compilação**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: adiciona integration_id ao tipo Transaction"
```

---

### Task 3: Corrigir o comparativo anual do Panorama

**Files:**
- Modify: `src/app/(dashboard)/panorama/page.tsx`

- [ ] **Step 1: Importar os helpers**

Em `panorama/page.tsx`, logo após a linha `import { formatCurrency, getMonthName } from '@/lib/format'`, adicionar:

```ts
import { getYearToDateMonths, yearToDateLabel } from '@/lib/panorama'
```

- [ ] **Step 2: Trocar o ramo anual de `fetchData`**

Localizar o bloco `else` dentro de `fetchData` (atualmente monta `monthsThisYear`/`monthsLastYear` com 12 meses) e substituí-lo inteiro por:

```ts
      } else {
        const ytdMonths = getYearToDateMonths(month)
        const [curResults, prevResults, rc, fc] = await Promise.all([
          Promise.all(ytdMonths.map((m) => getTransactions({ month: m, year }))),
          Promise.all(ytdMonths.map((m) => getTransactions({ month: m, year: year - 1 }))),
          getRecurringClients(),
          getFixedCosts(),
        ])
        setCurrentTx(curResults.flat())
        setPrevTx(prevResults.flat())
        setRecurringClients(rc)
        setFixedCosts(fc)
      }
```

- [ ] **Step 3: Corrigir os rótulos de período**

Localizar as linhas:

```ts
  const periodLabel = period === 'month' ? `${getMonthName(month)} ${year}` : `Ano ${year}`
  const prevPeriodLabel = period === 'month' ? getMonthName(prevMonth) : `Ano ${year - 1}`
```

Substituir por:

```ts
  const periodLabel = period === 'month' ? `${getMonthName(month)} ${year}` : yearToDateLabel(month, year)
  const prevPeriodLabel = period === 'month' ? getMonthName(prevMonth) : yearToDateLabel(month, year - 1)
```

- [ ] **Step 4: Verificar compilação e lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add src/app/(dashboard)/panorama/page.tsx
git commit -m "fix: comparativo anual do Panorama compara o mesmo período (Jan–mês atual)"
```

---

### Task 4: Gráfico de tendência no Panorama

**Files:**
- Modify: `src/app/(dashboard)/panorama/page.tsx`

- [ ] **Step 1: Importar componentes do recharts e o helper**

Localizar a linha de import do recharts:

```ts
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
```

Substituir por:

```ts
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts'
```

Na linha de import de `@/lib/panorama` (criada na Task 3), incluir `getTrendMonths`:

```ts
import { getTrendMonths, getYearToDateMonths, yearToDateLabel } from '@/lib/panorama'
```

- [ ] **Step 2: Adicionar estado e efeito de tendência**

Dentro do componente `PanoramaPage`, logo após a linha `const [loading, setLoading] = useState(true)`, adicionar:

```ts
  const [monthsBack, setMonthsBack] = useState<6 | 12>(6)
  const [trend, setTrend] = useState<{ name: string; receita: number; despesa: number; lucro: number }[]>([])
```

Logo após o `useEffect(() => { fetchData() }, [fetchData])` existente, adicionar:

```ts
  useEffect(() => {
    const months = getTrendMonths(new Date(), monthsBack)
    Promise.all(months.map((m) => getTransactions({ month: m.month, year: m.year })))
      .then((results) => {
        setTrend(results.map((txs, i) => {
          const receita = txs.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
          const despesa = txs.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
          return {
            name: getMonthName(months[i].month).slice(0, 3).toUpperCase(),
            receita, despesa, lucro: receita - despesa,
          }
        }))
      })
      .catch(() => {})
  }, [monthsBack])
```

- [ ] **Step 3: Renderizar o card do gráfico**

Dentro do JSX, localizar o comentário `{/* Breakdowns */}` e inserir, **imediatamente antes** dele, este bloco:

```tsx
          {/* Evolução / tendência */}
          <Card className="border border-slate-100 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-slate-700">Evolução</h2>
                <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs">
                  <button onClick={() => setMonthsBack(6)}
                    className={`px-2.5 py-1 rounded-md font-medium ${monthsBack === 6 ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
                    6 meses
                  </button>
                  <button onClick={() => setMonthsBack(12)}
                    className={`px-2.5 py-1 rounded-md font-medium ${monthsBack === 12 ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
                    12 meses
                  </button>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={trend} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="receita" name="Receita" fill="#10b981" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="despesa" name="Despesa" fill="#f43f5e" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="lucro" name="Lucro" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

```

- [ ] **Step 4: Verificar compilação e lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sem erros.

- [ ] **Step 5: Verificação manual**

Run: `npm run dev`, abrir `/panorama`. Confirmar: o card "Evolução" aparece com barras Receita/Despesa/Lucro; alternar 6/12 meses recarrega o gráfico.

- [ ] **Step 6: Commit**

```bash
git add src/app/(dashboard)/panorama/page.tsx
git commit -m "feat: gráfico de tendência (6/12 meses) no Panorama"
```

---

## Fase 2 — Categorização de despesas de cartão

### Task 5: Extrair `extractExpenseKey` e adicionar o mapa de lojistas

**Files:**
- Create: `src/lib/expense-key.ts`
- Create: `src/lib/expense-key.test.ts`
- Modify: `src/lib/bulk-categorize.ts`

- [ ] **Step 1: Escrever os testes**

`src/lib/expense-key.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import {
  extractExpenseKey, buildMerchantCategoryMap, matchMerchantCategory,
} from '@/lib/expense-key'

describe('extractExpenseKey', () => {
  it('extrai o destinatário de um Pix com Cp', () => {
    expect(extractExpenseKey('Pix enviado: Cp :12345-Joao da Silva 987654')).toBe('Joao da Silva')
  })
  it('extrai os tokens significativos de uma compra de cartão', () => {
    expect(extractExpenseKey('FACEBK 347GXKDYT2 SAO PAULO BRA')).toBe('FACEBK')
  })
  it('devolve null para descrições muito curtas', () => {
    expect(extractExpenseKey('AB')).toBeNull()
  })
})

describe('buildMerchantCategoryMap / matchMerchantCategory', () => {
  it('casa uma descrição nova pelo mesmo lojista de uma já categorizada', () => {
    const map = buildMerchantCategoryMap([
      { description: 'FACEBK 111 SAO PAULO BRA', custom_category: 'Marketing', subcategory: null },
    ])
    expect(matchMerchantCategory('FACEBK 999 RIO BRA', map)).toEqual({
      custom_category: 'Marketing', subcategory: null,
    })
  })
  it('devolve null quando não há lojista correspondente', () => {
    const map = buildMerchantCategoryMap([])
    expect(matchMerchantCategory('CLICKUP 8886254258 CA', map)).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar os testes para vê-los falhar**

Run: `npx vitest run src/lib/expense-key.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/expense-key"`.

- [ ] **Step 3: Criar `src/lib/expense-key.ts`**

```ts
// Extrai o "lojista/destinatário" de uma descrição de despesa e ajuda a
// reaproveitar categorias já aplicadas a despesas do mesmo lojista.

// Extrai o "lojista/destinatário" de uma descrição de despesa.
// Padrões reconhecidos:
//   - "Pix enviado: Cp :NNNNN-Nome do Destinatário"  -> Nome
//   - "Pagamento efetuado: ..."                       -> tudo após ":"
//   - "FACEBK 347GXKDYT2 SAO PAULO BRA"               -> FACEBK
export function extractExpenseKey(description: string): string | null {
  const d = description.trim()

  // 1) Pix com Cp :NNNN-Nome
  const pixMatch = d.match(/Cp\s*:[\d]+-(.+?)(\s+\d{6,}|$)/)
  if (pixMatch && pixMatch[1].trim().length >= 3) return pixMatch[1].trim()

  // 2) Pagamento efetuado: <descrição>
  const pagMatch = d.match(/^Pagamento\s+efetuado:\s*(.+)$/i)
  if (pagMatch && pagMatch[1].trim().length >= 3) {
    return extractExpenseKey(pagMatch[1].trim()) ?? pagMatch[1].trim().slice(0, 30)
  }

  // 3) Cartão: primeiros tokens significativos, parando em IDs longos
  //    (>= 6 dígitos/alfanumérico) ou códigos curtos de estado/país.
  const tokens = d.split(/\s+/).filter((w) => w.length >= 2)
  const meaningful: string[] = []
  for (const tok of tokens) {
    if (/^[a-zA-Z0-9]{6,}$/.test(tok) && /\d/.test(tok)) break
    if (meaningful.length >= 1 && /^[A-Z]{2,3}$/.test(tok)) break
    meaningful.push(tok)
    if (meaningful.length >= 3) break
  }
  const key = meaningful.join(' ').trim()
  return key.length >= 3 ? key : null
}

export interface CategorizedSample {
  description: string
  custom_category: string
  subcategory: string | null
}

export interface CategoryMatch {
  custom_category: string
  subcategory: string | null
}

// Monta um mapa "chave de lojista" -> categoria a partir de despesas já
// categorizadas. A primeira ocorrência de cada lojista vence.
export function buildMerchantCategoryMap(samples: CategorizedSample[]): Map<string, CategoryMatch> {
  const map = new Map<string, CategoryMatch>()
  for (const s of samples) {
    const key = extractExpenseKey(s.description)
    if (!key || map.has(key)) continue
    map.set(key, { custom_category: s.custom_category, subcategory: s.subcategory })
  }
  return map
}

// Devolve a categoria do lojista da descrição, se houver no mapa.
export function matchMerchantCategory(
  description: string,
  map: Map<string, CategoryMatch>,
): CategoryMatch | null {
  const key = extractExpenseKey(description)
  if (!key) return null
  return map.get(key) ?? null
}
```

- [ ] **Step 4: Rodar os testes para vê-los passar**

Run: `npx vitest run src/lib/expense-key.test.ts`
Expected: PASS.

- [ ] **Step 5: Apontar `bulk-categorize.ts` para o helper compartilhado**

Em `src/lib/bulk-categorize.ts`, **remover** a função local `extractExpenseKey` inteira (o bloco de comentário `// Extrai o "lojista/destinatário"...` mais a função, da linha do comentário até o `}` final dela) e, no topo do arquivo, logo após `import { createClient } from '@/lib/supabase/client'`, adicionar:

```ts
import { extractExpenseKey } from '@/lib/expense-key'
```

(A função `extractClient`, específica de receitas, permanece em `bulk-categorize.ts`.)

- [ ] **Step 6: Verificar compilação, lint e testes**

Run: `npx tsc --noEmit && npm run lint && npx vitest run`
Expected: sem erros; todos os testes passam.

- [ ] **Step 7: Commit**

```bash
git add src/lib/expense-key.ts src/lib/expense-key.test.ts src/lib/bulk-categorize.ts
git commit -m "feat: extrai extractExpenseKey e adiciona mapa de lojista->categoria"
```

---

### Task 6: `inferCategoriesFromHistory` em `transactions.ts`

**Files:**
- Modify: `src/lib/transactions.ts`

- [ ] **Step 1: Adicionar a função**

Em `src/lib/transactions.ts`, no topo, após `import type { Transaction, TransactionFormData } from '@/types'`, adicionar:

```ts
import { buildMerchantCategoryMap, matchMerchantCategory, type CategoryMatch } from '@/lib/expense-key'
```

No fim do arquivo, adicionar:

```ts
// Para uma lista de descrições de despesa, devolve um mapa
// descrição -> categoria inferida, com base em despesas já categorizadas
// do mesmo lojista. Faz uma única consulta ao banco.
export async function inferCategoriesFromHistory(
  descriptions: string[],
): Promise<Map<string, CategoryMatch>> {
  const result = new Map<string, CategoryMatch>()
  if (descriptions.length === 0) return result

  const supabase = createClient()
  const { data } = await supabase
    .from('transactions')
    .select('description, custom_category, subcategory')
    .eq('type', 'expense')
    .eq('category', 'custom')
    .not('custom_category', 'is', null)

  const samples = (data ?? [])
    .filter((r): r is { description: string; custom_category: string; subcategory: string | null } =>
      typeof r.description === 'string' && typeof r.custom_category === 'string')

  const merchantMap = buildMerchantCategoryMap(samples)
  for (const desc of descriptions) {
    const match = matchMerchantCategory(desc, merchantMap)
    if (match) result.set(desc, match)
  }
  return result
}
```

- [ ] **Step 2: Verificar compilação e lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/lib/transactions.ts
git commit -m "feat: inferCategoriesFromHistory para auto-categorizar na importação"
```

---

### Task 7: Auto-categorização na tela de importação

**Files:**
- Modify: `src/app/(dashboard)/import/page.tsx`

- [ ] **Step 1: Importar a função e estender o tipo `ParsedTransaction`**

Em `import/page.tsx`, após `import { createTransaction } from '@/lib/transactions'`, trocar por:

```ts
import { createTransaction, inferCategoriesFromHistory } from '@/lib/transactions'
```

Na interface `ParsedTransaction`, adicionar o campo `custom_category` logo após `category`:

```ts
interface ParsedTransaction {
  type: 'income' | 'expense'
  amount: number
  description: string
  date: string
  category: Category
  custom_category?: string | null
  payment_method: PaymentMethod
  selected?: boolean
  installment_total?: number | null
  installment_current?: number | null
  isCardPayment?: boolean
}
```

- [ ] **Step 2: Criar a função que aplica as categorias inferidas**

Dentro do componente `ImportPage`, logo antes de `async function handleSend()`, adicionar:

```ts
  // Para despesas, herda a custom_category de transações antigas do mesmo lojista.
  async function withInferredCategories(txs: ParsedTransaction[]): Promise<ParsedTransaction[]> {
    const expenseDescs = txs.filter((t) => t.type === 'expense').map((t) => t.description)
    if (expenseDescs.length === 0) return txs
    try {
      const inferred = await inferCategoriesFromHistory(expenseDescs)
      return txs.map((t) => {
        const match = t.type === 'expense' ? inferred.get(t.description) : undefined
        return match ? { ...t, category: 'custom' as Category, custom_category: match.custom_category } : t
      })
    } catch {
      return txs
    }
  }
```

- [ ] **Step 3: Aplicar no fluxo da IA (`handleSend`)**

Em `handleSend`, localizar:

```ts
      const txs: ParsedTransaction[] = (json.transactions ?? []).map((t: ParsedTransaction) => ({
        ...t,
        selected: !isAsaasTransfer(t.description),
      }))
```

Substituir por:

```ts
      const rawTxs: ParsedTransaction[] = (json.transactions ?? []).map((t: ParsedTransaction) => ({
        ...t,
        selected: !isAsaasTransfer(t.description),
      }))
      const txs = await withInferredCategories(rawTxs)
```

- [ ] **Step 4: Aplicar no fluxo do CSV (`handleCsvFile`)**

Em `handleCsvFile`, localizar:

```ts
      const txs: ParsedTransaction[] = result.transactions.map((t) => ({
        ...t,
        selected: !isAsaasTransfer(t.description) && !t.isCardPayment,
      }))
```

Substituir por:

```ts
      const rawTxs: ParsedTransaction[] = result.transactions.map((t) => ({
        ...t,
        selected: !isAsaasTransfer(t.description) && !t.isCardPayment,
      }))
      const txs = await withInferredCategories(rawTxs)
```

- [ ] **Step 5: Gravar a `custom_category` na importação**

Em `handleImport`, dentro da chamada `createTransaction({ ... })`, localizar a linha `category: tx.category,` e a linha `custom_category: null,` e substituí-las por:

```ts
          category: tx.custom_category ? 'custom' : tx.category,
          custom_category: tx.custom_category ?? null,
```

- [ ] **Step 6: Mostrar a categoria inferida na tabela de revisão**

Na tabela de revisão, localizar:

```tsx
                              <Badge variant="outline" className="text-xs py-0 px-1.5 h-4">
                                {CATEGORY_LABELS[tx.category] ?? tx.category}
                              </Badge>
```

Substituir por:

```tsx
                              <Badge variant="outline" className={`text-xs py-0 px-1.5 h-4 ${tx.custom_category ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : ''}`}>
                                {tx.custom_category ?? CATEGORY_LABELS[tx.category] ?? tx.category}
                              </Badge>
```

- [ ] **Step 7: Verificar compilação e lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sem erros.

- [ ] **Step 8: Verificação manual**

Run: `npm run dev`, abrir `/import`, colar um extrato com uma despesa de um lojista já categorizado antes. Confirmar que o badge da categoria aparece em verde com o nome da categoria herdada.

- [ ] **Step 9: Commit**

```bash
git add src/app/(dashboard)/import/page.tsx
git commit -m "feat: auto-categoriza despesas na importação pelo histórico do lojista"
```

---

### Task 8: Filtro de origem em `getUncategorizedExpenses`

**Files:**
- Modify: `src/lib/bulk-categorize.ts`

- [ ] **Step 1: Adicionar o tipo `ExpenseOrigin` e reescrever `getUncategorizedExpenses`**

Em `bulk-categorize.ts`, logo após a interface `UncategorizedClient`, adicionar:

```ts
export type ExpenseOrigin = 'all' | 'card' | 'account' | 'asaas'
```

Substituir a função `getUncategorizedExpenses` inteira por:

```ts
// Lista DESPESAS sem categoria da empresa (custom_category nula), agrupadas
// por lojista extraído da description. `origin` filtra por cartão / conta /
// Asaas (integração).
export async function getUncategorizedExpenses(
  fromDate?: string,
  origin: ExpenseOrigin = 'all',
): Promise<UncategorizedClient[]> {
  const supabase = createClient()
  let query = supabase
    .from('transactions')
    .select('description, amount, date, credit_card_id, integration_id')
    .eq('type', 'expense')
    .is('custom_category', null)

  if (fromDate) query = query.gte('date', fromDate)
  if (origin === 'card') query = query.not('credit_card_id', 'is', null)
  else if (origin === 'asaas') query = query.not('integration_id', 'is', null)
  else if (origin === 'account') query = query.is('credit_card_id', null).is('integration_id', null)

  const { data, error } = await query
  if (error || !data) return []

  const map = new Map<string, UncategorizedClient>()
  for (const t of data) {
    const key = extractExpenseKey(t.description as string)
    if (!key) continue

    const cur = map.get(key) ?? {
      name: key,
      total: 0,
      count: 0,
      firstDate: t.date,
      lastDate: t.date,
      sample: t.description,
    }
    cur.total += Number(t.amount)
    cur.count += 1
    if (t.date < cur.firstDate) cur.firstDate = t.date
    if (t.date > cur.lastDate) cur.lastDate = t.date
    map.set(key, cur)
  }

  return Array.from(map.values()).sort((a, b) => b.total - a.total)
}
```

- [ ] **Step 2: Verificar compilação e lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/lib/bulk-categorize.ts
git commit -m "feat: /categorizar enxerga toda despesa sem categoria, com filtro de origem"
```

---

### Task 9: Alternador de origem no `/categorizar`

**Files:**
- Modify: `src/app/(dashboard)/categorizar/page.tsx`

- [ ] **Step 1: Importar o tipo `ExpenseOrigin`**

Em `categorizar/page.tsx`, na importação de `@/lib/bulk-categorize`, adicionar `type ExpenseOrigin`:

```ts
import {
  getUncategorizedLPClients, categorizeClientByName,
  getUncategorizedExpenses, categorizeExpenseByPattern,
  type UncategorizedClient, type ExpenseOrigin,
} from '@/lib/bulk-categorize'
```

- [ ] **Step 2: Adicionar o estado e passar à busca**

Após a linha `const [mode, setMode] = useState<Mode>('income')`, adicionar:

```ts
  const [origin, setOrigin] = useState<ExpenseOrigin>('all')
```

Em `fetchClients`, localizar:

```ts
      const list = mode === 'income'
        ? await getUncategorizedLPClients(fromDate || undefined)
        : await getUncategorizedExpenses(fromDate || undefined)
```

Substituir por:

```ts
      const list = mode === 'income'
        ? await getUncategorizedLPClients(fromDate || undefined)
        : await getUncategorizedExpenses(fromDate || undefined, origin)
```

Na assinatura do `useCallback` de `fetchClients`, adicionar `origin` ao array de dependências:

```ts
  }, [fromDate, mode, origin])
```

- [ ] **Step 3: Renderizar o alternador (só no modo despesa)**

Localizar o bloco `{/* Mode toggle */}` e, logo após o `</div>` que fecha esse bloco do toggle de modo, inserir:

```tsx
        {/* Origin toggle — só despesas */}
        {mode === 'expense' && (
          <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs self-start">
            {([['all', 'Tudo'], ['card', 'Cartão'], ['account', 'Conta'], ['asaas', 'Asaas']] as [ExpenseOrigin, string][]).map(([id, label]) => (
              <button key={id} onClick={() => setOrigin(id)}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${origin === id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                {label}
              </button>
            ))}
          </div>
        )}
```

- [ ] **Step 4: Verificar compilação e lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sem erros.

- [ ] **Step 5: Verificação manual**

Run: `npm run dev`, abrir `/categorizar`, modo "Despesas". Confirmar que o alternador Tudo/Cartão/Conta/Asaas aparece e que trocar a opção recarrega a lista.

- [ ] **Step 6: Commit**

```bash
git add src/app/(dashboard)/categorizar/page.tsx
git commit -m "feat: alternador de origem (cartão/conta/Asaas) no /categorizar"
```

---

### Task 10: Card "Despesa por origem" no Panorama

**Files:**
- Modify: `src/app/(dashboard)/panorama/page.tsx`

- [ ] **Step 1: Importar `splitExpensesByOrigin`**

Na importação de `@/lib/panorama`, incluir `splitExpensesByOrigin`:

```ts
import { getTrendMonths, getYearToDateMonths, yearToDateLabel, splitExpensesByOrigin } from '@/lib/panorama'
```

- [ ] **Step 2: Calcular o split**

Logo após o cálculo de `expenseBreakdown` (a constante que termina com `.sort((a, b) => b.amount - a.amount)`), adicionar:

```ts
  // Despesa por origem: cartão / conta / Asaas
  const originSplit = splitExpensesByOrigin(currentTx)
  const originRows = [
    { label: 'Cartão de crédito', value: originSplit.card, color: '#8b5cf6' },
    { label: 'Conta bancária', value: originSplit.account, color: '#3b82f6' },
    { label: 'Asaas', value: originSplit.asaas, color: '#06b6d4' },
  ].filter((r) => r.value > 0)
```

- [ ] **Step 3: Renderizar o card**

Localizar o comentário `{/* Top clientes */}` no JSX e inserir, **imediatamente antes** dele:

```tsx
          {/* Despesa por origem */}
          {originRows.length > 0 && (
            <Card className="border border-slate-100 shadow-sm">
              <CardContent className="p-5">
                <h2 className="text-sm font-semibold text-slate-700 mb-3">Despesa por origem</h2>
                <div className="space-y-2.5">
                  {originRows.map((row) => {
                    const pct = expense > 0 ? (row.value / expense) * 100 : 0
                    return (
                      <div key={row.label} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="flex items-center gap-2 text-slate-600">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: row.color }} />
                            {row.label}
                          </span>
                          <span className="font-semibold text-slate-700">
                            {formatCurrency(row.value)} <span className="text-xs text-slate-400">{pct.toFixed(0)}%</span>
                          </span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: row.color }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

```

- [ ] **Step 4: Verificar compilação e lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sem erros.

- [ ] **Step 5: Verificar build da fase**

Run: `npm run build`
Expected: build conclui sem erros.

- [ ] **Step 6: Verificação manual**

Run: `npm run dev`, abrir `/panorama`. Confirmar que o card "Despesa por origem" aparece com as linhas e percentuais corretos.

- [ ] **Step 7: Commit**

```bash
git add src/app/(dashboard)/panorama/page.tsx
git commit -m "feat: card Despesa por origem (cartão/conta/Asaas) no Panorama"
```

---

## Fase 3 — Importar despesas do Asaas

### Task 11: `listTransfers` no cliente Asaas

**Files:**
- Modify: `src/lib/asaas/client.ts`

- [ ] **Step 1: Adicionar os tipos `AsaasTransfer` e a função `listTransfers`**

No fim de `src/lib/asaas/client.ts`, adicionar:

```ts
export type AsaasTransferStatus =
  | 'PENDING' | 'BANK_PROCESSING' | 'DONE' | 'FAILED' | 'CANCELLED' | 'BLOCKED'

export interface AsaasBankAccount {
  ownerName?: string | null
  cpfCnpj?: string | null
  bank?: { name?: string | null } | null
}

export interface AsaasTransfer {
  id: string
  dateCreated: string             // YYYY-MM-DD
  effectiveDate: string | null    // data em que a transferência saiu
  status: AsaasTransferStatus
  type: string                    // PIX | TED | INTERNAL
  value: number
  netValue: number | null
  transferFee: number | null
  description: string | null
  bankAccount: AsaasBankAccount | null
  pixAddressKey: string | null
}

export async function listTransfers(
  env: AsaasEnv,
  apiKey: string,
  params: {
    dateCreatedGe?: string  // YYYY-MM-DD
    dateCreatedLe?: string
    limit?: number
    offset?: number
  } = {},
): Promise<AsaasListResponse<AsaasTransfer>> {
  const q = new URLSearchParams()
  if (params.dateCreatedGe) q.set('dateCreated[ge]', params.dateCreatedGe)
  if (params.dateCreatedLe) q.set('dateCreated[le]', params.dateCreatedLe)
  q.set('limit', String(params.limit ?? 100))
  q.set('offset', String(params.offset ?? 0))
  return asaasFetch(env, apiKey, `/transfers?${q.toString()}`)
}
```

- [ ] **Step 2: Verificar compilação e lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/lib/asaas/client.ts
git commit -m "feat: listTransfers no cliente Asaas"
```

---

### Task 12: Helpers de transferência (exclusão da Fysi e mapeamento)

**Files:**
- Create: `src/lib/asaas/transfers.ts`
- Create: `src/lib/asaas/transfers.test.ts`

- [ ] **Step 1: Escrever os testes**

`src/lib/asaas/transfers.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { isFysiTransfer, mapTransferToExpense } from '@/lib/asaas/transfers'
import type { AsaasTransfer } from '@/lib/asaas/client'

function transfer(overrides: Partial<AsaasTransfer>): AsaasTransfer {
  return {
    id: 'tra_1', dateCreated: '2026-05-01', effectiveDate: '2026-05-02',
    status: 'DONE', type: 'PIX', value: 1000, netValue: 1000, transferFee: 0,
    description: null, bankAccount: null, pixAddressKey: null, ...overrides,
  }
}

describe('isFysiTransfer', () => {
  it('é true quando o destinatário tem "Fysi" no nome', () => {
    expect(isFysiTransfer(transfer({ bankAccount: { ownerName: 'Fysi Lab Digital' } }))).toBe(true)
  })
  it('é false para um terceiro', () => {
    expect(isFysiTransfer(transfer({ bankAccount: { ownerName: 'Leo Souza' } }))).toBe(false)
  })
  it('é false quando não há dados de conta', () => {
    expect(isFysiTransfer(transfer({ bankAccount: null }))).toBe(false)
  })
})

describe('mapTransferToExpense', () => {
  it('mapeia uma transferência para uma despesa sem categoria', () => {
    const m = mapTransferToExpense(transfer({
      value: 1500, type: 'PIX', effectiveDate: '2026-05-03',
      bankAccount: { ownerName: 'Sara Lima' }, transferFee: 0,
    }))
    expect(m).toMatchObject({
      type: 'expense', amount: 1500, description: 'Sara Lima',
      date: '2026-05-03', category: 'other', custom_category: null, payment_method: 'pix',
    })
  })
  it('usa dateCreated quando effectiveDate é nulo e registra a taxa nas notas', () => {
    const m = mapTransferToExpense(transfer({
      effectiveDate: null, dateCreated: '2026-05-01', type: 'TED',
      transferFee: 5, bankAccount: { ownerName: 'Leo Souza' },
    }))
    expect(m.date).toBe('2026-05-01')
    expect(m.payment_method).toBe('transfer')
    expect(m.notes).toContain('taxa R$ 5.00')
  })
})
```

- [ ] **Step 2: Rodar os testes para vê-los falhar**

Run: `npx vitest run src/lib/asaas/transfers.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/asaas/transfers"`.

- [ ] **Step 3: Criar `src/lib/asaas/transfers.ts`**

```ts
import type { AsaasTransfer } from './client'

// Transferência cujo destinatário é a própria Fysi — movimentação interna,
// não conta como despesa.
export function isFysiTransfer(transfer: AsaasTransfer): boolean {
  const owner = transfer.bankAccount?.ownerName ?? ''
  return /fysi/i.test(owner)
}

export interface MappedExpense {
  type: 'expense'
  amount: number
  description: string
  date: string
  category: 'other'
  custom_category: null
  payment_method: 'pix' | 'transfer'
  notes: string
}

// Converte uma transferência de saída do Asaas numa despesa sem categoria.
// O valor é o pagamento ao terceiro; a taxa entra apenas nas notas.
export function mapTransferToExpense(transfer: AsaasTransfer): MappedExpense {
  const owner = transfer.bankAccount?.ownerName?.trim()
  const description = owner || transfer.description?.trim() || 'Transferência Asaas'
  const fee = transfer.transferFee ?? 0
  return {
    type: 'expense',
    amount: transfer.value,
    description,
    date: transfer.effectiveDate ?? transfer.dateCreated,
    category: 'other',
    custom_category: null,
    payment_method: transfer.type === 'PIX' ? 'pix' : 'transfer',
    notes: `Asaas transferência ${transfer.type}${fee > 0 ? ` • taxa R$ ${fee.toFixed(2)}` : ''}`,
  }
}
```

- [ ] **Step 4: Rodar os testes para vê-los passar**

Run: `npx vitest run src/lib/asaas/transfers.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/asaas/transfers.ts src/lib/asaas/transfers.test.ts
git commit -m "feat: helpers de transferência Asaas (exclusão da Fysi, mapeamento de despesa)"
```

---

### Task 13: Rota de backfill de despesas do Asaas

**Files:**
- Create: `src/app/api/asaas/[id]/backfill-expenses/route.ts`

- [ ] **Step 1: Criar a rota**

`src/app/api/asaas/[id]/backfill-expenses/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { listTransfers, paginate, type AsaasEnv, type AsaasTransfer } from '@/lib/asaas/client'
import { isFysiTransfer, mapTransferToExpense } from '@/lib/asaas/transfers'

// Vercel: máximo permitido pro plano Pro.
export const maxDuration = 60

// Importa transferências de saída (DONE) da conta Asaas como despesas.
// Ignora as transferências para a própria Fysi (movimentação interna).
// UPSERT idempotente por (integration_id, external_id).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: integrationId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { data: integration, error: intErr } = await supabase
    .from('asaas_integrations')
    .select('id, user_id, account_id, api_key, environment')
    .eq('id', integrationId)
    .single()

  if (intErr || !integration) {
    return NextResponse.json({ error: 'integration not found' }, { status: 404 })
  }

  const admin = createAdminClient()
  const env = integration.environment as AsaasEnv
  const apiKey = integration.api_key

  const url = new URL(request.url)
  const fromParam = url.searchParams.get('from')
  const toParam = url.searchParams.get('to')

  let imported = 0
  let failed = 0
  let ignoredFysi = 0
  let firstError: string | null = null

  const iter = paginate<AsaasTransfer>((offset) =>
    listTransfers(env, apiKey, {
      limit: 100,
      offset,
      ...(fromParam ? { dateCreatedGe: fromParam } : {}),
      ...(toParam ? { dateCreatedLe: toParam } : {}),
    }),
  )

  const batch: Array<Record<string, unknown>> = []
  const BATCH_SIZE = 100

  const flush = async () => {
    if (batch.length === 0) return
    const { error } = await admin
      .from('transactions')
      .upsert(batch, { onConflict: 'integration_id,external_id' })
    if (error) {
      console.error('[backfill-expenses] batch upsert error:', error)
      if (!firstError) firstError = `${error.code ?? ''} ${error.message}`.trim()
      failed += batch.length
    } else {
      imported += batch.length
    }
    batch.length = 0
  }

  for await (const t of iter) {
    if (t.status !== 'DONE') continue
    if (isFysiTransfer(t)) { ignoredFysi++; continue }

    const m = mapTransferToExpense(t)
    batch.push({
      user_id: integration.user_id,
      type: m.type,
      amount: m.amount,
      description: m.description,
      category: m.category,
      custom_category: m.custom_category,
      date: m.date,
      account_id: integration.account_id,
      payment_method: m.payment_method,
      integration_id: integration.id,
      external_id: t.id,
      notes: m.notes,
    })

    if (batch.length >= BATCH_SIZE) await flush()
  }
  await flush()

  return NextResponse.json({
    ok: true,
    imported,
    failed,
    ignoredFysi,
    firstError,
    range: { from: fromParam, to: toParam },
  })
}
```

- [ ] **Step 2: Verificar compilação e lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add 'src/app/api/asaas/[id]/backfill-expenses/route.ts'
git commit -m "feat: rota de backfill de despesas (transferências) do Asaas"
```

---

### Task 14: Botão "Importar despesas" nas Integrações

**Files:**
- Modify: `src/lib/asaas/integrations.ts`
- Modify: `src/app/(dashboard)/settings/integrations/page.tsx`

- [ ] **Step 1: Adicionar `runExpenseBackfill` ao cliente**

No fim de `src/lib/asaas/integrations.ts`, antes de `export function webhookUrl`, adicionar:

```ts
export async function runExpenseBackfill(
  id: string,
): Promise<{ imported: number; failed: number; ignoredFysi: number; firstError?: string | null }> {
  const res = await fetch(`/api/asaas/${id}/backfill-expenses`, { method: 'POST' })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
```

- [ ] **Step 2: Importar a função e o ícone na página**

Em `settings/integrations/page.tsx`, na importação de `@/lib/asaas/integrations`, adicionar `runExpenseBackfill`:

```ts
import {
  listIntegrations, createIntegration, deleteIntegration, toggleIntegration,
  runBackfill, runExpenseBackfill, webhookUrl, type AsaasIntegration,
} from '@/lib/asaas/integrations'
```

Na importação de `lucide-react`, adicionar `TrendingDown`:

```ts
import { Plus, Trash2, RefreshCw, Copy, Plug, Loader2, Power, PowerOff, TrendingDown } from 'lucide-react'
```

- [ ] **Step 3: Adicionar o handler**

Logo após a função `handleBackfill`, adicionar:

```ts
  async function handleExpenseBackfill(id: string) {
    setBusy(id)
    try {
      const r = await runExpenseBackfill(id)
      if (r.failed > 0 && r.imported === 0) {
        toast.error(`Importação falhou — ${r.failed} despesas não importadas`, {
          description: r.firstError ?? 'Erro desconhecido — ver logs Vercel',
        })
      } else {
        toast.success(`${r.imported} despesa(s) importada(s)`, {
          description: `${r.ignoredFysi} transferência(s) para a Fysi ignorada(s)`,
        })
      }
      fetchData()
    } catch (e) { toast.error('Erro na importação de despesas', { description: (e as Error).message }) }
    finally { setBusy(null) }
  }
```

- [ ] **Step 4: Adicionar o botão**

No bloco de botões de cada card (a `<div className="flex gap-1 shrink-0">`), localizar o botão de backfill (o que tem `title="Importar cobranças passadas"`) e inserir **logo após o `</button>` dele**:

```tsx
                      <button onClick={() => handleExpenseBackfill(it.id)} disabled={busy === it.id}
                        title="Importar despesas (transferências de saída)"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50">
                        {busy === it.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <TrendingDown className="h-3.5 w-3.5" />}
                      </button>
```

- [ ] **Step 5: Verificar compilação, lint e build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: sem erros; build conclui.

- [ ] **Step 6: Verificação manual**

Run: `npm run dev`, abrir `/settings/integrations`. Confirmar que o botão de despesas (ícone de seta para baixo) aparece no card da integração. Clicar e confirmar o toast com "X despesa(s) importada(s) · Y transferência(s) para a Fysi ignorada(s)". Conferir em `/transactions` que as despesas do Asaas apareceram e em `/categorizar` (modo Despesas, origem "Asaas") que aparecem agrupadas por destinatário.

- [ ] **Step 7: Commit**

```bash
git add src/lib/asaas/integrations.ts 'src/app/(dashboard)/settings/integrations/page.tsx'
git commit -m "feat: botão de importar despesas do Asaas nas Integrações"
```

---

## Fase 4 — Exportar PDF do Panorama

### Task 15: Botão "Exportar PDF" e estilos de impressão

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/(dashboard)/layout.tsx`
- Modify: `src/app/(dashboard)/panorama/page.tsx`

- [ ] **Step 1: Adicionar a regra de impressão ao `globals.css`**

No fim de `src/app/globals.css`, adicionar:

```css
@media print {
  /* Garante que cores de gráficos e cards saiam no PDF */
  * {
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }
}
```

- [ ] **Step 2: Esconder a navegação na impressão (`layout.tsx`)**

Em `src/app/(dashboard)/layout.tsx`, adicionar `print:hidden` à sidebar e envolver a `MobileNav`:

Localizar:
```tsx
      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      {/* Mobile nav */}
      <MobileNav />
```

Substituir por:
```tsx
      {/* Desktop sidebar */}
      <div className="hidden md:flex print:hidden">
        <Sidebar />
      </div>

      {/* Mobile nav */}
      <div className="print:hidden">
        <MobileNav />
      </div>
```

- [ ] **Step 3: Importar o ícone de impressão no Panorama**

Em `panorama/page.tsx`, na importação de `lucide-react`, adicionar `Printer`:

```ts
import {
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  Wallet, Target, Repeat, Briefcase, AlertCircle, ChevronRight, Printer,
} from 'lucide-react'
```

- [ ] **Step 4: Adicionar o botão e o cabeçalho de impressão**

No JSX do cabeçalho, localizar o bloco do alternador de período:

```tsx
        <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs">
          <button onClick={() => setPeriod('month')}
            className={`px-3 py-1 rounded-md font-medium ${period === 'month' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
            Este mês
          </button>
          <button onClick={() => setPeriod('year')}
            className={`px-3 py-1 rounded-md font-medium ${period === 'year' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
            Este ano
          </button>
        </div>
```

Substituir por:

```tsx
        <div className="flex items-center gap-2 print:hidden">
          <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs">
            <button onClick={() => setPeriod('month')}
              className={`px-3 py-1 rounded-md font-medium ${period === 'month' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
              Este mês
            </button>
            <button onClick={() => setPeriod('year')}
              className={`px-3 py-1 rounded-md font-medium ${period === 'year' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
              Este ano
            </button>
          </div>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => window.print()}>
            <Printer className="h-3.5 w-3.5" />
            Exportar PDF
          </Button>
        </div>
```

Logo após a tag `<div className="space-y-5 max-w-5xl">` que abre o componente, inserir o cabeçalho que só aparece na impressão:

```tsx
      <div className="hidden print:block mb-4">
        <p className="text-xs text-slate-500">
          Panorama — {periodLabel} · gerado em {new Date().toLocaleDateString('pt-BR')}
        </p>
      </div>
```

(Observação: `periodLabel` é definido mais abaixo no componente; como o JSX é avaliado no render, a referência é válida. Se o linter reclamar de uso antes da definição, mover a definição de `periodLabel`/`prevPeriodLabel` para antes do `return`.)

- [ ] **Step 5: Esconder a grade de atalhos na impressão**

Localizar o comentário `{/* Atalhos */}` e, na `<div>` logo abaixo dele, adicionar `print:hidden`:

```tsx
          {/* Atalhos */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 print:hidden">
```

- [ ] **Step 6: Evitar cortar cards entre páginas**

Para os cards principais não serem cortados na quebra de página, adicionar a classe `break-inside-avoid` aos contêineres de seção. Nos seguintes elementos do JSX do Panorama, acrescentar `break-inside-avoid` à lista de classes:
- a `<div className="grid grid-cols-2 lg:grid-cols-4 gap-3">` (KPIs)
- a `<div className="grid grid-cols-1 lg:grid-cols-2 gap-3">` (MRR + custos)
- o `<Card>` do gráfico "Evolução"
- a `<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">` (breakdowns)
- o `<Card>` "Despesa por origem"
- o `<Card>` "Top 5 clientes"

Exemplo (KPIs): `className="grid grid-cols-2 lg:grid-cols-4 gap-3 break-inside-avoid"`.

- [ ] **Step 7: Verificar compilação, lint e build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: sem erros; build conclui.

- [ ] **Step 8: Verificação manual**

Run: `npm run dev`, abrir `/panorama`, clicar em "Exportar PDF". Confirmar no diálogo de impressão: sidebar/menu e botões interativos somem; aparece o cabeçalho "Panorama — … · gerado em …"; gráficos e cores aparecem; cards não são cortados no meio. Salvar como PDF e conferir.

- [ ] **Step 9: Commit**

```bash
git add src/app/globals.css 'src/app/(dashboard)/layout.tsx' 'src/app/(dashboard)/panorama/page.tsx'
git commit -m "feat: exportar PDF do Panorama via impressão do navegador"
```

---

## Verificação final

- [ ] Rodar a suíte completa: `npx vitest run` — todos os testes passam.
- [ ] Rodar `npm run build` — conclui sem erros.
- [ ] Rodar `npm run lint` — sem erros.
- [ ] Conferir manualmente no app: Panorama (tendência, comparativo Jan–mês, despesa por origem, exportar PDF), `/categorizar` (filtro de origem), `/import` (auto-categoria), `/settings/integrations` (importar despesas do Asaas).

## Notas de auto-revisão (cobertura do spec)

- Funcionalidade 1 (Export PDF) → Task 15.
- Funcionalidade 2a (auto-categorização na importação) → Tasks 5, 6, 7.
- Funcionalidade 2b (`/categorizar` enxerga cartão + filtro de origem) → Tasks 8, 9.
- Funcionalidade 2c (card Despesa por origem) → Tasks 2, 2.1, 10.
- Funcionalidade 3a (gráfico de tendência) → Tasks 2, 4.
- Funcionalidade 3b (correção do comparativo anual) → Tasks 2, 3.
- Funcionalidade 4 (importar despesas do Asaas) → Tasks 11, 12, 13, 14.
