# Workspaces (Empresa/Pessoal) + Relatórios Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar dois workspaces isolados (`business` Fysi atual + `personal` novo vazio) com toggle no header, categorias PF próprias, importação contextual; e relatórios com período custom + comparação A vs B.

**Architecture:** Coluna `workspace text` (default `'business'`) nas tabelas user-scoped. Cookie + React Context propaga workspace ativo. Todas queries de `lib/*` filtram por workspace. Sidebar filtra itens. Categorias PF são novo enum TS isolado. Relatórios usam `?from=&to=` (YYYY-MM) com presets e comparador.

**Tech Stack:** Next.js 16.2, React 19, Supabase (`@supabase/ssr` cookies), TypeScript, Tailwind, Recharts, Vitest, date-fns.

**Scope note:** Plano cobre 7 fases (Foundation → Filtros → Menu → Categorias PF → Importação PF → Relatórios período → Relatórios comparação). Cada fase termina commitável. Spec: [docs/superpowers/specs/2026-05-25-workspaces-pessoal-e-relatorios-design.md](../specs/2026-05-25-workspaces-pessoal-e-relatorios-design.md).

**Convenções:**
- Testes unitários puros (sem rede): `vitest run path/to/test.ts`.
- UI/integração: validação manual no `npm run dev`, sem testes E2E aqui.
- Cada commit usa Conventional Commits.
- Antes de implementar qualquer rota Next 16, ler `node_modules/next/dist/docs/` se houver dúvida sobre API (mandato do `AGENTS.md`).

---

## Fase 1 — Foundation: Migration + Workspace Context

Adiciona coluna `workspace` no banco, helpers server/client de workspace, seletor visual no header. Sem mudança funcional vísivel (workspace sempre `business` enquanto não trocar).

### Task 1.1: Migration SQL para coluna `workspace`

**Files:**
- Create: `supabase/migrations/012_workspaces.sql`

- [ ] **Step 1: Criar o arquivo de migration**

```sql
-- ============================================================
-- FinançasPRO — Migration 012: Workspaces (business | personal)
--   Adiciona coluna workspace nas tabelas user-scoped pra
--   segregar dados entre o workspace 'business' (Fysi) e o
--   novo workspace 'personal' (vida pessoal, começa vazio).
-- Idempotente.
-- ============================================================

-- Tabelas user-scoped recebem a coluna
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS workspace TEXT NOT NULL DEFAULT 'business';

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS workspace TEXT NOT NULL DEFAULT 'business';

ALTER TABLE public.credit_cards
  ADD COLUMN IF NOT EXISTS workspace TEXT NOT NULL DEFAULT 'business';

ALTER TABLE public.categorization_rules
  ADD COLUMN IF NOT EXISTS workspace TEXT NOT NULL DEFAULT 'business';

ALTER TABLE public.fixed_costs
  ADD COLUMN IF NOT EXISTS workspace TEXT NOT NULL DEFAULT 'business';

ALTER TABLE public.integrations
  ADD COLUMN IF NOT EXISTS workspace TEXT NOT NULL DEFAULT 'business';

ALTER TABLE public.reminders
  ADD COLUMN IF NOT EXISTS workspace TEXT NOT NULL DEFAULT 'business';

-- CHECK constraint pra restringir valores válidos (drop+recreate pra idempotência)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transactions_workspace_check') THEN
    ALTER TABLE public.transactions DROP CONSTRAINT transactions_workspace_check;
  END IF;
END $$;
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_workspace_check CHECK (workspace IN ('business', 'personal'));

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'accounts_workspace_check') THEN
    ALTER TABLE public.accounts DROP CONSTRAINT accounts_workspace_check;
  END IF;
END $$;
ALTER TABLE public.accounts
  ADD CONSTRAINT accounts_workspace_check CHECK (workspace IN ('business', 'personal'));

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'credit_cards_workspace_check') THEN
    ALTER TABLE public.credit_cards DROP CONSTRAINT credit_cards_workspace_check;
  END IF;
END $$;
ALTER TABLE public.credit_cards
  ADD CONSTRAINT credit_cards_workspace_check CHECK (workspace IN ('business', 'personal'));

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'categorization_rules_workspace_check') THEN
    ALTER TABLE public.categorization_rules DROP CONSTRAINT categorization_rules_workspace_check;
  END IF;
END $$;
ALTER TABLE public.categorization_rules
  ADD CONSTRAINT categorization_rules_workspace_check CHECK (workspace IN ('business', 'personal'));

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fixed_costs_workspace_check') THEN
    ALTER TABLE public.fixed_costs DROP CONSTRAINT fixed_costs_workspace_check;
  END IF;
END $$;
ALTER TABLE public.fixed_costs
  ADD CONSTRAINT fixed_costs_workspace_check CHECK (workspace IN ('business', 'personal'));

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'integrations_workspace_check') THEN
    ALTER TABLE public.integrations DROP CONSTRAINT integrations_workspace_check;
  END IF;
END $$;
ALTER TABLE public.integrations
  ADD CONSTRAINT integrations_workspace_check CHECK (workspace IN ('business', 'personal'));

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reminders_workspace_check') THEN
    ALTER TABLE public.reminders DROP CONSTRAINT reminders_workspace_check;
  END IF;
END $$;
ALTER TABLE public.reminders
  ADD CONSTRAINT reminders_workspace_check CHECK (workspace IN ('business', 'personal'));

-- Índices pra performance dos filtros frequentes
CREATE INDEX IF NOT EXISTS transactions_user_workspace_date_idx
  ON public.transactions (user_id, workspace, date DESC);

CREATE INDEX IF NOT EXISTS accounts_user_workspace_idx
  ON public.accounts (user_id, workspace);

CREATE INDEX IF NOT EXISTS credit_cards_user_workspace_idx
  ON public.credit_cards (user_id, workspace);

CREATE INDEX IF NOT EXISTS categorization_rules_user_workspace_idx
  ON public.categorization_rules (user_id, workspace);
```

- [ ] **Step 2: Verificar tabelas no banco real**

Run: `grep -l "CREATE TABLE" supabase/migrations/*.sql | xargs grep "CREATE TABLE public\." | head -20`

Confere os nomes exatos das tabelas. Se `reminders`, `fixed_costs` ou `categorization_rules` não existirem como esperado, **remover** a linha respectiva da migration acima antes de aplicar.

- [ ] **Step 3: Aplicar a migration**

Use o MCP `apply_migration` do Supabase (não usar a CLI):

```
apply_migration(name="012_workspaces", query=<conteúdo do arquivo>)
```

Expected: sem erro. As tabelas existentes ganham `workspace='business'` em todas as linhas.

- [ ] **Step 4: Validar via execute_sql**

```sql
SELECT COUNT(*) FROM transactions WHERE workspace = 'business';
SELECT COUNT(*) FROM transactions WHERE workspace = 'personal';
```

Expected: o primeiro retorna total atual, o segundo retorna 0.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/012_workspaces.sql
git commit -m "feat(db): add workspace column to user-scoped tables"
```

---

### Task 1.2: Tipos TypeScript de Workspace

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Adicionar tipo `WorkspaceType` no topo da seção Transaction Types**

Inserir logo após a linha `export type PaymentMethod = ...`:

```ts
// ─── Workspace Types ─────────────────────────────────────────────────────────

export type WorkspaceType = 'business' | 'personal'

export const WORKSPACE_LABELS: Record<WorkspaceType, string> = {
  business: 'Fysi',
  personal: 'Pessoal',
}
```

- [ ] **Step 2: Adicionar `workspace` aos interfaces que ganharam a coluna**

Em `Transaction`, `Account`, `CreditCard`, adicionar a propriedade `workspace: WorkspaceType` (depois de `user_id`). Exemplo para `Transaction`:

```ts
export interface Transaction {
  id: string
  user_id: string
  workspace: WorkspaceType
  type: TransactionType
  // ... resto igual
}
```

Repetir para `Account` e `CreditCard`. Os outros (`categorization_rules`, `fixed_costs`, `integrations`, `reminders`) atualizar quando forem tocados nas fases seguintes.

- [ ] **Step 3: Verificar compilação**

Run: `npx tsc --noEmit`
Expected: pode ter erros temporários sobre `workspace` faltando em mocks/tests — ignorar por enquanto, serão corrigidos nas próximas tasks.

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): add WorkspaceType and workspace field on core entities"
```

---

### Task 1.3: Helpers server-side de workspace

**Files:**
- Create: `src/lib/workspace.ts`
- Test: `src/lib/workspace.test.ts`

- [ ] **Step 1: Escrever teste falhando para `parseWorkspace`**

```ts
// src/lib/workspace.test.ts
import { describe, it, expect } from 'vitest'
import { parseWorkspace } from './workspace'

describe('parseWorkspace', () => {
  it('returns business as default when value is undefined', () => {
    expect(parseWorkspace(undefined)).toBe('business')
  })

  it('returns business when value is empty', () => {
    expect(parseWorkspace('')).toBe('business')
  })

  it('returns personal when value is personal', () => {
    expect(parseWorkspace('personal')).toBe('personal')
  })

  it('returns business when value is business', () => {
    expect(parseWorkspace('business')).toBe('business')
  })

  it('falls back to business for invalid values', () => {
    expect(parseWorkspace('xyz')).toBe('business')
  })
})
```

- [ ] **Step 2: Rodar o teste pra ver falhar**

Run: `npx vitest run src/lib/workspace.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar `parseWorkspace`**

```ts
// src/lib/workspace.ts
import type { WorkspaceType } from '@/types'

export const WORKSPACE_COOKIE = 'workspace'
export const DEFAULT_WORKSPACE: WorkspaceType = 'business'

export function parseWorkspace(value: string | undefined | null): WorkspaceType {
  if (value === 'personal' || value === 'business') return value
  return DEFAULT_WORKSPACE
}
```

- [ ] **Step 4: Rodar teste pra confirmar PASS**

Run: `npx vitest run src/lib/workspace.test.ts`
Expected: 5 PASS.

- [ ] **Step 5: Adicionar `getServerWorkspace` (não testável unit; usado em SSR)**

Append em `src/lib/workspace.ts`:

```ts
import { cookies } from 'next/headers'

export async function getServerWorkspace(): Promise<WorkspaceType> {
  const store = await cookies()
  return parseWorkspace(store.get(WORKSPACE_COOKIE)?.value)
}
```

- [ ] **Step 6: Adicionar server action `setWorkspaceAction`**

Append em `src/lib/workspace.ts`:

```ts
'use server'

export async function setWorkspaceAction(value: WorkspaceType): Promise<void> {
  const store = await cookies()
  store.set(WORKSPACE_COOKIE, parseWorkspace(value), {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })
}
```

**Nota:** Next 16 server actions exigem `'use server'` no topo do arquivo OU por função. Como a função `parseWorkspace` é pura e usada em ambos lados, separar: criar `src/lib/workspace-actions.ts` em vez de mesclar.

- [ ] **Step 7: Refatorar: separar actions em arquivo próprio**

Mover `setWorkspaceAction` para `src/lib/workspace-actions.ts`:

```ts
// src/lib/workspace-actions.ts
'use server'

import { cookies } from 'next/headers'
import type { WorkspaceType } from '@/types'
import { WORKSPACE_COOKIE, parseWorkspace } from './workspace'

export async function setWorkspaceAction(value: WorkspaceType): Promise<void> {
  const store = await cookies()
  store.set(WORKSPACE_COOKIE, parseWorkspace(value), {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })
}
```

E remover do `workspace.ts` original (deixar só `parseWorkspace`, `WORKSPACE_COOKIE`, `DEFAULT_WORKSPACE`, `getServerWorkspace`).

- [ ] **Step 8: Verificar testes ainda passam**

Run: `npx vitest run src/lib/workspace.test.ts`
Expected: 5 PASS.

- [ ] **Step 9: Commit**

```bash
git add src/lib/workspace.ts src/lib/workspace-actions.ts src/lib/workspace.test.ts
git commit -m "feat(lib): workspace cookie helpers and server action"
```

---

### Task 1.4: WorkspaceProvider (Context React)

**Files:**
- Create: `src/components/workspace/workspace-provider.tsx`
- Create: `src/hooks/use-workspace.ts`

- [ ] **Step 1: Criar o provider**

```tsx
// src/components/workspace/workspace-provider.tsx
'use client'

import { createContext, type ReactNode } from 'react'
import type { WorkspaceType } from '@/types'

export const WorkspaceContext = createContext<WorkspaceType>('business')

export function WorkspaceProvider({
  value,
  children,
}: {
  value: WorkspaceType
  children: ReactNode
}) {
  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  )
}
```

- [ ] **Step 2: Criar hook**

```ts
// src/hooks/use-workspace.ts
'use client'

import { useContext } from 'react'
import { WorkspaceContext } from '@/components/workspace/workspace-provider'

export function useWorkspace() {
  return useContext(WorkspaceContext)
}
```

- [ ] **Step 3: Integrar no `(dashboard)/layout.tsx`**

Edit `src/app/(dashboard)/layout.tsx` — buscar workspace no server e injetar:

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/dashboard/sidebar'
import { MobileNav } from '@/components/dashboard/mobile-nav'
import { WorkspaceProvider } from '@/components/workspace/workspace-provider'
import { getServerWorkspace } from '@/lib/workspace'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const workspace = await getServerWorkspace()

  return (
    <WorkspaceProvider value={workspace}>
      <div className="flex min-h-screen bg-canvas">
        <div className="hidden md:flex print:hidden">
          <Sidebar />
        </div>
        <div className="print:hidden">
          <MobileNav />
        </div>
        <main className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 p-4 md:p-8 pb-32 md:pb-8">
            {children}
          </div>
        </main>
      </div>
    </WorkspaceProvider>
  )
}
```

- [ ] **Step 4: Verificar compilação e dev**

Run: `npm run dev` em background; abrir `http://localhost:3000/dashboard`.
Expected: app carrega normal, sem mudança visual.

- [ ] **Step 5: Commit**

```bash
git add src/components/workspace/workspace-provider.tsx src/hooks/use-workspace.ts src/app/\(dashboard\)/layout.tsx
git commit -m "feat(workspace): WorkspaceProvider context wired in dashboard layout"
```

---

### Task 1.5: Seletor de workspace no header

**Files:**
- Create: `src/components/workspace/workspace-switcher.tsx`
- Modify: `src/components/dashboard/sidebar.tsx`
- Modify: `src/components/dashboard/mobile-nav.tsx`

- [ ] **Step 1: Criar o switcher**

```tsx
// src/components/workspace/workspace-switcher.tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, User, Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWorkspace } from '@/hooks/use-workspace'
import { setWorkspaceAction } from '@/lib/workspace-actions'
import type { WorkspaceType } from '@/types'

const WORKSPACES: { value: WorkspaceType; label: string; Icon: typeof Building2; color: string }[] = [
  { value: 'business', label: 'Fysi', Icon: Building2, color: 'text-emerald-600' },
  { value: 'personal', label: 'Pessoal', Icon: User, color: 'text-indigo-600' },
]

export function WorkspaceSwitcher() {
  const current = useWorkspace()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const active = WORKSPACES.find((w) => w.value === current) ?? WORKSPACES[0]
  const ActiveIcon = active.Icon

  function pick(value: WorkspaceType) {
    setOpen(false)
    if (value === current) return
    startTransition(async () => {
      await setWorkspaceAction(value)
      router.refresh()
    })
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={isPending}
        className={cn(
          'flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[13px] font-medium border border-stone-200/60 bg-white hover:bg-stone-50 transition-colors',
          isPending && 'opacity-50',
        )}
      >
        <ActiveIcon className={cn('h-3.5 w-3.5', active.color)} />
        <span className="text-stone-700">{active.label}</span>
        <ChevronDown className="h-3 w-3 text-stone-400" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-20 w-44 bg-white border border-stone-200 rounded-lg shadow-lg py-1">
            {WORKSPACES.map((w) => {
              const Icon = w.Icon
              return (
                <button
                  key={w.value}
                  onClick={() => pick(w.value)}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-[13px] text-stone-700 hover:bg-stone-50 text-left"
                >
                  <Icon className={cn('h-3.5 w-3.5', w.color)} />
                  <span className="flex-1">{w.label}</span>
                  {w.value === current && <Check className="h-3.5 w-3.5 text-stone-400" />}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Inserir no `Sidebar`**

Edit `src/components/dashboard/sidebar.tsx`. Adicionar import e renderizar logo após o `<Logo />`:

```tsx
import { WorkspaceSwitcher } from '@/components/workspace/workspace-switcher'
```

E dentro do `<aside>`, substituir o bloco do logo por:

```tsx
<div className="px-2 mb-4 flex flex-col gap-3">
  <Logo size="md" />
  <WorkspaceSwitcher />
</div>
<div className="hairline mb-4 mx-2" />
```

- [ ] **Step 3: Inserir no `MobileNav` (header da versão mobile)**

Edit `src/components/dashboard/mobile-nav.tsx`. Identificar onde está o header (provavelmente um `<header>` ou topo); adicionar `<WorkspaceSwitcher />` no canto. Se o mobile-nav atual não tem header próprio, adicionar um:

Ler o arquivo todo primeiro:

```bash
cat src/components/dashboard/mobile-nav.tsx
```

E inserir o `<WorkspaceSwitcher />` no topo de forma análoga ao desktop. **Se o layout mobile não tiver header visível, criar um header simples no `(dashboard)/layout.tsx` só para mobile** (`md:hidden`) contendo o switcher.

- [ ] **Step 4: Testar manualmente**

`npm run dev` → abre `/dashboard` → confirma:
- Switcher aparece no sidebar mostrando "Fysi"
- Click → dropdown abre → click em "Pessoal" → cookie é setado → app refresh
- Cookie persiste: refresh da página continua em "Pessoal"
- Click em "Fysi" volta ao normal

- [ ] **Step 5: Commit**

```bash
git add src/components/workspace/workspace-switcher.tsx src/components/dashboard/sidebar.tsx src/components/dashboard/mobile-nav.tsx
git commit -m "feat(workspace): header switcher with cookie persistence"
```

---

## Fase 2 — Filtro de workspace nas queries

Faz com que toda função de leitura/escrita em `lib/` respeite o workspace ativo. Após esta fase, alternar para Pessoal mostra app **vazia** (porque tudo é `business`).

### Task 2.1: Helper de cliente Supabase que retorna workspace atual

**Files:**
- Modify: `src/lib/workspace.ts`

- [ ] **Step 1: Adicionar `getClientWorkspace` (lê cookie no client)**

Append:

```ts
export function getClientWorkspace(): WorkspaceType {
  if (typeof document === 'undefined') return DEFAULT_WORKSPACE
  const match = document.cookie.match(/(?:^|;\s*)workspace=([^;]+)/)
  return parseWorkspace(match?.[1])
}
```

- [ ] **Step 2: Teste unitário simples**

Anexar em `src/lib/workspace.test.ts`:

```ts
import { getClientWorkspace } from './workspace'

describe('getClientWorkspace', () => {
  beforeEach(() => {
    // Reset document.cookie pra cada teste
    Object.defineProperty(document, 'cookie', { writable: true, value: '' })
  })

  it('returns business when no cookie present', () => {
    expect(getClientWorkspace()).toBe('business')
  })

  it('returns personal when cookie is workspace=personal', () => {
    document.cookie = 'workspace=personal'
    expect(getClientWorkspace()).toBe('personal')
  })
})
```

- [ ] **Step 3: Rodar testes**

Run: `npx vitest run src/lib/workspace.test.ts`
Expected: 7 PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/workspace.ts src/lib/workspace.test.ts
git commit -m "feat(lib): client-side workspace cookie reader"
```

---

### Task 2.2: Filtrar `getTransactions` por workspace

**Files:**
- Modify: `src/lib/transactions.ts`

- [ ] **Step 1: Atualizar assinatura e implementação de `getTransactions`**

Edit `src/lib/transactions.ts:141-181`:

```ts
import { getClientWorkspace } from '@/lib/workspace'
// ... topo do arquivo

export async function getTransactions(filters?: {
  month?: number
  year?: number
  category?: string
  subcategory?: string
  type?: string
  accountId?: string
  creditCardId?: string
  workspace?: WorkspaceType
}): Promise<Transaction[]> {
  const supabase = createClient()
  const workspace = filters?.workspace ?? getClientWorkspace()
  let query = supabase
    .from('transactions')
    .select('*')
    .eq('workspace', workspace)
    .order('date', { ascending: false })

  // resto da função igual ...
}
```

Importar `WorkspaceType` no topo do arquivo:

```ts
import type { Transaction, TransactionFormData, WorkspaceType } from '@/types'
```

- [ ] **Step 2: Atualizar `createTransaction` para inserir `workspace`**

Em todos os `.insert(...)` dentro de `createTransaction` (3 ramos: credit_card installments, income installments, single), adicionar `workspace: getClientWorkspace()` ao record. Exemplo no ramo único (search por `// Single transaction`):

Antes:
```ts
const { data: created, error } = await supabase
  .from('transactions')
  .insert({ ...baseData, user_id: user.id })
  .select()
```

Depois:
```ts
const workspace = getClientWorkspace()
const { data: created, error } = await supabase
  .from('transactions')
  .insert({ ...baseData, user_id: user.id, workspace })
  .select()
```

Fazer o equivalente nos dois ramos de installments (adicionar `workspace` ao `records.map(...)`).

- [ ] **Step 3: Procurar outras funções que leem `transactions`**

Run: `grep -n "from('transactions')" src/lib/transactions.ts`

Para cada query, adicionar `.eq('workspace', workspace)` (onde `workspace = getClientWorkspace()` no início). Funções afetadas tipicamente:
- `applyCategoryToSimilarTransactions`
- `findCategoryByDescriptionPattern`
- `getUsedBuiltInCategories`
- `getTransactionById`
- `updateTransaction` (mantém workspace na update, mas o filtro WHERE deve incluir workspace)
- `deleteTransaction`

Para cada uma: adicionar leitura do workspace no início e `.eq('workspace', workspace)` em `.from('transactions')`.

- [ ] **Step 4: Verificar com grep que não escapou nenhuma**

Run: `grep -n "from('transactions')" src/lib/*.ts`
Verificar que `bulk-categorize.ts`, `panorama.ts`, etc., também recebem o filtro. Aplicar mesmo padrão.

- [ ] **Step 5: Rodar testes existentes**

Run: `npx vitest run`
Expected: PASS (testes de bank-csv, expense-key, panorama, workspace). Se algum falhar por causa de `workspace` faltando em mocks, atualizar o mock para incluir `workspace: 'business'`.

- [ ] **Step 6: Validação manual rápida**

`npm run dev` → workspace=business: tudo normal. Trocar para Pessoal → dashboard zerado, transactions vazia.

- [ ] **Step 7: Commit**

```bash
git add src/lib/transactions.ts src/lib/bulk-categorize.ts src/lib/panorama.ts
git commit -m "feat(transactions): filter and insert respect active workspace"
```

---

### Task 2.3: Filtrar `accounts` e `credit-cards` por workspace

**Files:**
- Modify: `src/lib/accounts.ts`
- Modify: `src/lib/credit-cards.ts`

- [ ] **Step 1: Atualizar todas queries em `accounts.ts`**

Run: `grep -n "from('accounts')" src/lib/accounts.ts`

Para cada função (`getAccounts`, `getAccountById`, `createAccount`, `updateAccount`, `deleteAccount`):

- Leitura: `.eq('workspace', getClientWorkspace())`
- Insert: `workspace: getClientWorkspace()` no record

Importar `WorkspaceType` se necessário e `getClientWorkspace` de `@/lib/workspace`.

- [ ] **Step 2: Atualizar todas queries em `credit-cards.ts`**

Análogo ao step 1, mas para `from('credit_cards')`.

- [ ] **Step 3: Rodar testes**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 4: Validar manualmente**

Workspace Pessoal → `/settings/accounts` vazia. `/settings/cards` vazia.

- [ ] **Step 5: Commit**

```bash
git add src/lib/accounts.ts src/lib/credit-cards.ts
git commit -m "feat(accounts,cards): filter and insert by workspace"
```

---

### Task 2.4: Filtrar `fixed-costs`, `reminders`, `forecast` e demais libs

**Files:**
- Modify: `src/lib/fixed-costs.ts`
- Modify: `src/lib/reminders.ts`
- Modify: `src/lib/forecast.ts` (se ler `fixed_costs` ou `transactions`)
- Modify: `src/lib/recurring-clients.ts` (se aplicável)

- [ ] **Step 1: Identificar libs que tocam tabelas com workspace**

Run: `grep -ln "from('\\(transactions\\|accounts\\|credit_cards\\|fixed_costs\\|categorization_rules\\|integrations\\|reminders\\)')" src/lib/`

Para cada arquivo retornado, aplicar o mesmo padrão das tasks 2.2 e 2.3.

- [ ] **Step 2: Não filtrar tabelas Fysi-only**

Funções em `a-cobrar.ts`, `closings.ts`, `recurring-clients.ts`, libs em `lib/asaas/` NÃO recebem filtro de workspace (essas tabelas não têm a coluna). Continuam só na Fysi.

- [ ] **Step 3: Rodar testes**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/
git commit -m "feat(lib): apply workspace filter to fixed-costs, reminders, forecast"
```

---

### Task 2.5: Filtrar API routes (server-side)

**Files:**
- Modify: `src/app/api/**/*.ts` (rotas que tocam tabelas workspaced)

- [ ] **Step 1: Listar API routes que tocam tabelas workspaced**

Run: `grep -rln "from('\\(transactions\\|accounts\\|credit_cards\\|fixed_costs\\|categorization_rules\\|integrations\\|reminders\\)')" src/app/api/`

- [ ] **Step 2: Para cada route, adicionar leitura de workspace via `getServerWorkspace`**

Em cada handler:

```ts
import { getServerWorkspace } from '@/lib/workspace'

// dentro do handler
const workspace = await getServerWorkspace()
// ... usar em .eq('workspace', workspace) e em inserts
```

- [ ] **Step 3: Validar build**

Run: `npm run build`
Expected: SUCCESS.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/
git commit -m "feat(api): server routes respect active workspace"
```

---

## Fase 3 — Menu lateral por workspace

### Task 3.1: Sidebar filtra itens pelo workspace

**Files:**
- Modify: `src/components/dashboard/sidebar.tsx`
- Modify: `src/components/dashboard/mobile-nav.tsx`

- [ ] **Step 1: Marcar cada item do menu com workspaces onde aparece**

Edit `src/components/dashboard/sidebar.tsx` — substituir `navItems` por:

```ts
import type { WorkspaceType } from '@/types'

const navItems: { href: string; label: string; icon: typeof LayoutDashboard; workspaces: WorkspaceType[] }[] = [
  { href: '/panorama',     label: 'Panorama',       icon: Activity,       workspaces: ['business'] },
  { href: '/dashboard',    label: 'Visão Geral',    icon: LayoutDashboard, workspaces: ['business', 'personal'] },
  { href: '/transactions', label: 'Lançamentos',    icon: ArrowLeftRight,  workspaces: ['business', 'personal'] },
  { href: '/a-cobrar',     label: 'A Cobrar',       icon: AlertCircle,     workspaces: ['business'] },
  { href: '/closings',     label: 'Fechamentos',    icon: Handshake,       workspaces: ['business'] },
  { href: '/reservas',     label: 'Reservas',       icon: PiggyBank,       workspaces: ['business'] },
  { href: '/previsao',     label: 'Previsão',       icon: LineChart,       workspaces: ['business'] },
  { href: '/reports',      label: 'Relatórios',     icon: BarChart3,       workspaces: ['business', 'personal'] },
  { href: '/cashflow',     label: 'Fluxo de Caixa', icon: CalendarCheck,   workspaces: ['business'] },
  { href: '/categorizar',  label: 'Categorizar',    icon: Sparkles,        workspaces: ['business', 'personal'] },
  { href: '/import',       label: 'Importar',       icon: Upload,          workspaces: ['business', 'personal'] },
]

const settingsItems: { href: string; label: string; workspaces: WorkspaceType[] }[] = [
  { href: '/settings/accounts',     label: 'Contas',                workspaces: ['business', 'personal'] },
  { href: '/settings/cards',        label: 'Cartões de Crédito',    workspaces: ['business', 'personal'] },
  { href: '/settings/categories',   label: 'Categorias',            workspaces: ['business', 'personal'] },
  { href: '/settings/integrations', label: 'Integrações (Asaas)',   workspaces: ['business'] },
]
```

**Nota:** Adicionar `Upload` ao import de `lucide-react`.

- [ ] **Step 2: Usar `useWorkspace` para filtrar**

Dentro do componente `Sidebar()`, antes do return:

```ts
const workspace = useWorkspace()
const visibleNav = navItems.filter((i) => i.workspaces.includes(workspace))
const visibleSettings = settingsItems.filter((i) => i.workspaces.includes(workspace))
```

E substituir `navItems.map` por `visibleNav.map`, `settingsItems.map` por `visibleSettings.map`.

Adicionar import:
```ts
import { useWorkspace } from '@/hooks/use-workspace'
```

- [ ] **Step 3: Repetir mesma lógica em `MobileNav`**

Edit `src/components/dashboard/mobile-nav.tsx` — aplicar mesma estrutura `workspaces: [...]` e filtro.

- [ ] **Step 4: Validar**

`npm run dev` → workspace=business: vê tudo. Workspace=personal: vê só `/panorama` removido, `/a-cobrar` removido, etc. — restam: Visão Geral, Lançamentos, Relatórios, Categorizar, Importar, Settings (sem Integrações).

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/sidebar.tsx src/components/dashboard/mobile-nav.tsx
git commit -m "feat(nav): filter sidebar items by active workspace"
```

---

### Task 3.2: Bloquear rotas Fysi-only quando em workspace personal

**Files:**
- Modify: `src/app/(dashboard)/a-cobrar/page.tsx`
- Modify: `src/app/(dashboard)/closings/page.tsx`
- Modify: `src/app/(dashboard)/reservas/page.tsx`
- Modify: `src/app/(dashboard)/previsao/page.tsx`
- Modify: `src/app/(dashboard)/panorama/page.tsx`
- Modify: `src/app/(dashboard)/cashflow/page.tsx`
- Modify: `src/app/(dashboard)/settings/integrations/page.tsx` (se existir)

Mesmo escondidas do menu, alguém pode digitar a URL. Bloquear servidor-side.

- [ ] **Step 1: Para cada page acima, ler arquivo e adicionar redirect no topo**

Se a página é Server Component:

```ts
import { redirect } from 'next/navigation'
import { getServerWorkspace } from '@/lib/workspace'

export default async function ACobrarPage() {
  const workspace = await getServerWorkspace()
  if (workspace !== 'business') redirect('/dashboard')
  // ... resto
}
```

Se a página é Client Component (`'use client'`), criar um wrapper Server Component que faz o check e renderiza o Client:

```tsx
// page.tsx (server)
import { redirect } from 'next/navigation'
import { getServerWorkspace } from '@/lib/workspace'
import { ACobrarClient } from './client'

export default async function Page() {
  const workspace = await getServerWorkspace()
  if (workspace !== 'business') redirect('/dashboard')
  return <ACobrarClient />
}
```

E mover o conteúdo `'use client'` antigo para `./client.tsx`.

**Caso por caso, escolher o caminho menos invasivo.** Se o page já é server, só add o redirect.

- [ ] **Step 2: Validar manualmente**

Workspace=personal → digitar `/a-cobrar` na URL → redireciona para `/dashboard`. Idem para outras rotas Fysi-only.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/
git commit -m "feat(routes): redirect Fysi-only pages when in personal workspace"
```

---

## Fase 4 — Categorias do workspace Pessoal

### Task 4.1: Tipos e labels de `PersonalCategory`

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Adicionar tipo `PersonalCategory` e mapas**

Inserir no final do arquivo:

```ts
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
```

- [ ] **Step 2: Estender `getCategoryLabel` com versão workspace-aware**

Adicionar no mesmo arquivo, perto da função `getCategoryLabel` existente:

```ts
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
    return (workspace === 'personal' ? PERSONAL_CATEGORY_COLORS.custom : CATEGORY_COLORS.custom)
  }
  if (workspace === 'personal') {
    return PERSONAL_CATEGORY_COLORS[category as PersonalCategory] ?? '#94a3b8'
  }
  return CATEGORY_COLORS[category as Category] ?? '#94a3b8'
}
```

- [ ] **Step 3: Verificar compilação**

Run: `npx tsc --noEmit`
Expected: SUCCESS.

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): personal workspace category set with labels and colors"
```

---

### Task 4.2: Form de transação usa categoria do workspace correto

**Files:**
- Modify: form de criação/edição de transação (achar via grep)

- [ ] **Step 1: Localizar componentes que listam categorias para escolha**

Run: `grep -rln "CATEGORY_LABELS\|INCOME_CATEGORIES\|EXPENSE_CATEGORIES" src/components/ src/app/`

Arquivos esperados: `transactions/transaction-form.tsx`, `categorizar/*`, possivelmente `dashboard/*`.

- [ ] **Step 2: Em cada componente que escolhe categoria, usar `useWorkspace`**

Para cada arquivo:

```ts
'use client'
import { useWorkspace } from '@/hooks/use-workspace'
import {
  PERSONAL_INCOME_CATEGORIES, PERSONAL_EXPENSE_CATEGORIES, PERSONAL_CATEGORY_LABELS,
  // ... outras existentes
} from '@/types'

// dentro do componente
const workspace = useWorkspace()
const incomeCategories = workspace === 'personal' ? PERSONAL_INCOME_CATEGORIES : INCOME_CATEGORIES
const expenseCategories = workspace === 'personal' ? PERSONAL_EXPENSE_CATEGORIES : EXPENSE_CATEGORIES
const labels = workspace === 'personal' ? PERSONAL_CATEGORY_LABELS : CATEGORY_LABELS
```

**Nota:** `INCOME_CATEGORIES`/`EXPENSE_CATEGORIES` provavelmente já existem no `types/index.ts`. Se não existirem, criar análogos para Fysi (extrair do uso atual).

- [ ] **Step 3: Validar manualmente**

`npm run dev` → workspace=personal → criar nova transação:
- Categorias mostradas são as PF (Mercado, Compras, Carro, etc.)
- Salvar funciona
- Aparece na lista com o label PF correto

Workspace=business → categorias antigas continuam aparecendo.

- [ ] **Step 4: Commit**

```bash
git add src/components/transactions/ src/app/\(dashboard\)/transactions/
git commit -m "feat(transactions): form shows category list based on workspace"
```

---

### Task 4.3: Listas e relatórios usam `getCategoryLabelByWorkspace`

**Files:**
- Modify: `src/app/(dashboard)/dashboard/page.tsx`
- Modify: `src/app/(dashboard)/transactions/page.tsx`
- Modify: `src/app/(dashboard)/reports/page.tsx`
- Modify: outros consumidores de `getCategoryLabel`

- [ ] **Step 1: Localizar callers de `getCategoryLabel`**

Run: `grep -rln "getCategoryLabel\b" src/`

- [ ] **Step 2: Em cada caller, passar a usar `getCategoryLabelByWorkspace`**

Em componentes Client: `const workspace = useWorkspace()` e chamar `getCategoryLabelByWorkspace(workspace, cat, customCategory)`.

Em renderizações inline (ex.: o `reports/page.tsx` linha 55), substituir:

```ts
const label = getCategoryLabel(t.category as Category, t.custom_category)
```

por:

```ts
const label = getCategoryLabelByWorkspace(workspace, t.category, t.custom_category)
```

Análogo para `getCategoryColorByWorkspace`. Substituir lookups em `CATEGORY_COLORS[...]` quando aplicável.

- [ ] **Step 3: Validar manualmente**

Workspace=personal com algumas transactions PF → dashboard e reports mostram labels e cores PF corretas.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/
git commit -m "feat(ui): use workspace-aware label/color helpers"
```

---

### Task 4.4: Tela `/categorizar` filtra por workspace + mostra categorias PF

**Files:**
- Modify: `src/app/(dashboard)/categorizar/page.tsx`
- Modify: componentes em `src/components/cards/categorizar*` (se houver)

- [ ] **Step 1: Inspecionar a página atual**

Run: `wc -l src/app/\(dashboard\)/categorizar/page.tsx && head -100 src/app/\(dashboard\)/categorizar/page.tsx`

- [ ] **Step 2: Confirmar que `getTransactions` já está filtrando**

Como a Task 2.2 já fez `getTransactions` respeitar workspace, a lista de transações para categorizar já vem filtrada. Resta:

- Trocar dropdown de "atribuir categoria" para usar lista PF quando workspace=personal.
- Verificar que ao salvar, a transação atualizada permanece no workspace correto (não deve mudar — `update` não toca `workspace`).

- [ ] **Step 3: Aplicar mesma lógica da Task 4.2 para o dropdown**

Inserir `useWorkspace` e selecionar entre listas PF/PJ.

- [ ] **Step 4: Validar manualmente**

Workspace=personal → `/categorizar` → importar/criar transação PF sem categoria → atribuir via dropdown que mostra categorias PF.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(dashboard\)/categorizar/
git commit -m "feat(categorizar): dropdown shows workspace-specific categories"
```

---

## Fase 5 — Importação no workspace Pessoal

### Task 5.1: `categorization_rules` filtra por workspace

**Files:**
- Modify: `src/lib/bulk-categorize.ts` (se contém matcher de rules)
- Modify: outras libs que leem `categorization_rules`

- [ ] **Step 1: Localizar callers**

Run: `grep -rln "categorization_rules" src/`

- [ ] **Step 2: Em cada leitura, filtrar por workspace**

```ts
const workspace = getClientWorkspace()
const { data: rules } = await supabase
  .from('categorization_rules')
  .select('*')
  .eq('workspace', workspace)
```

- [ ] **Step 3: Em cada inserção (criação de regra), incluir workspace**

```ts
await supabase
  .from('categorization_rules')
  .insert({ ...rule, user_id: user.id, workspace: getClientWorkspace() })
```

- [ ] **Step 4: Validar manualmente**

Workspace=business → criar uma regra "Uber → Transporte". Trocar para personal → essa regra não aparece nem é aplicada na importação. Em personal, criar regra "Uber → Transporte (PF)" — só funciona em PF.

- [ ] **Step 5: Commit**

```bash
git add src/lib/bulk-categorize.ts
git commit -m "feat(rules): categorization rules scoped by workspace"
```

---

### Task 5.2: Importação grava transações com workspace correto

**Files:**
- Modify: `src/app/(dashboard)/import/page.tsx` ou componentes relacionados
- Modify: `src/lib/bank-csv.ts` (parser/inserção)

- [ ] **Step 1: Auditar fluxo de import**

Run: `grep -rln "bank-csv\|import" src/app/\(dashboard\)/import/ src/lib/`

Identificar onde se faz `.insert()` em `transactions` durante import.

- [ ] **Step 2: Garantir que insert usa `workspace: getClientWorkspace()`**

Se a função usa `createTransaction` (já atualizada na Task 2.2), nada a fazer. Se faz insert manual, adicionar `workspace`.

- [ ] **Step 3: Validar manualmente**

Workspace=personal → `/import` → importar um CSV simples (mock pequeno) → transações aparecem só em `/transactions` do workspace personal, não no business.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/import/ src/lib/bank-csv.ts
git commit -m "feat(import): imported transactions land in active workspace"
```

---

## Fase 6 — Relatórios com período custom

### Task 6.1: `getTransactions` aceita `from`/`to` (YYYY-MM)

**Files:**
- Modify: `src/lib/transactions.ts`
- Test: `src/lib/transactions.test.ts` (novo, ou complementar)

- [ ] **Step 1: Escrever teste falhando para o range**

```ts
// src/lib/transactions.test.ts
import { describe, it, expect } from 'vitest'
import { computeDateRange } from './transactions'

describe('computeDateRange', () => {
  it('returns [first day of from, last day of to] for YYYY-MM inputs', () => {
    const { start, end } = computeDateRange('2026-01', '2026-03')
    expect(start).toBe('2026-01-01')
    expect(end).toBe('2026-03-31')
  })

  it('handles single month range (from == to)', () => {
    const { start, end } = computeDateRange('2026-05', '2026-05')
    expect(start).toBe('2026-05-01')
    expect(end).toBe('2026-05-31')
  })

  it('handles february leap year', () => {
    const { start, end } = computeDateRange('2024-02', '2024-02')
    expect(start).toBe('2024-02-01')
    expect(end).toBe('2024-02-29')
  })
})
```

- [ ] **Step 2: Rodar pra ver falhar**

Run: `npx vitest run src/lib/transactions.test.ts`
Expected: FAIL — função não exportada.

- [ ] **Step 3: Implementar `computeDateRange`**

Em `src/lib/transactions.ts`, exportar:

```ts
export function computeDateRange(from: string, to: string): { start: string; end: string } {
  const [fy, fm] = from.split('-').map(Number)
  const [ty, tm] = to.split('-').map(Number)
  const start = new Date(fy, fm - 1, 1).toISOString().split('T')[0]
  const end = new Date(ty, tm, 0).toISOString().split('T')[0]  // dia 0 do mês seguinte = último dia do mês
  return { start, end }
}
```

- [ ] **Step 4: Rodar teste**

Run: `npx vitest run src/lib/transactions.test.ts`
Expected: 3 PASS.

- [ ] **Step 5: Estender `getTransactions` para aceitar `from`/`to`**

Edit a assinatura e implementação:

```ts
export async function getTransactions(filters?: {
  month?: number
  year?: number
  from?: string   // 'YYYY-MM'
  to?: string     // 'YYYY-MM'
  category?: string
  subcategory?: string
  type?: string
  accountId?: string
  creditCardId?: string
  workspace?: WorkspaceType
}): Promise<Transaction[]> {
  const supabase = createClient()
  const workspace = filters?.workspace ?? getClientWorkspace()
  let query = supabase
    .from('transactions')
    .select('*')
    .eq('workspace', workspace)
    .order('date', { ascending: false })

  // Range (from/to) tem prioridade sobre month/year
  if (filters?.from && filters?.to) {
    const { start, end } = computeDateRange(filters.from, filters.to)
    query = query.gte('date', start).lte('date', end)
  } else if (filters?.month && filters?.year) {
    const start = new Date(filters.year, filters.month - 1, 1).toISOString().split('T')[0]
    const end = new Date(filters.year, filters.month, 0).toISOString().split('T')[0]
    query = query.gte('date', start).lte('date', end)
  }

  // resto dos filtros igual ...
}
```

- [ ] **Step 6: Validar build**

Run: `npx tsc --noEmit && npx vitest run`
Expected: SUCCESS / PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/transactions.ts src/lib/transactions.test.ts
git commit -m "feat(transactions): getTransactions accepts from/to YYYY-MM range"
```

---

### Task 6.2: Componente `PeriodSelector` com presets

**Files:**
- Create: `src/components/reports/period-selector.tsx`
- Test: `src/components/reports/period-presets.test.ts`
- Create: `src/components/reports/period-presets.ts`

- [ ] **Step 1: Definir presets**

```ts
// src/components/reports/period-presets.ts
export type PeriodPreset =
  | 'this_month' | 'last_month'
  | 'last_3_months' | 'last_6_months' | 'last_12_months'
  | 'this_year' | 'last_year'
  | 'custom'

export const PERIOD_PRESET_LABELS: Record<PeriodPreset, string> = {
  this_month: 'Este mês',
  last_month: 'Mês passado',
  last_3_months: 'Últimos 3 meses',
  last_6_months: 'Últimos 6 meses',
  last_12_months: 'Últimos 12 meses',
  this_year: 'Este ano',
  last_year: 'Ano passado',
  custom: 'Personalizado',
}

export function presetToRange(preset: PeriodPreset, now: Date = new Date()): { from: string; to: string } {
  const y = now.getFullYear()
  const m = now.getMonth() + 1
  const fmt = (yy: number, mm: number) => `${yy}-${String(mm).padStart(2, '0')}`
  const shift = (months: number): { y: number; m: number } => {
    let nm = m - months
    let ny = y
    while (nm <= 0) { nm += 12; ny-- }
    return { y: ny, m: nm }
  }

  switch (preset) {
    case 'this_month':    return { from: fmt(y, m), to: fmt(y, m) }
    case 'last_month':    { const s = shift(1); return { from: fmt(s.y, s.m), to: fmt(s.y, s.m) } }
    case 'last_3_months': { const s = shift(2); return { from: fmt(s.y, s.m), to: fmt(y, m) } }
    case 'last_6_months': { const s = shift(5); return { from: fmt(s.y, s.m), to: fmt(y, m) } }
    case 'last_12_months':{ const s = shift(11); return { from: fmt(s.y, s.m), to: fmt(y, m) } }
    case 'this_year':     return { from: fmt(y, 1),    to: fmt(y, 12) }
    case 'last_year':     return { from: fmt(y - 1, 1), to: fmt(y - 1, 12) }
    case 'custom':        return { from: fmt(y, m), to: fmt(y, m) }
  }
}
```

- [ ] **Step 2: Teste para `presetToRange`**

```ts
// src/components/reports/period-presets.test.ts
import { describe, it, expect } from 'vitest'
import { presetToRange } from './period-presets'

describe('presetToRange', () => {
  const NOW = new Date(2026, 4, 15)  // Maio 2026 (month index 4)

  it('this_month returns May 2026 single', () => {
    expect(presetToRange('this_month', NOW)).toEqual({ from: '2026-05', to: '2026-05' })
  })

  it('last_month returns April 2026 single', () => {
    expect(presetToRange('last_month', NOW)).toEqual({ from: '2026-04', to: '2026-04' })
  })

  it('last_3_months returns Mar..May 2026', () => {
    expect(presetToRange('last_3_months', NOW)).toEqual({ from: '2026-03', to: '2026-05' })
  })

  it('last_6_months returns Dec 2025..May 2026', () => {
    expect(presetToRange('last_6_months', NOW)).toEqual({ from: '2025-12', to: '2026-05' })
  })

  it('this_year returns Jan..Dec 2026', () => {
    expect(presetToRange('this_year', NOW)).toEqual({ from: '2026-01', to: '2026-12' })
  })

  it('last_year returns Jan..Dec 2025', () => {
    expect(presetToRange('last_year', NOW)).toEqual({ from: '2025-01', to: '2025-12' })
  })
})
```

- [ ] **Step 3: Rodar testes**

Run: `npx vitest run src/components/reports/period-presets.test.ts`
Expected: 6 PASS.

- [ ] **Step 4: Implementar o seletor visual**

```tsx
// src/components/reports/period-selector.tsx
'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'
import {
  type PeriodPreset, PERIOD_PRESET_LABELS, presetToRange,
} from './period-presets'

type Props = {
  from: string  // YYYY-MM
  to: string    // YYYY-MM
}

export function PeriodSelector({ from, to }: Props) {
  const router = useRouter()
  const params = useSearchParams()
  const [open, setOpen] = useState(false)

  function applyRange(nextFrom: string, nextTo: string) {
    const sp = new URLSearchParams(params.toString())
    sp.set('from', nextFrom)
    sp.set('to', nextTo)
    router.push(`?${sp.toString()}`)
  }

  function pickPreset(preset: PeriodPreset) {
    setOpen(false)
    if (preset === 'custom') return
    const { from: f, to: t } = presetToRange(preset)
    applyRange(f, t)
  }

  function onFromChange(e: React.ChangeEvent<HTMLInputElement>) {
    applyRange(e.target.value, to)
  }
  function onToChange(e: React.ChangeEvent<HTMLInputElement>) {
    applyRange(from, e.target.value)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 bg-white text-sm hover:bg-stone-50"
        >
          Período <ChevronDown className="h-3.5 w-3.5" />
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute left-0 top-full mt-1 z-20 w-52 bg-white border border-stone-200 rounded-lg shadow-lg py-1">
              {(Object.keys(PERIOD_PRESET_LABELS) as PeriodPreset[]).map((p) => (
                <button
                  key={p}
                  onClick={() => pickPreset(p)}
                  className="block w-full text-left px-3 py-2 text-sm text-stone-700 hover:bg-stone-50"
                >
                  {PERIOD_PRESET_LABELS[p]}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      <label className="flex items-center gap-1.5 text-xs text-stone-500">
        De
        <input
          type="month"
          value={from}
          onChange={onFromChange}
          className="border border-stone-200 rounded-md px-2 py-1 text-sm"
        />
      </label>
      <label className="flex items-center gap-1.5 text-xs text-stone-500">
        Até
        <input
          type="month"
          value={to}
          onChange={onToChange}
          className="border border-stone-200 rounded-md px-2 py-1 text-sm"
        />
      </label>
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/reports/
git commit -m "feat(reports): PeriodSelector with presets and date range inputs"
```

---

### Task 6.3: `/reports` lê `?from=&to=` e usa o seletor novo

**Files:**
- Modify: `src/app/(dashboard)/reports/page.tsx`

- [ ] **Step 1: Substituir o estado de período no `ReportsContent`**

Edit `src/app/(dashboard)/reports/page.tsx`:

```tsx
'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
// ... outros imports
import { PeriodSelector } from '@/components/reports/period-selector'
import { presetToRange } from '@/components/reports/period-presets'

function ReportsContent() {
  const searchParams = useSearchParams()

  // Compatibilidade: se vier ?month=&year=, traduzir para from/to do mesmo mês
  const legacyMonth = Number(searchParams.get('month'))
  const legacyYear = Number(searchParams.get('year'))

  const defaultRange = presetToRange('this_month')
  const fmt = (y: number, m: number) => `${y}-${String(m).padStart(2, '0')}`

  const from = searchParams.get('from')
    ?? (legacyMonth && legacyYear ? fmt(legacyYear, legacyMonth) : defaultRange.from)
  const to = searchParams.get('to')
    ?? (legacyMonth && legacyYear ? fmt(legacyYear, legacyMonth) : defaultRange.to)

  const [tab, setTab] = useState<Tab>('projects')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getTransactions({ from, to })
      setTransactions(data)
    } finally {
      setLoading(false)
    }
  }, [from, to])

  useEffect(() => { fetchData() }, [fetchData])

  // ... (cálculos de totais e dados de gráficos permanecem)
```

- [ ] **Step 2: Substituir o header com toggle Mês/Ano antigo**

Trocar o bloco da linha ~137-161 por:

```tsx
{/* Header */}
<div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
  <div>
    <h1 className="text-2xl font-bold text-slate-800">Relatórios</h1>
    <p className="text-slate-500 text-sm mt-0.5">
      {from === to ? `${from}` : `${from} → ${to}`}
    </p>
  </div>
  <PeriodSelector from={from} to={to} />
</div>
```

- [ ] **Step 3: Remover `monthlyData` antigo (não usado direto)**

A variável `monthlyData` (linhas ~126-132) era do toggle antigo. Remover.

- [ ] **Step 4: Validar manualmente**

`npm run dev` → `/reports`:
- Default carrega "Este mês"
- Click no preset "Últimos 6 meses" → URL muda para `?from=YYYY-MM&to=YYYY-MM`, dados refazem
- Mudar inputs De/Até manualmente → também atualiza
- Recarregar com `?month=5&year=2026` → traduz e funciona (compat)

- [ ] **Step 5: Commit**

```bash
git add src/app/\(dashboard\)/reports/page.tsx
git commit -m "feat(reports): switch to from/to period range with presets"
```

---

## Fase 7 — Relatórios com comparação A vs B

### Task 7.1: Helper `computeDelta` e tipos

**Files:**
- Create: `src/components/reports/comparison.ts`
- Create: `src/components/reports/comparison.test.ts`

- [ ] **Step 1: Escrever testes pra `computeDelta` e `shiftRange`**

```ts
// src/components/reports/comparison.test.ts
import { describe, it, expect } from 'vitest'
import { computeDelta, shiftRange, sameSizePrevRange } from './comparison'

describe('computeDelta', () => {
  it('returns absolute and percent diff', () => {
    expect(computeDelta(120, 100)).toEqual({ abs: 20, pct: 20 })
  })

  it('returns abs only when previous is 0', () => {
    expect(computeDelta(100, 0)).toEqual({ abs: 100, pct: null })
  })

  it('handles decrease', () => {
    expect(computeDelta(80, 100)).toEqual({ abs: -20, pct: -20 })
  })

  it('returns zero delta when same', () => {
    expect(computeDelta(50, 50)).toEqual({ abs: 0, pct: 0 })
  })
})

describe('shiftRange', () => {
  it('shifts by 12 months (same period last year)', () => {
    expect(shiftRange({ from: '2026-05', to: '2026-05' }, 12)).toEqual({
      from: '2025-05', to: '2025-05',
    })
  })

  it('handles multi-month range', () => {
    expect(shiftRange({ from: '2026-03', to: '2026-05' }, 12)).toEqual({
      from: '2025-03', to: '2025-05',
    })
  })
})

describe('sameSizePrevRange', () => {
  it('previous month for single-month range', () => {
    expect(sameSizePrevRange({ from: '2026-05', to: '2026-05' })).toEqual({
      from: '2026-04', to: '2026-04',
    })
  })

  it('previous quarter for 3-month range', () => {
    expect(sameSizePrevRange({ from: '2026-04', to: '2026-06' })).toEqual({
      from: '2026-01', to: '2026-03',
    })
  })

  it('crosses year boundary', () => {
    expect(sameSizePrevRange({ from: '2026-01', to: '2026-02' })).toEqual({
      from: '2025-11', to: '2025-12',
    })
  })
})
```

- [ ] **Step 2: Rodar pra ver falhar**

Run: `npx vitest run src/components/reports/comparison.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

```ts
// src/components/reports/comparison.ts
export type Range = { from: string; to: string }
export type Delta = { abs: number; pct: number | null }

export function computeDelta(current: number, previous: number): Delta {
  const abs = current - previous
  if (previous === 0) return { abs, pct: null }
  return { abs, pct: (abs / previous) * 100 }
}

function parseYM(ym: string): { y: number; m: number } {
  const [y, m] = ym.split('-').map(Number)
  return { y, m }
}

function fmtYM(y: number, m: number): string {
  while (m <= 0) { m += 12; y-- }
  while (m > 12) { m -= 12; y++ }
  return `${y}-${String(m).padStart(2, '0')}`
}

export function shiftRange(range: Range, monthsBack: number): Range {
  const f = parseYM(range.from)
  const t = parseYM(range.to)
  return {
    from: fmtYM(f.y, f.m - monthsBack),
    to: fmtYM(t.y, t.m - monthsBack),
  }
}

export function sameSizePrevRange(range: Range): Range {
  const f = parseYM(range.from)
  const t = parseYM(range.to)
  const sizeMonths = (t.y - f.y) * 12 + (t.m - f.m) + 1
  // O período anterior termina imediatamente antes do início do atual
  const prevToY = f.y, prevToM = f.m - 1
  const prevFromY = f.y, prevFromM = f.m - sizeMonths
  return {
    from: fmtYM(prevFromY, prevFromM),
    to: fmtYM(prevToY, prevToM),
  }
}
```

- [ ] **Step 4: Rodar testes**

Run: `npx vitest run src/components/reports/comparison.test.ts`
Expected: 9 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/reports/comparison.ts src/components/reports/comparison.test.ts
git commit -m "feat(reports): delta and range-shift helpers for comparison"
```

---

### Task 7.2: Toggle "Comparar com" no PeriodSelector + segundo seletor

**Files:**
- Modify: `src/components/reports/period-selector.tsx`

- [ ] **Step 1: Adicionar botão "Comparar com" e segundo bloco de inputs**

Edit `period-selector.tsx`. Expandir props e UI:

```tsx
type Props = {
  from: string
  to: string
  compareFrom?: string
  compareTo?: string
}

export function PeriodSelector({ from, to, compareFrom, compareTo }: Props) {
  const router = useRouter()
  const params = useSearchParams()
  const [open, setOpen] = useState(false)
  const comparing = Boolean(compareFrom && compareTo)

  function setParams(updates: Record<string, string | null>) {
    const sp = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(updates)) {
      if (v === null) sp.delete(k)
      else sp.set(k, v)
    }
    router.push(`?${sp.toString()}`)
  }

  function applyRange(nextFrom: string, nextTo: string) {
    setParams({ from: nextFrom, to: nextTo })
  }

  function toggleCompare() {
    if (comparing) {
      setParams({ compareFrom: null, compareTo: null, comparePreset: null })
    } else {
      // default: ano passado, mesmo período
      const { shiftRange } = require('./comparison') as typeof import('./comparison')
      const shifted = shiftRange({ from, to }, 12)
      setParams({ compareFrom: shifted.from, compareTo: shifted.to })
    }
  }

  function applyComparePreset(kind: 'prev' | 'yoy') {
    const { sameSizePrevRange, shiftRange } = require('./comparison') as typeof import('./comparison')
    const r = kind === 'prev'
      ? sameSizePrevRange({ from, to })
      : shiftRange({ from, to }, 12)
    setParams({ compareFrom: r.from, compareTo: r.to })
  }

  return (
    <div className="flex flex-col gap-2 items-end">
      <div className="flex flex-wrap items-center gap-2">
        {/* preset dropdown + de/até (igual ao que já existe) */}
        {/* ... reaproveita o JSX atual ... */}
        <button
          onClick={toggleCompare}
          className={cn(
            'px-3 py-1.5 rounded-lg border text-sm transition-colors',
            comparing
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-white border-stone-200 hover:bg-stone-50'
          )}
        >
          {comparing ? '✓ Comparando' : 'Comparar com…'}
        </button>
      </div>

      {comparing && (
        <div className="flex flex-wrap items-center gap-2 bg-stone-50 border border-stone-100 px-3 py-2 rounded-lg">
          <span className="text-xs font-medium text-stone-500">Comparar com:</span>
          <button onClick={() => applyComparePreset('prev')} className="text-xs px-2 py-1 rounded border border-stone-200 hover:bg-white">Período anterior</button>
          <button onClick={() => applyComparePreset('yoy')} className="text-xs px-2 py-1 rounded border border-stone-200 hover:bg-white">Mesmo período ano passado</button>
          <label className="flex items-center gap-1 text-xs text-stone-500">
            De
            <input type="month" value={compareFrom} onChange={(e) => setParams({ compareFrom: e.target.value })}
              className="border border-stone-200 rounded-md px-2 py-1 text-sm bg-white" />
          </label>
          <label className="flex items-center gap-1 text-xs text-stone-500">
            Até
            <input type="month" value={compareTo} onChange={(e) => setParams({ compareTo: e.target.value })}
              className="border border-stone-200 rounded-md px-2 py-1 text-sm bg-white" />
          </label>
        </div>
      )}
    </div>
  )
}
```

**Nota:** o `require` runtime acima é só uma forma simples; substituir por `import` estático no topo do arquivo:

```ts
import { shiftRange, sameSizePrevRange } from './comparison'
```

- [ ] **Step 2: Validar com `npm run dev`**

Click "Comparar com…" → segundo bloco aparece com período ano passado por padrão. Click "Período anterior" → muda. Inputs De/Até funcionam.

- [ ] **Step 3: Commit**

```bash
git add src/components/reports/period-selector.tsx
git commit -m "feat(reports): compare-with toggle and secondary range selector"
```

---

### Task 7.3: `/reports` busca dois períodos e renderiza com Δ

**Files:**
- Modify: `src/app/(dashboard)/reports/page.tsx`

- [ ] **Step 1: Buscar A e B em paralelo quando comparação ativa**

Edit `reports/page.tsx`:

```tsx
const compareFrom = searchParams.get('compareFrom') ?? undefined
const compareTo = searchParams.get('compareTo') ?? undefined
const comparing = Boolean(compareFrom && compareTo)

const [transactionsB, setTransactionsB] = useState<Transaction[]>([])

const fetchData = useCallback(async () => {
  setLoading(true)
  try {
    if (comparing && compareFrom && compareTo) {
      const [a, b] = await Promise.all([
        getTransactions({ from, to }),
        getTransactions({ from: compareFrom, to: compareTo }),
      ])
      setTransactions(a)
      setTransactionsB(b)
    } else {
      const a = await getTransactions({ from, to })
      setTransactions(a)
      setTransactionsB([])
    }
  } finally { setLoading(false) }
}, [from, to, compareFrom, compareTo, comparing])
```

- [ ] **Step 2: Passar `compareFrom`/`compareTo` para o `PeriodSelector`**

```tsx
<PeriodSelector from={from} to={to} compareFrom={compareFrom} compareTo={compareTo} />
```

- [ ] **Step 3: Calcular totais B**

Adicionar abaixo dos cálculos de A:

```ts
const totalIncomeB = transactionsB.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
const totalExpensesB = transactionsB.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
```

- [ ] **Step 4: Cards de totais mostram Δ quando `comparing`**

Criar componente helper inline (ou em `src/components/reports/delta-badge.tsx`):

```tsx
// src/components/reports/delta-badge.tsx
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/format'
import { computeDelta, type Delta } from './comparison'

export function DeltaBadge({
  current, previous, invertColor = false,
}: { current: number; previous: number; invertColor?: boolean }) {
  const { abs, pct } = computeDelta(current, previous)
  const positive = abs > 0
  const good = invertColor ? !positive : positive
  const colorClass = abs === 0 ? 'text-stone-500' : (good ? 'text-emerald-600' : 'text-red-500')
  return (
    <div className={cn('text-xs font-medium flex items-center gap-1', colorClass)}>
      <span>{abs >= 0 ? '↑' : '↓'} {formatCurrency(Math.abs(abs))}</span>
      {pct !== null && <span className="opacity-70">({pct >= 0 ? '+' : ''}{pct.toFixed(1)}%)</span>}
    </div>
  )
}
```

Nos cards (na seção overview):

```tsx
<Card className="border border-slate-100 shadow-sm">
  <CardContent className="pt-4 pb-4">
    <p className="text-xs text-slate-500">Receitas</p>
    <p className="text-lg font-bold text-emerald-600">{formatCurrency(totalIncome)}</p>
    {comparing && (
      <>
        <p className="text-xs text-slate-400 mt-1">vs {formatCurrency(totalIncomeB)}</p>
        <DeltaBadge current={totalIncome} previous={totalIncomeB} />
      </>
    )}
  </CardContent>
</Card>
```

Para despesas, passar `invertColor` (aumento de despesa é ruim):
```tsx
<DeltaBadge current={totalExpenses} previous={totalExpensesB} invertColor />
```

- [ ] **Step 5: Aba Despesas — lista com colunas A | B | Δ**

Computar `expensesByCatB` análogo a `expensesByCat`. Na lista, adicionar 2 colunas extras à direita:

```tsx
{categoryData.map((item) => {
  const previousAmount = (expensesByCatB[
    item.category === 'custom' ? (item.customKey ?? 'custom') : item.category
  ]?.amount) ?? 0
  return (
    <div key={item.category} className="flex items-center gap-3 px-4 py-2.5">
      <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-700 truncate">{item.label}</p>
        <div className="mt-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${item.percentage}%`, backgroundColor: item.color }} />
        </div>
      </div>
      <div className="text-right shrink-0 min-w-[5rem]">
        <p className="text-sm font-semibold text-slate-700">{formatCurrency(item.amount)}</p>
        {comparing && <p className="text-xs text-slate-400">vs {formatCurrency(previousAmount)}</p>}
      </div>
      {comparing && (
        <div className="shrink-0 min-w-[5rem] text-right">
          <DeltaBadge current={item.amount} previous={previousAmount} invertColor />
        </div>
      )}
    </div>
  )
})}
```

(Análogo para a lista de Projetos/Receita na aba `projects`, sem invertColor.)

- [ ] **Step 6: Aba Entradas x Saídas — barras agrupadas A vs B**

Substituir o `BarChart` data quando `comparing`:

```tsx
const barData = comparing
  ? [
      { name: 'Período A', receitas: totalIncome, despesas: totalExpenses },
      { name: 'Período B', receitas: totalIncomeB, despesas: totalExpensesB },
    ]
  : [
      { name: 'Atual', receitas: totalIncome, despesas: totalExpenses },
    ]
```

E renderizar o `<BarChart data={barData} ...>` (estrutura igual).

- [ ] **Step 7: Validar manualmente**

`npm run dev` → `/reports`:
- Sem comparação: igual ao Task 6.3.
- Click "Comparar com…" → cards mostram "vs R$X (↑Y%)"
- Lista de despesas: cada linha tem coluna A, B e Δ
- Aba Entradas x Saídas: barras agrupadas (2 grupos: A e B)

Trocar entre presets de comparação ("Período anterior" / "Mesmo período ano passado") → dados batem.

- [ ] **Step 8: Commit**

```bash
git add src/app/\(dashboard\)/reports/page.tsx src/components/reports/delta-badge.tsx
git commit -m "feat(reports): A vs B comparison rendered across all tabs"
```

---

## Validação final

### Task 8.1: Smoke test manual completo

- [ ] **Step 1: Workspace business funcionalmente intacto**

`npm run dev` → workspace=business (default):
- Dashboard mostra dados atuais
- Transactions, A cobrar, Closings, Reservas, Previsão, Panorama, Cashflow funcionam
- Relatórios com novo seletor mostram dados de "Este mês"
- Reports comparação funciona

- [ ] **Step 2: Workspace personal isolado**

Trocar para personal:
- Dashboard zerado
- Transactions vazia
- Settings/Accounts vazia, Settings/Cards vazia, Settings/Categories vazia
- Menu mostra: Visão Geral, Lançamentos, Categorizar, Importar, Relatórios, Settings (sem Integrações)
- `/a-cobrar`, `/closings`, `/reservas`, `/previsao`, `/panorama`, `/cashflow` redirecionam para `/dashboard`
- Criar uma transação manual com categoria "Mercado" → aparece só no PF
- Trocar para business → essa transação NÃO aparece

- [ ] **Step 3: Importação no PF**

Workspace=personal → criar uma categorization_rule "Mercado XYZ → groceries" → importar CSV → transações vão para PF com categoria certa. Trocar para business: regra e transações não aparecem.

- [ ] **Step 4: Relatórios**

Em ambos workspaces, testar presets e comparação. Validar Δ correto (calcular à mão em uma categoria simples).

- [ ] **Step 5: Final tests**

Run: `npx vitest run && npm run build`
Expected: tudo PASS, build OK.

- [ ] **Step 6: Commit final + tag opcional**

Não há mudança de código. Marcar fim do escopo:

```bash
git log --oneline | head -30
```

Validar que todos os commits planejados estão lá.

---

## Out of scope reminder

Não implementar neste plano:
- `workspace_members` / Andrei com login próprio
- Gráfico de evolução linha-no-tempo
- Aba dedicada de comparação anual (já coberto via "ano passado" no comparador genérico)
- Migração de dados existentes entre workspaces
- Páginas Fysi-only adaptadas ao PF
