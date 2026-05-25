# Workspaces (Empresa/Pessoal) + Relatórios com período custom e comparação

**Data:** 2026-05-25
**Status:** Design aprovado pelo usuário, pronto para plano de implementação

## Objetivo

Adicionar duas capacidades ao app:

1. **Workspaces** — separar o app em dois contextos isolados: `business` (Fysi, dados atuais) e `personal` (vida pessoal compartilhada com Andrei, começa zerado). Toggle no header alterna entre os dois; todos os dados ficam segregados.
2. **Relatórios mais ricos** — filtrar por intervalo de meses custom (não só "mês X" ou "ano Y") e comparar dois períodos lado a lado com variação % e absoluta.

Sem alterar nada do que já existe na Fysi. Workspace pessoal nasce vazio.

## Arquitetura — Workspaces

### Modelagem

Coluna `workspace workspace_type NOT NULL DEFAULT 'business'` adicionada às tabelas relevantes. Enum Postgres: `('business', 'personal')`.

**Tabelas que ganham `workspace`:**
- `transactions`
- `accounts`
- `credit_cards`
- `categorization_rules`
- `fixed_costs`
- `integrations`
- `reminders`

**Tabelas que NÃO ganham (continuam exclusivas da Fysi):**
- `projects`, `crm_*` (CRM de projetos)
- `reservas`, `closings`, `a_cobrar`
- `asaas_*` (integração Asaas)

Migration marca tudo o que existe hoje como `'business'` via DEFAULT. O workspace `'personal'` começa com 0 linhas — sem cópia, sem mistura.

### Estado no client

- **Cookie `workspace`** com valor `'business'` ou `'personal'` (default `'business'`).
- **`WorkspaceContext` (React Context)** disponibiliza o workspace atual para componentes.
- **Server-side**: helpers em `lib/workspace.ts` leem o cookie via `cookies()` do Next e expõem `getCurrentWorkspace()` para server actions e route handlers.
- **Trocar workspace**: clica no seletor do header → server action seta o cookie → `router.refresh()` recarrega a app no contexto novo.

### Filtro em queries

Todas as funções de leitura de dados em `lib/` que acessam as tabelas com `workspace` recebem (ou inferem) o workspace atual e filtram por ele:

- `lib/transactions.ts` — `getTransactions`, `getTransactionById`, criação/edição
- `lib/accounts.ts`
- `lib/credit-cards.ts`
- `lib/categorization.ts` (rules)
- `lib/fixed-costs.ts`
- `lib/integrations.ts`
- `lib/reminders.ts`

Funções que escrevem (insert/update) injetam `workspace` automaticamente baseado no contexto atual.

### RLS

Policies existentes (`user_id = auth.uid()`) continuam. Não criamos policy por workspace porque o filtro acontece na aplicação — o usuário ainda é dono de ambos workspaces. Se no futuro o Andrei tiver login próprio compartilhado, evoluímos para uma tabela `workspace_members` (não está no escopo agora).

### Índices

```sql
CREATE INDEX idx_transactions_user_workspace_date ON transactions(user_id, workspace, date DESC);
CREATE INDEX idx_accounts_user_workspace ON accounts(user_id, workspace);
CREATE INDEX idx_credit_cards_user_workspace ON credit_cards(user_id, workspace);
```

## UI — Seletor de workspace

No header (componente do `src/app/(dashboard)/layout.tsx`), à esquerda do menu do usuário:

```
[ 🏢 Fysi ▾ ]   ────────────  user ▾
   └─ 🏢 Fysi (empresa)
   └─ 👤 Pessoal
```

- Botão mostra ícone + nome do workspace atual.
- Dropdown lista os dois workspaces.
- Click → server action `setWorkspace(value)` → cookie escrito → `router.refresh()`.
- Ícone e cor diferentes para feedback visual (verde Fysi / azul Pessoal, por exemplo).

## UI — Menu lateral por workspace

**Workspace `business` (Fysi):** menu atual, sem mudanças.

**Workspace `personal`:** menu reduzido. Itens visíveis:
- Dashboard
- Transações
- Contas / Cartões
- Categorizar
- Importar
- Relatórios
- Settings

Itens ocultos no contexto pessoal: A cobrar, Closings, CRM Projetos, Reservas, Previsão, Cashflow, Panorama, integrações Asaas.

O sidebar lê `workspace` do context e filtra os itens.

## Categorias do workspace Pessoal

Conjunto separado, **não compartilha enum com as categorias da Fysi**.

### Tipo TypeScript

```ts
export type PersonalCategory =
  // Receita
  | 'salary_personal' | 'freelance_personal' | 'reimbursement'
  | 'gift_received' | 'investment_income' | 'other_income'
  // Despesa
  | 'groceries' | 'dining' | 'shopping' | 'car' | 'fuel'
  | 'transport' | 'housing' | 'health' | 'leisure' | 'clothing'
  | 'subscriptions' | 'travel' | 'gifts' | 'education_personal'
  | 'pet' | 'personal_care' | 'taxes_personal' | 'donations'
  | 'other_expense' | 'custom'
```

### Seed inicial (labels em PT-BR)

**Receita pessoal:**
- Salário / Pró-labore
- Freelance
- Reembolso
- Presente recebido
- Rendimento (investimento)
- Outros

**Despesa pessoal:**
- Mercado
- Restaurante / iFood / Delivery
- Compras (eletrônicos, casa, presentes pra si)
- Carro (manutenção, IPVA, seguro, lavagem)
- Gasolina / Combustível
- Transporte (Uber, táxi, transporte público, estacionamento)
- Moradia (aluguel, condomínio, contas: luz/água/gás/internet)
- Saúde (plano, farmácia, consultas)
- Lazer / Entretenimento
- Vestuário
- Assinaturas (streaming, apps)
- Viagem
- Presentes (pra outros)
- Educação
- Pet
- Cuidados pessoais (cabeleireiro, estética)
- Impostos / Taxas pessoais
- Doações
- Outros

### Estrutura

Cada `Transaction` no workspace `personal` usa:
- `category: PersonalCategory` (no banco, o enum em SQL pode ser unificado num único enum de string aberto OU criamos enum separado — escolha de implementação)
- `custom_category: string | null` (livre quando `category = 'custom'`)
- `subcategory: string | null` (mantém o que já existe)

Decisão de banco: a coluna `category` na tabela `transactions` hoje é `text` (livre) ou enum? **Verificar na migration original; se for enum estrito, expandir o enum para conter as categorias pessoais; se for text, basta validação no app.** Esta verificação faz parte do plano de implementação.

### Cores

Constante `PERSONAL_CATEGORY_COLORS: Record<PersonalCategory, string>` em `src/types/index.ts`. Paleta nova, distinta da paleta da Fysi (Fysi puxa pra verde-esmeralda; pessoal pode puxar pra azul/lilás).

### Função `getCategoryLabel`

Estendida pra detectar o workspace e mapear para o conjunto certo:

```ts
getCategoryLabel(category, customCategory, workspace) // workspace é o discriminator
```

Componentes que escolhem categoria (form de transação, filtro de categorizar) leem `workspace` do context e mostram a lista certa.

## Importação no workspace Pessoal

`/import` reutilizado sem mudança visual. Comportamento:

- Quando workspace ativo é `personal`, transações criadas pela importação recebem `workspace = 'personal'`.
- `categorization_rules` ganha coluna `workspace`. Regras criadas no contexto pessoal só se aplicam à importação pessoal — não confundem categorização da Fysi.
- O matcher de regras na importação filtra rules pelo workspace atual antes de aplicar.

## Relatórios — período custom e comparação

Mudanças em `src/app/(dashboard)/reports/page.tsx`. Vale para os dois workspaces.

### Seletor de período

Substitui o toggle "Mês / Ano" atual.

```
Período: [ Últimos 3 meses ▾ ]   [ De: Jan/2026 ] [ Até: Mai/2026 ]
```

Presets do dropdown:
- Este mês
- Mês passado
- Últimos 3 meses
- Últimos 6 meses
- Últimos 12 meses
- Este ano
- Ano passado
- Personalizado (libera campos De/Até para edição manual por mês-ano)

**URL:** `?from=YYYY-MM&to=YYYY-MM`. Mantém compatibilidade lendo o antigo `?month=&year=` por uma migração interna (se vier o antigo, traduz pra `from=to=` do mesmo mês). Pode ser removido depois.

### Comparação A vs B

Botão **"Comparar com..."** ao lado do seletor. Quando ativo, segundo seletor aparece:

```
Período A: [De Mai/2026 Até Mai/2026]   Período B: [De Mai/2025 Até Mai/2025]
```

Presets rápidos de comparação:
- "vs período anterior" — B = mesma duração de A, imediatamente anterior
- "vs mesmo período ano passado" — B = A deslocado 12 meses para trás

**URL:** `?from=&to=&compareFrom=&compareTo=`.

### Renderização com comparação ativa

Para cada métrica/card/gráfico, mostra A e B lado a lado com delta:

- **Cards de totais** (Receita, Despesa, Saldo): coluna `A`, coluna `B`, e `Δ %` + `Δ absoluto`. Cor verde se favorável, vermelha se desfavorável (lógica inverte para despesas: aumento é ruim).
- **Aba Projetos/Receita**: pie de A; lista de tipos de projeto mostra colunas A | B | Δ.
- **Aba Despesas**: pie de A; lista de categorias mostra A | B | Δ. Categorias que existem só em um período aparecem com "—" no outro.
- **Aba Entradas x Saídas**: barras agrupadas (duas barras por período: A e B); cards no topo com Δ.

### Backend

`getTransactions` em `lib/transactions.ts` ganha a assinatura:

```ts
getTransactions(opts: {
  month?: number; year?: number;          // legado
  from?: string;                          // 'YYYY-MM'
  to?: string;                            // 'YYYY-MM'
  workspace?: WorkspaceType;              // inferido do cookie se omitido
})
```

Quando `from`/`to` vêm, faz uma única query SQL com `date >= fromStart AND date <= toEnd` (em vez do loop atual mês-a-mês para o "ano inteiro").

Para comparação A vs B: a página faz duas chamadas em paralelo (`Promise.all`).

## Migration

Arquivo `supabase/migrations/012_workspaces.sql`:

```sql
-- Enum
CREATE TYPE workspace_type AS ENUM ('business', 'personal');

-- Adiciona coluna
ALTER TABLE transactions          ADD COLUMN workspace workspace_type NOT NULL DEFAULT 'business';
ALTER TABLE accounts              ADD COLUMN workspace workspace_type NOT NULL DEFAULT 'business';
ALTER TABLE credit_cards          ADD COLUMN workspace workspace_type NOT NULL DEFAULT 'business';
ALTER TABLE categorization_rules  ADD COLUMN workspace workspace_type NOT NULL DEFAULT 'business';
ALTER TABLE fixed_costs           ADD COLUMN workspace workspace_type NOT NULL DEFAULT 'business';
ALTER TABLE integrations          ADD COLUMN workspace workspace_type NOT NULL DEFAULT 'business';
ALTER TABLE reminders             ADD COLUMN workspace workspace_type NOT NULL DEFAULT 'business';

-- Índices
CREATE INDEX idx_transactions_user_workspace_date ON transactions(user_id, workspace, date DESC);
CREATE INDEX idx_accounts_user_workspace          ON accounts(user_id, workspace);
CREATE INDEX idx_credit_cards_user_workspace      ON credit_cards(user_id, workspace);
```

> A migration deve ser revisada contra o schema real durante o plano (nomes exatos das tabelas, se `reminders` existe, se há outras tabelas usuário-escopo que esquecemos).

## Ordem de entrega

Cada passo é um PR pequeno, testável isolado.

1. **Foundation (migration + contexto):** adiciona coluna `workspace`, cria `WorkspaceContext`, server actions de `getCurrentWorkspace`/`setWorkspace`, seletor no header. Sem mudança funcional visível — workspace ativo permanece `business` enquanto não trocar.

2. **Filtro nas queries:** atualiza todas as funções de `lib/` que tocam tabelas com `workspace` para respeitar o workspace atual em leituras e gravações. Validação: workspace Pessoal vazio mostra app zerada quando ativado.

3. **Menu lateral por workspace:** sidebar oculta itens da Fysi quando workspace é `personal`.

4. **Categorias PF:** novo `PersonalCategory`, paleta, `getCategoryLabel` workspace-aware, form de transação e tela `Categorizar` mostram o conjunto certo conforme o workspace.

5. **Importação no PF:** coluna `workspace` em `categorization_rules`, matcher filtra por workspace.

6. **Relatórios — período custom:** novo seletor, presets, URL `?from=&to=`, `getTransactions` aceita intervalo, compat com URL antiga.

7. **Relatórios — comparação A vs B:** botão "Comparar com", segundo seletor, presets "anterior" e "ano anterior", render com colunas Δ em cards/listas/barras.

## Out of scope

- Andrei com login próprio compartilhando workspace pessoal (não agora — arquitetura permite migrar para `workspace_members` no futuro).
- Relatórios com gráfico de evolução (linha mês-a-mês) — não pedido nesta rodada.
- Comparação anual ano-vs-ano como aba dedicada — coberto via "vs mesmo período ano passado" no comparador genérico.
- Mover qualquer dado existente da Fysi para o workspace pessoal.
- Páginas Fysi-only (CRM, Projetos, A cobrar, Closings, Reservas, Previsão, Asaas) no workspace pessoal.
